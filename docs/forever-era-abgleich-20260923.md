# Forever / Era: Abgleich am 23. September 2026

## Geprüfte Abläufe und Änderungen

| Bereich | Forever-Prüfung / Ergebnis |
|---|---|
| Daten und Zugang | Eigener Pool, keine Era-Ausweichverbindung; fremde Gilden, Charaktere und Rollen serverseitig abgewiesen. Gildenleitung verlangt bei jedem Öffnen erneut den Leitungscode. |
| Navigation | Gildenauswahl für beide Spiele; eigene URLs für Hyjal, Barrow, Onyxia und Plündermeister. Gemeinsame Forever-Komponenten, keine kopierten Era-Daten. |
| Spieler | Anmeldung, Freigabe, Sperre, Charakterwahl und Wiederherstellung mit gehashter Sicherheitsantwort getestet. |
| Raid erstellen | Raidart, Datum, Berlin-Zeit, Gruppen, Plätze/Rollen, Vorlagen, Wiederholungen, Status, delegierte Leitung/Plündermeister und Discord-Kanal vorhanden. |
| Teilnehmer | Zusage, Ersatzbank, später, vielleicht, Absage; Kapazitätsgrenzen, Rollenrechte, Anwesenheit, Gruppenaufstellung und CSV-Export geprüft. |
| Lootseiten | Era-Anordnung: Loot links, P1/P2/P3 und P0/P0+ Auswahl, eigene Auswahl, explizites Speichern, Suche, Klasse, Tabelle, TXT-Export. P0-Freigabe und Sichtbarkeit vor Raidbeginn serverseitig geschützt. P0+ separat gespeichert. |
| Plündermeister | Eigene Seite mit kompaktem Raidkopf, Kennzahlen, echten offenen Prüfpunkten, Prio-Suche, Teilnehmerzugriff, Vergabe und Storno mit Protokoll. Zuweisung gilt nur für den konkreten Raid. |
| Layout | Farben, Logo, Hintergrund, Raidbilder, verfügbare Raids, Prioritätsstufen, Anmeldepflicht, P0+, Anzeige von Priozeit/Anwesenheit und Navigation bleiben gildenbezogen. |
| Gildenbank | Beide Spiele: Warteschlange „derzeit nicht vorrätig“, sichtbar für Antragsteller, weiterhin offen und später freigebbar. Forever bucht erst bei Freigabe ab und verhindert doppelte Abbuchung. |
| Punkte / Postfach | Buchungen, Gegenbuchung, Sicherung/Wiederherstellung, eigene Anfragen und Antworten getestet. |
| Discord | Bot-Einladung, Verbindung, Kanal/Berechtigungsprüfung und explizit ausgelöste Testnachricht. Erfolgsanzeige erst nach Worker-Bestätigung; keine echte Nachricht im Test gesendet. |
| Mitteilungen | Leitung kann Gildenmitteilung veröffentlichen oder entfernen. Keine automatische Discord-Nachricht. |
| Datenstand | 469 Talente in neun Klassen, Beta-Client 1.60.1.69977; 449 Fähigkeitsdatensätze einschließlich 15 entfernter Einträge; 2.178 Rezepte, darunter 438 Trainerrezepte; 24.112 Item-Datensätze und 532 Sets. |

## Bewusste Unterschiede und verbleibende Integrationsgrenzen

- Keine Worldbuffs in Forever. Getrennte Spieler-, Raid-, Prio-, Loot-, Bank- und Punktedaten.
- Ein Spieler verwendet seinen Forever-Zugang; delegierte Raidleitung und Plündermeister sind einem Spieler und Termin zugeordnet. Era-LeadPINs werden nicht wiederverwendet.
- Keine vollständige Funktionsgleichheit behauptet: Era-spezifische Prio3-Reforged-/Addon-Imports, automatischer P0+-Transfer und Kampflog-/Traffic-Integrationen sind nicht nachgebildet. Aufstellung hat aktuell CSV-Export; Punkte werden über das protokollierte Journal gebucht. Logs und Traffic sind als geplant gekennzeichnet.
- Neue Raid-Lootkataloge verwenden nur von der Gildenleitung hinterlegte Gegenstände. Datenbankeinträge und frühere Era-Drops beweisen keinen Forever-Raiddrop.
- Fähigkeiten/Talente stammen aus einer Community-Extraktion des Beta-Clients; neue Beschreibungen bleiben teilweise Englisch. Frühere eigene Talentlinks werden über stabile Talentidentitäten migriert; unvereinbare Builds werden nicht stillschweigend umgedeutet.
- Item-Import hat eine dokumentierte nicht erreichbare englische Quellspanne (IDs 300001–400000). Vorhandene und Community-Datensätze bleiben erhalten. Importberichte dokumentieren Abdeckung; keine Behauptung aller im Spiel erhältlichen Gegenstände.

## Quellen

- https://wowforevertalents.com/ und Unterseiten: extrahierte Talente, Fähigkeiten und Berufe.
- https://www.wowhead.com/forever/items und Item-Sets: Datenbankeinträge, nicht pauschal bestätigte Drops.
- https://us.forums.blizzard.com/en/wow/t/wow-forever-beta-known-issues-september-18/2352687 : offizieller bekannter Problemstand, im Changelog verlinkt.

## Validierung

PGlite führt echte PostgreSQL-Abfragen aus: getrennte Gilden, Rollen, Sperren, Kapazität, Revisionen, Freigaben, Journal und Bot-Leases. Playwright prüft den Ablauf von Antrag/PIN/Freigabe bis Prio-Speicherung und Loot sowie alle vier eigenständigen Seiten, Rezepte/Materialplanung und Talentmigration. Discord-Worker-Tests verwenden ausschließlich Mocks.
