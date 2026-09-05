# Automatische Raid-Auswertung

Pro Gilde unter Gildenleitung die Option „Excel-Auswertung automatisch erstellen und posten“ aktivieren und den bestehenden Analyse-Channel (gegebenenfalls je Raid) einstellen. Standard: deaktiviert.

Nach Abschluss der kombinierten Loganalyse erstellt die API eine Excel-Datei aus den gespeicherten Analysedaten. Der PO-Bot verarbeitet `raid_workbook_post` und veröffentlicht Raidname, Gilde, Raidbeginn sowie Links zur Excel-Datei, GuildLoot-Analyse und Warcraft Logs. NachtLoot und LichtLoot erhalten ihre eigene Markenbezeichnung im Hinweis auf die ausführliche Analyse. Der Hinweis steht auch in der Excel-Übersicht.

Die Datei ist unter `/api/guilds/:guildSlug/log-analyses/:analysisId/workbook.xlsx` erreichbar. Eine Neuberechnung aktualisiert dieselbe Datei; eine heruntergeladene lokale Kopie aktualisiert sich nicht selbst. Bereits abgeschlossene Bot-Posts werden nicht erneut eingereiht. Ein fehlender Channel verhindert den Post, die Analyse bleibt verfügbar. Exportfehler stehen in `log_analyses.summary.workbookError`.

API und produktiven PO-Bot gemeinsam veröffentlichen. API: `exceljs` installieren (Lockfile enthalten). PO-Bot: `raid_workbook_post.py` zusammen mit `po_bot.py` ausliefern. Der Bot braucht im Zielchannel Zugriff, Nachrichtenverlauf, Nachrichten senden und Links einbetten. Kein separater Google-Zugang nötig; der Link liefert XLSX, kein natives Google Sheet.

URL-Konfiguration: `GUILDLOOT_PUBLIC_URL` (Standard `https://lichtloot.de`) und `PUBLIC_API_URL` bzw. `LICHTLOOT_API_URL` (Standard bestehende Railway-API). Beim ersten Export werden die Cache-Tabelle und der Queue-Index angelegt. Raidbeginn stammt aus dem WCL-Report; fehlende Zeitdaten werden als nicht erfasst angezeigt.

Prüfung: `node tests/raid-workbook.mjs`; Python-Syntaxprüfung für beide Bot-Dateien. Keine Live-Discord-Nachrichten für Tests versenden.

Einmaliger Nachversand: `POST /api/guilds/:guildSlug/log-analyses/workbook-backfill`, autorisiert mit Queue-Token oder Mastercode im JSON-Body. Standard ist eine Vorschau der letzten fünf WCL-Reports. Zum Starten `dryRun: false`, die geprüften `analysisIds` (maximal fünf) und optional `enableAutomation: true` senden. Abgeschlossene Posts werden übersprungen. Die Vorschau liefert später auch Zustellstatus und Discord-Nachrichten-ID.
