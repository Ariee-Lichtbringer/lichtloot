#!/usr/bin/env python3
"""Read inert hex records, never execute Lua. Python 3, no external packages."""
import argparse
import getpass
import json
import locale
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path


try:
    language = 'de' if (locale.getlocale()[0] or '').lower().startswith('de') else 'en'
except (ValueError, TypeError):
    language = 'en'

def tr(de, en):
    return de if language == 'de' else en

def read_events(path):
    if path.stat().st_size > 64 * 1024 * 1024:
        raise ValueError(tr('Datei ist größer als 64 MB.', 'File exceeds 64 MB.'))
    data = path.read_text(encoding='utf-8-sig')
    events = []
    seen = set()
    for raw in re.findall(r'GFL1:([0-9a-f]+)', data):
        if raw in seen:
            continue
        if len(raw) > 16384 or len(raw) % 2:
            raise ValueError(tr('Beschädigter Export; nach abgeschlossenem /reload erneut versuchen.', 'Damaged export; try again after /reload has finished.'))
        event = json.loads(bytes.fromhex(raw).decode('utf-8'))
        if not isinstance(event, dict) or event.get('game') != 'forever' or event.get('version') != 1:
            raise ValueError(tr('Kein unterstützter Forever-Export.', 'Not a supported Forever export.'))
        events.append(event)
        seen.add(raw)
    if not events:
        raise ValueError(tr('Keine Forever-Lootdaten gefunden. Nach einem Drop /reload oder /gfl export verwenden.', 'No Forever loot data found. Use /reload or /gfl export after a drop.'))
    return events


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError(tr('Weiterleitung abgelehnt; Zugangscode wird nicht weitergegeben.', 'Redirect rejected; login code will not be forwarded.'))


def upload(path, guild, pin):
    events = read_events(path)
    if not events:
        raise ValueError(tr('Keine Itemfunde vorhanden.', 'No item discoveries available.'))
    opener = urllib.request.build_opener(NoRedirect())
    changed = 0
    for start in range(0, len(events), 250):
        body = dict(action='addonLootImport', guild=guild,
                    playerPin=pin, events=events[start:start+250])
        req = urllib.request.Request('https://lichtloot-production.up.railway.app/api/forever',
            data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'}, method='POST')
        try:
            with opener.open(req, timeout=45) as response:
                result = json.load(response)
        except urllib.error.HTTPError as error:
            raise ValueError(tr(f'Upload abgelehnt (HTTP {error.code}). Zugang und Berechtigung prüfen.', f'Upload rejected (HTTP {error.code}). Check your login and permissions.')) from None
        if not result.get('success'):
            raise ValueError(tr('Upload nicht bestätigt. Daten bleiben lokal erhalten.', 'Upload not confirmed. Your data remains saved locally.'))
        changed += result['changed']
    return len(events), changed


def main():
    global language
    language_parser = argparse.ArgumentParser(add_help=False)
    language_parser.add_argument('--lang', choices=['de', 'en'], default=language, help='Language / Sprache: de, en')
    language = language_parser.parse_known_args()[0].lang
    parser = argparse.ArgumentParser(description=__doc__, parents=[language_parser])
    parser.add_argument('file', type=Path, help=tr('GuildLootForever.lua oder gespeicherter /gfl export', 'GuildLootForever.lua or a saved /gfl export'))
    parser.add_argument('--guild', required=True, help=tr('Forever-Gildenkürzel aus der Website-URL', 'Forever guild slug from the website URL'))
    parser.add_argument('--watch', action='store_true', help=tr('Nach Dateiänderungen automatisch erneut hochladen', 'Automatically upload again when the file changes'))
    args = parser.parse_args()
    # Code never enters the AddOn, command line, URL or local state file.
    pin = os.environ.get('GUILDLOOT_FOREVER_PLAYER_PIN') or getpass.getpass(tr('Forever-Spieler-PIN (freigegebenes Mitglied): ', 'Forever player PIN (approved member): '))
    previous = None
    while True:
        try:
            stat = args.file.stat()
            signature = (stat.st_mtime_ns, stat.st_size)
            if signature != previous:
                time.sleep(1)
                if args.file.stat().st_mtime_ns != signature[0]:
                    continue
                total, changed = upload(args.file, args.guild, pin)
                print(tr(f'Forever: {total} Einträge bestätigt, {changed} neu/ergänzt.', f'Forever: {total} records confirmed, {changed} new/updated.'), flush=True)
                previous = signature
            if not args.watch:
                return
        except (ValueError, OSError, urllib.error.URLError) as error:
            print(str(error), flush=True)
            if not args.watch:
                raise SystemExit(1)
        time.sleep(30)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        pass
