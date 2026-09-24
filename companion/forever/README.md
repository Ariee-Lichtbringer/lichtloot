# GuildLoot Forever – Itementdeckung (0.1.0 Beta)

Ziel: Neue Forever-Items werden erst durch tatsächliche Drops bekannt. Das Add-on
meldet deshalb alle beobachteten Gegenstände; ein Item muss nicht vorher in unserer
Datenbank stehen. Eine Raidplanung oder Raid-ID ist nicht erforderlich.

## Installation und Ablauf

1. Den Ordner `GuildLootForever` in den `Interface/AddOns`-Ordner des **Forever**-Clients kopieren.
2. Im Spiel aktivieren. Unterstütztes Ziel: Forever 1.60.x, Interface 16001.
   Die genaue Beta-Version muss im Spiel getestet werden. Era wird abgewiesen.
3. Beute öffnen. Das Add-on erfasst Item-ID/Link/Name, verfügbare Qualität,
   Itemlevel, benötigtes Level, Klasse/Unterklasse, Ausrüstungsslot, Icon-ID,
   Quell-GUID, sicheren Quellnamen, Gebiet/Instanz, Sprache, Zeitpunkt und Client-Build.
   Itemdaten werden nachgeladen, falls der Client sie zunächst noch nicht kennt.
4. `/reload` oder reguläres Ausloggen schreibt die SavedVariables-Datei.
5. Python 3 installieren, dann im Terminal starten:

   python3 upload.py "/Pfad/zu/WTF/Account/ACCOUNT/SavedVariables/GuildLootForever.lua" --guild GILDENKUERZEL --watch

   Unter Windows alternativ `py upload.py ...`. Gildenkürzel ist der `guild`-Wert
   eurer Forever-Seitenadresse. PIN eines **freigegebenen Forever-SpielerLogins**
   wird verdeckt abgefragt. Sie bleibt im Speicher des Begleitprogramms und wird
   nur über HTTPS an `https://lichtloot.de/api/forever` übermittelt.
   Keine PIN und keine Datenbank-Zugangsdaten gehören in das Add-on.
6. Das Begleitprogramm überträgt geänderte Dateien alle 30 Sekunden automatisch.
   Ohne `--watch` wird einmal hochgeladen. Fehler werden angezeigt und im Watch-Modus
   erneut versucht. Bereits bestätigte Funde werden serverseitig dedupliziert.

**Kein Echtzeit-Direktzugriff aus WoW:** Das Add-on öffnet keine Netzwerkverbindung.
Neue Daten erreichen das Begleitprogramm erst, nachdem WoW sie gespeichert hat.
Falls SavedVariables im Beta-Client nicht zuverlässig funktionieren: `/gfl export`,
Text in eine Datei kopieren und diese mit demselben Upload-Befehl übergeben.

## Befehle

- `/gfl`: Status und Anzahl lokaler Datensätze.
- `/gfl stop` / `/gfl start`: Erfassung pausieren / fortsetzen.
- `/gfl export`: Exportfenster; Text kopieren.
- `/gfl clear CONFIRM`: Lokales Protokoll nach gesichertem Upload löschen.

## Daten und Grenzen

- Speicherung ausschließlich über `FOREVER_DATABASE_URL`, Tabelle
  `forever_item_discoveries`; kein Fallback auf Era.
- Fehlende Namen/Metadaten werden nicht erfunden. Gegnername wird nur übernommen,
  wenn die Target-GUID mit der Lootquelle übereinstimmt. Eine Quelle ist nicht
  automatisch ein Boss. GUID bleibt für spätere NPC-Zuordnung gespeichert.
- Es werden sichtbare Lootfenster erfasst, keine garantierte vollständige Raidbeute.
  Beute, deren Fenster der aufzeichnende Spieler nie sieht, bleibt unbekannt.
- Nur eindeutige Creature-, Vehicle- oder GameObject-Quellen; keine Geldbeträge,
  Tascheninhalte, Chatnachrichten oder Spielerinventare.
- Ein beobachteter Gegenstand ist nicht zwingend neu eingeführt: Das System sammelt
  auch bekannte IDs, damit neue Quellen und Beta-Änderungen nicht verloren gehen.
- Funde sind Community-Meldungen, keine fälschungssicheren Blizzard-Nachweise.
  Sie ergänzen die Website im Bereich „Neue Funde aus dem Spiel“ und überschreiben
  keine geprüften Kataloge. Keine automatische P0-, Punkte- oder Vergabebuchung.
- Öffentliche Fundliste enthält keine Gilden-, Account- oder Spielernamen.
- Downloadpaket enthält keine Zugangsdaten. Das Add-on ist lokal getestet, noch
  nicht im echten Forever-Client verifiziert.

## Server bereitstellen

Vor produktivem Upload müssen `src/forever-addon-loot.js`, die Integration in
`src/forever-raids.js`, `public/forever-discoveries.js` und `public/forever.html`
mit der API ausgerollt werden. Die neue Tabelle wird bei erster Nutzung angelegt.
Die vorhandene Authentifizierung und das Forever-Rate-Limit gelten weiter.
GET `/api/forever/discoveries` liefert maximal 5000 unterschiedliche Item-IDs.
POST `/api/forever`, action `addonLootImport`, akzeptiert maximal 250 Meldungen
je Anfrage; der Uploader teilt größere Exporte automatisch auf.

## Prüfung

- `FOREVER_PGLITE=/pfad/zu/pglite/dist/index.js node lichtloot-api/tests/forever-discoveries.test.mjs`
- `python3 companion/forever/test_upload.py`
- `lua addons/GuildLootForever/Test.lua` (aus dem Projektverzeichnis)

Vor Freigabe: im echten Forever-Client ein Lootfenster öffnen, mit `/reload`
speichern, hochladen, Fundseite prüfen und dieselbe Datei erneut hochladen.
Der zweite Upload muss 0 neue/ergänzte Einträge melden.
