# Zugangsschutz, erste Stufe – 15. September 2026

## Enthalten

- CORS und API-Origin-Prüfung nur für explizit freigegebene Origins; keine pauschale HTTP(S)-Freigabe und kein `null`-Origin.
- Sicherheitsantworten: gesalzene scrypt-Hashes, bestehende Antworten mit Compare-and-set beim Start und bei Wiederherstellung migrieren. Keine Klartext-Fallback-Verifikation.
- Fehlgeschlagene Zugriffe: 30 pro IP / 15 Minuten, einschließlich leerer Charakter-Login-Ergebnisse. Erfolgreiche normale Raid-Arbeit verbraucht dieses Budget nicht.
- Kontowiederherstellung: zusätzlich 5 Versuche je Gilde/Charakter/Realm / 15 Minuten und 20 je IP; Änderungen der Frage umgehen das Limit nicht.
- API-Antworten `no-store`, `no-referrer`, `nosniff`. Zugangsdaten in technischen Fehlerberichten werden redigiert; interne Fehlerdetails werden nicht öffentlich ausgeliefert.
- POST-Kompatibilität für bisherige GET-Aktionen; deren bestehende Berechtigungsprüfungen bleiben erhalten. Charakter-Endpunkt erhält POST-Variante mit gleicher Abfrage/Antwort.
- Website-Transportadapter verschiebt API-Parameter in POST-JSON. Frühere JSONP-Aufrufe werden als JSON geladen, Callback lokal aufgerufen. Alte Iframe-Schreibwege erhalten echte Erfolg-/Fehlerprüfung.

## Rollout

1. Backend mit POST-Kompatibilität veröffentlichen; `ENFORCE_SECURE_TRANSPORT` zunächst nicht setzen.
2. Website-Adapter und alle Einstiegspunkte veröffentlichen.
3. `ENFORCE_SECURE_TRANSPORT=browser`: Zugangsdaten in API-URLs und JSONP aus Browsern abweisen (`Origin` oder `Sec-Fetch-Mode`). Native alte Clients ohne diese Header bleiben kompatibel.
4. Nach Aktualisierung/Prüfung sämtlicher Sync-Clients auf `true` setzen, um auch native GET-Aufrufe mit Zugangsdaten abzuweisen.

Bei mehr als einer API-Instanz benötigen die Versuchszähler einen gemeinsamen Speicher. Der aktuell geprüfte Betrieb hat eine Instanz. Neustarts setzen die zeitlichen Limits zurück.

## Weiterhin offen – keine vollständige Authentifizierungsmodernisierung

Spieler-PINs sind weiterhin zugleich Datenbank-Zuordnung und Zugangsdaten. Sie sind noch nicht durch gehashte Passwörter und unabhängige interne Account-IDs ersetzt. Bestehende Browser-Speicherung und PIN-Parameter in internen Seitenlinks müssen zusammen mit einer echten Sitzungsanmeldung migriert werden. Die neue Transport-Schicht allein löst diese Probleme nicht.

Ein experimenteller Alias-/Sitzungsadapter wurde wegen Abhängigkeiten in den alten Seiten nicht veröffentlicht. Es gibt keinen neuen anonymen Sitzungsspeicher-Endpunkt.

## Prüfung

- `node lichtloot-api/tests/access-security.test.mjs`
- `node lichtloot-api/tests/access-dispatch.test.cjs`
- `node lichtloot-api/tests/player-recovery.test.cjs` (PGlite)
- `node lichtloot-api/tests/support.test.cjs`
- `node lichtloot-api/tests/access-browser.test.mjs` (Playwright, optional `PLAYWRIGHT_MODULE`)
- JavaScript-Syntaxprüfung aller geänderten HTML-Einstiegspunkte.

Tests verwenden ausschließlich synthetische Konten und lokale Datenbanken.
