# Prio-Verlauf

Seit Migration 041 protokolliert PostgreSQL jede bestätigte INSERT-, UPDATE- und
DELETE-Operation auf `prios`. Trigger und Prio-Änderung laufen atomar: Bei einem
Rollback bleibt kein falscher Erfolgseintrag zurück. Auch Kaskadenlöschungen
werden protokolliert. Das Journal hat bewusst keine löschenden Fremdschlüssel.

Erfasst werden Zeitpunkt (UTC), Raid/Gilde, Charakter/Server, alte und neue
Item-IDs und Namen, Bankstatus, P0-Auswahl und eine statische Kennzeichnung des
schreibenden Codepfades. `database_or_cascade` bedeutet, dass kein Codepfadlabel
vorliegt. Das ist keine Identifikation einer handelnden Person. SQL-Abfragen,
PINs und vollständige Anfrage-/Kommentartexte werden nicht gespeichert.

Der einmalige `BASELINE`-Eintrag ist der Bestand bei Aktivierung, kein Beleg für
einen früheren Speichervorgang. Vor der Aktivierung gelöschte Prios und
fehlgeschlagene Speicherversuche können damit nicht rekonstruiert werden.
Das Journal erfasst die zentrale `prios`-Tabelle einschließlich ihrer
PO-Spiegel; separate Random-Raid-Daten sind nicht Teil dieses Protokolls.

## Auslesen

Nur serverseitig mit Datenbankzugriff (kein öffentlicher API-Endpunkt):

```sh
node scripts/read-prio-history.mjs GILDEN_UUID 'Mála' RAID_UUID
```

Die Raid-ID ist optional. Ausgabe: letzte 500 Vorgänge, neueste zuerst.
`DATABASE_URL` muss gesetzt sein. Zugangsdaten nicht in Tickets oder Chats kopieren.
Die Tabelle wird durch normale Raid-/Charakterbereinigungen nicht gelöscht.

## Prüfung

```sh
PGLITE_MODULE=/pfad/zu/pglite/dist/index.js node tests/prio-history.mjs
```
