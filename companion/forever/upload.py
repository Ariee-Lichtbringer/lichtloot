#!/usr/bin/env python3
"""Read inert hex records, never execute Lua. Python 3, no external packages."""
import argparse
import getpass
import json
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path


def read_events(path):
    if path.stat().st_size > 64 * 1024 * 1024:
        raise ValueError('Datei ist größer als 64 MB.')
    data = path.read_text(encoding='utf-8-sig')
    events = []
    seen = set()
    for raw in re.findall(r'GFL1:([0-9a-f]+)', data):
        if raw in seen:
            continue
        if len(raw) > 16384 or len(raw) % 2:
            raise ValueError('Beschädigter Export; nach abgeschlossenem /reload erneut versuchen.')
        event = json.loads(bytes.fromhex(raw).decode('utf-8'))
        if not isinstance(event, dict) or event.get('game') != 'forever' or event.get('version') != 1:
            raise ValueError('Kein unterstützter Forever-Export.')
        events.append(event)
        seen.add(raw)
    if not events:
        raise ValueError('Keine Forever-Lootdaten gefunden. Nach einem Drop /reload oder /gfl export verwenden.')
    return events


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('Weiterleitung abgelehnt; Zugangscode wird nicht weitergegeben.')


def upload(path, guild, pin):
    events = read_events(path)
    if not events:
        raise ValueError('Keine Itemfunde vorhanden.')
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
            raise ValueError(f'Upload abgelehnt (HTTP {error.code}). Zugang, Raid-ID und Berechtigung prüfen.') from None
        if not result.get('success'):
            raise ValueError('Upload nicht bestätigt. Daten bleiben lokal erhalten.')
        changed += result['changed']
    return len(events), changed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file', type=Path, help='GuildLootForever.lua oder gespeicherter /gfl export')
    parser.add_argument('--guild', required=True, help='Forever-Gildenkürzel aus der Website-URL')
    parser.add_argument('--watch', action='store_true', help='Nach Dateiänderungen automatisch erneut hochladen')
    args = parser.parse_args()
    # Code never enters the AddOn, command line, URL or local state file.
    pin = os.environ.get('GUILDLOOT_FOREVER_PLAYER_PIN') or getpass.getpass('Forever-Spieler-PIN (freigegebenes Mitglied): ')
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
                print(f'Forever: {total} Einträge bestätigt, {changed} neu/ergänzt.', flush=True)
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
