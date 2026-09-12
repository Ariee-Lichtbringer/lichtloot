# GuildLoot 0.24.24-beta

- Symbolleiste: GuildHeal-Symbol mit Haken (Frames ein-/ausblenden, Rechtsklick Einstellungen); GuildHeal auch in der Auswahl des GuildLoot-Hauptsymbols.
- Minimap-Symbol: Rechtsklick öffnet die Auswahl der Mini-Addons statt der Buffleiste.
- Berufsübersicht: Fenster mit –/+/1:1 verkleinern und vergrößern.
- Gildenbank: klarer Hinweis, wenn für die gewählte Gilde kein Bestand hinterlegt ist.

# GuildLoot 0.24.23-beta

- Eigenes GuildLoot-Symbol für das Whisper-Mini-Addon (Symbolleiste, Mini-Button und Auswahl im GuildLoot-Hauptsymbol).

# GuildLoot 0.24.22-beta

- Neues GuildLoot-Hauptsymbol (Mini-Button mit GuildLoot-Logo): Linksklick öffnet die Auswahl aller Mini-Addons (Hauptfenster, Raidsheet, Berufe, Raidcheck, Buffleiste, Gildenbank, Whisper, Rüstungsteile), Rechtsklick öffnet das Hauptfenster. Ein-/Ausblenden über die Symbolleiste im Hauptfenster oder /glehub.

# GuildLoot 0.24.21-beta

- Button „Gildenbank“ auf Mein Lichtloot neben „Charakter wechseln“.
- Gildenbank als Mini-Symbol: Linksklick auf das Bank-Symbol in der Symbolleiste (oder Haken) blendet ein frei verschiebbares Symbol ein, Rechtsklick öffnet die Gildenbank direkt.

# GuildLoot 0.24.20-beta

- Gildenbank-Fenster: /gle bank oder das neue Symbol im Hauptfenster öffnen den Bestand der Bankcharaktere mit Kategorien, Suche, Icons und Tooltips. Gegenstände lassen sich direkt beantragen; die Anträge gehen über GuildLoot Sync (ab 0.3.14) an die Gildenleitung.
- Reiter „Meine Anträge“ mit Status und „Export“ mit Übertragung über GuildLoot Sync.

# GuildLoot 0.24.19-beta

- Gildenbank-Export liest zusätzlich GBankClassic (Revived): Ist das Addon geladen, exportiert /gle bank alle darin synchronisierten Bankcharaktere auf einmal. Ohne GBankClassic wird wie bisher die eigene Bank des Charakters exportiert.

# GuildLoot 0.24.18-beta

- Gildenbank: Bankcharaktere erzeugen mit /gle bank einen Export von Bank und Taschen. Die Gildenleitung importiert ihn auf lichtloot.de unter Gildenbank → Einstellungen; der Bestand wird dort angezeigt und ist Grundlage für Gildenbankanträge.
- /gle hilfe nennt den neuen Befehl.

# GuildLoot 0.24.17-beta

- Eigene Symbole im GuildLoot-Design für die Mini-Addons Berufe, Buffs und Raidcheck, im Hauptfenster und als freie Schaltflächen.
- Buffleiste direkt aus dem Hauptfenster ein- und ausschalten; Rechtsklick auf das Buff-Symbol öffnet die Buffübersicht.
- Neue Kurzbefehle: /gle berufe, /gle check, /gle buffs und /gle hilfe mit einer Übersicht aller Befehle.

# GuildLoot 0.24.16-beta

- Buff-Meldung im Raidchat nur noch nach eigenem Zauber: „hat Gruppe … gebufft“ erscheint ausschließlich, wenn der eigene Charakter den Gruppenbuff tatsächlich gewirkt hat. Auffrischungen fremder Buffs lösen keine Meldung mehr aus.
- Berufe ohne GuildLoot-Account: Berufsfenster, Berufe-Datenbank, Skillguides und das Berufe-Symbol funktionieren ohne Sync-Verbindung.
- Nur „Berufe synchronisieren“ (charübergreifende Speicherung auf GuildLoot) benötigt weiterhin einen Lichtloot- oder Nachtloot-Account mit GuildLoot Sync.

# GuildLoot 0.24.15-beta

- Banktransfer beschleunigt: bestätigte Verschiebungen werden ohne die bisherige feste Wartezeit weiterverarbeitet.
- Reagiert auf Taschen- und Sperrstatusänderungen; verarbeitet mehrere bereits bestätigte Verschiebungen im selben Bildaufbau.
- Verhindert weiterhin doppelte Entnahmen bei verzögerten Serverantworten. Mengenprüfung, Stapelaufteilung und Abbruch bei geschlossener Bank oder Kampf bleiben erhalten.
- Gilt für das Auffüllen aus der Bank und das Zurücklegen.
- Enthält Mats-Übersicht mit Icons, Scrollleisten, erweiterte Classic-Itemsuche, Sonnenfrucht und automatischen Reagenzien-Nachkauf.
