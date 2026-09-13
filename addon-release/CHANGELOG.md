# GuildLoot 0.26.0-beta

- Neuer Bereich „RMD“ (Knopf neben dem Gildenwechsel): Random-Raids ohne Gilde getrennt von den Gildenraids. Dort „+ RMD Raid erstellen“ (nur Prio-Raid, keine Erstellerrechte nötig), „Per PrioPIN öffnen“ für bestehende Random-Raids, Karten mit PrioPIN, Prio eintragen, Prio für einen Spieler (Lead-PIN), Prioliste, Prio öffnen und Plündermeister. Die Gildenansicht „Raids“ zeigt nur noch Gildenraids; die Anmeldeart „Prio-Raid (RMD)“ ist aus dem Gilden-Ersteller in den RMD-Bereich gezogen.
- RMD Raids landen wie „Random-Raid erstellen“ auf lichtloot.de in der Random-Datenbank (kein Gildeneintrag, Spieler ohne Gildenlogin tragen Prios über „Random-Raid öffnen“ ein). Erstellte oder per PIN geöffnete Raids erscheinen sofort als Platzhalterkarte („Wird angelegt“ bzw. „Wird geladen“) und nach dem nächsten Sync als vollständige Karte; Sync-Quittungen übernehmen Server-ID und gegebenenfalls ersetzte PINs. Benötigt GuildLoot Sync ab 0.3.20.
- Raid erstellen: Schrittanzeige und Vorschau ohne Überschneidungen; erstellte Raids erscheinen in der Liste, bevor der Sync sie bestätigt.
- Gildenwechsel in der Seitenleiste als Aufklappmenü „Gilde wechseln ▾“ mit allen importierten Gilden; daneben der Knopf „RMD“. Im RMD-Bereich lässt sich ein Random-Raid auch mit der Lead-PIN öffnen (Raidleitung).
- Werkzeugfenster (Berufe, Raidcheck, Buffs, Gildenbank, Whisper, Rüstungsteile) im Stil von GuildHeal: heller Schiefergrund, feiner Rahmen, Schließen-Knopf oben rechts und ein Griff unten rechts, der die Fenstergröße ändert (wird gespeichert). Whisper hat den hellen Hintergrund als neue Vorgabe „Schiefer“.
- RMD Raids als eigener Bereich in Lila unter den Werkzeugen. Prioliste der Raidleitung, Raidprotokoll und Plündermeister eines Random-Raids bleiben im RMD-Bereich (Raidauswahl zeigt dort nur Random-Raids, im Gildenbereich nur Gildenraids). Die RMD-Prioliste öffnet sich nur mit dem Lead-PIN des Raids, der Gildenleitungszugang gilt dort nicht.
- Raid löschen: Knopf „Löschen“ auf jeder Raidkarte und Eintrag „Raid löschen (archivieren)“ im Raidleitungsmenü. Der Raid wird über GuildLoot Sync auf der Website archiviert (RMD Raid nur mit Lead-PIN, Gildenraid mit Lead-PIN oder gespeichertem Gildenleitungszugang) und sofort aus der Liste genommen; bei Ablehnung erscheint er wieder. Benötigt GuildLoot Sync ab 0.3.20.
- GuildHeal-Einstellungen im GuildLoot-Fenster zeigen beim Öffnen sofort die Belegung des gespielten Charakters (vorher blieben die Felder leer, bis man neu öffnete).
- Selbst erstellte RMD Raids: das Addon kennt den Lead-PIN aus der Erstellung. Prioliste der Raidleitung und Plündermeister sind sofort offen; Prio öffnen, Prio für einen Spieler, Löschen und Protokoll-Upload nehmen den Lead-PIN automatisch, das Feld kann leer bleiben.
- Buffeinteilung auch ohne Schlachtzug: in einer Gruppe kommen die Spieler aus der Gruppe (Gruppenleiter verteilt), ohne Gruppe trägt man Spieler mit Name und Klasse selbst ein (Planung vorab, spontaner Raid). Die Einteilung wird lokal gespeichert und im Raid mit „Im Raid übernehmen“ an alle verteilt.
- Buffeinteilung: „Aus Sheet übernehmen“ liest die Tabelle „Buffeinteilung“ des synchronisierten Raidsheets (Spalten Priester/Magier/Druide, Zeilen Grp 1–8) in den Entwurf ein. Ohne Gruppe werden die Spieler dabei eingetragen, in der Gruppe nur Mitglieder gleicher Klasse; nicht zugeordnete Namen werden gemeldet. Paladinspalten bleiben aus, weil Segen je Klasse statt je Gruppe verteilt werden.
- Werkzeugfenster: Hintergrund zentral unter Einstellungen · Sync → „Werkzeugfenster ▾“ wählbar (Dunkel, Schiefer, Anthrazit, Warmes Dunkel, eigene Farbe über den WoW-Farbwähler, Deckkraft). Gilt für Berufe, Raidcheck, Buffs, Gildenbank und Rüstungsteile; Vorgabe ist ein dunkleres Schiefer. Der Rahmen ist jetzt eine echte Kante und überdeckt den Hintergrund nicht mehr (daher wirkten die Fenster zu hell).
- Whisper: Hintergrund frei wählbar („Eigene Farbe …“ mit Farbwähler), Vorgaben wirken wieder sichtbar, Einstellungsfenster breiter; neuer Knopf „Alle gelesen“ setzt alle ungelesenen Nachrichten zurück.
- Raidcheck → Mats: das Mats-Fenster deckt jetzt die ganze Fläche (vorher schauten Symbole der Liste am Rand hervor). Reagenzien lassen sich mit × aus der Liste nehmen (Soll-Menge 0, ausgeblendet) und über „Entfernte anzeigen“ zurückholen; je Charakter gespeichert.
- Gildenraids löschen nur mit Gildenleitungs-PIN: der Knopf „Löschen“ ist ausgegraut, bis man sich einmal unter Plündermeister mit dem Gildenleitungs-PIN angemeldet hat; das Archivieren läuft dann über den gespeicherten Gildenleitungszugang ohne PIN-Feld. RMD Raids weiterhin mit Lead-PIN (bei eigenen automatisch).
- Bankleiste: sobald die Bank offen ist, erscheint über dem Bankfenster eine verschiebbare Leiste „Raidcheck · <Checkliste>“ mit „Einpacken“ (fehlende Checklisten-Gegenstände aus der Bank in die Taschen) und „Zurücklegen“ (wieder einlagern). Laufende Transfers lassen sich dort stoppen; die Position wird gespeichert.
- Buffleiste: in einer Gruppe werden alle Gruppenmitglieder eingelesen (bisher nur im Schlachtzug); die Paladin-Leiste zeigt nur Klassen, die in Gruppe oder Raid vorhanden sind. RMD-Karten zeigen „Prio eingetragen ✓“ statt der Kalenderanmeldung.
- Behoben: Raidleitungsmenü und Prio-Formular der Gilden- und RMD-Ansicht teilten sich intern einen Zustand, dadurch konnte „Prio für einen Spieler eintragen“ den Ersteller der jeweils anderen Ansicht öffnen.
- Buffleiste verschieben: Klick auf das Zahnrad halten und ziehen (Klick wechselt weiter die Ansicht). Die Position wird jetzt gespeichert.
- Seitenleiste: über „Einstellungen · Sync“ steht das GuildLoot-Symbol mit dem Haken „Mini-Icon anzeigen“; er blendet den frei verschiebbaren GuildLoot-Knopf ein, der alle Mini-Addons zur Auswahl anbietet.
- Prio-Formular eines Raids: „Charakter wechseln“ direkt neben dem Charakternamen; die Auswahl und eigenen Prios werden für den neuen Charakter geladen.
- Plündermeister-Freigabe der Gildenleitung: Charaktere mit dem Zugriffsrecht „Plündermeister im Addon – ohne PIN“ (Gildenleitung → Spielerlogins) haben im Addon dauerhaft Gildenleitungszugang (Prioliste der Raidleitung, Prio öffnen, Prio für Spieler, Raid löschen, Protokoll-Upload) ohne PIN-Eingabe. Kommt mit dem nächsten Sync-Abgleich; zurückgenommene Freigaben werden ebenso übernommen. Benötigt GuildLoot Sync ab 0.3.21.
- Loot-Leiste liegt jetzt über dem Plündermeister-Fenster (vorher konnte das Fenster sie verdecken) und ist als „Loot-Leiste“ in der Mini-Addon-Auswahl des GuildLoot-Symbols wählbar.
- Kompakte Buffleiste größer: Vorgabe 150 % (etwa wie PallyPower), einstellbar in den Buff-Einstellungen unter „Größe der kompakten Leiste“ von 80 bis 240 %.
- Buff- und Whisper-Einstellungen öffnen sich neben dem jeweiligen Fenster statt darüber; die Buffleiste bleibt beim Einstellen sichtbar.
- Plündermeister-Freigabe jetzt als Zugriffsrecht je Spieler: Gildenleitung → Spielerlogins → „+ Zugriffsrecht hinzufügen“ → „Plündermeister im Addon – ohne PIN“. Die Gildenleitung selbst ist automatisch freigegeben. Die Namensliste unter Raidregeln entfällt.
- Diese Version benötigt GuildLoot Sync ab 0.3.21. Das Addon zeigt die installierte Sync-Version unter Einstellungen · Sync und warnt beim Einloggen, wenn sie zu alt ist. Neuer Knopf „Sync aktualisieren“: die geöffnete Sync-App lädt das Update selbst und startet neu. Ältere Apps ohne Update-Knopf: „Sync-App herunterladen“ und das Paket ausführen, es ersetzt die alte App, Profile bleiben erhalten.
- Eingebettete Werkzeuge ohne eigenen Rahmen, Titel und Schließen-Knopf; „Buffs“ öffnet die Buffeinteilung, GuildHeal-Einstellungen erscheinen ebenfalls im Fenster (GuildHeal ab 1.1.2). Mini-Addon-Auswahl: Links- oder Rechtsklick öffnet das eigene Fenster.
- Raidkarten im Stil der Website-Kacheln: Raidsymbol, Titel mit Wochentag, Status-Pills (Anmeldung, Art, Prioliste veröffentlicht/verborgen), Kennzahlen, PrioPIN mit „PIN posten“, Knöpfe „Plündermeister“ und „Prio eintragen →“; Rahmen und Aktionsfarbe in der Gildenfarbe (Lichtloot gold, Nachtloot türkis; überschreibbar über den Sync-Import).
- Vergangen · Archiv zeigt aufgezeichnete Raids als gleiche Kacheln (Drops, Vergaben, Würfe, Status Läuft/Beendet/Archiviert); Klick öffnet das Protokoll, „‹ Vergangene Raids“ führt zurück.
- Werkzeuge aus der Seitenleiste (Raidcheck, Buffleiste, Berufe, Gildenbank, Whisper, Rüstungsteile) öffnen sich im GuildLoot-Fenster; beim Wechsel der Ansicht oder Schließen des Fensters wird das Werkzeugfenster wieder eigenständig, der Mini-Button öffnet es weiterhin einzeln.
- Mini-Addon-Auswahl am GuildLoot-Symbol: Haken rechts blendet das jeweilige Symbol bzw. die Leiste ein oder aus.
- Raidkarten unter Raids → Bevorstehend zeigen das Raidbild der Website (MC, BWL, AQ40, Naxx, ZG, AQ20, Onyxia) links auf der Karte; die Liste sitzt unter der Aktionsreihe.
- Neue Grundstruktur des Hauptfensters: Seitenleiste links mit Gilde und Charakter, Gildenwechsel, den Bereichen Start, Kalender, Raids und Plündermeister sowie allen Werkzeugen (Raidsheet, Raidcheck, Buffleiste, Berufe, Gildenbank, Whisper, Rüstungsteile, GuildHeal). Einstellungen und Sync-Stand unten in der Leiste. Die beiden Reiterzeilen entfallen, das Fenster ist 1110 px breit.
- Raids: eine Aktionsreihe mit Bevorstehend, Prio-Listen, P0+-Punkte, Raidsheet und Vergangen · Archiv. Die Raidseite (Karte öffnen) hat ein Menü „Raidleitung“ mit Prioliste der Raidleitung, Prio auf GuildLoot öffnen, Prio3 exportieren, PrioPIN posten, Prio für einen Spieler eintragen und Aufzeichnung.
- Plündermeister: Aktionsreihe nur noch Raidprotokoll, Prioliste, Plündermeister-Fenster und Loot-Leiste. Prio öffnen und Prio3 sind auf die Raidseite gezogen.
- Mini-Addon-Symbole (ein-/ausblenden) liegen jetzt unter Einstellungen · Sync statt in der Kopfzeile.

# GuildLoot 0.25.0-beta

- Nach dem Erstellen zeigt das Addon PrioPIN und Lead-PIN sofort an (die PINs werden im Addon erzeugt und von Sync übernommen), mit Status der Übertragung, „PIN posten“ in den Raidchat, „Flüstern“ an einen Spieler und einem kopierbaren Text für Discord. Frühere Erstellungen sind über „Erstellte Raids“ abrufbar.
- Raid erstellen: dritte Anmeldeart „Prio-Raid (RMD)“ wie „Random-Raid erstellen“ auf lichtloot.de: nur PrioPIN und Lead-PIN, kein Discord-Post, Gruppenname frei wählbar. Die PINs erscheinen nach /reload im Fenster; „PrioPIN im Raidchat posten“ schreibt Termin, PrioPIN und den Weg über www.lichtloot.de → Random-Raid öffnen in den Raid- oder Gruppenchat. Für jeden synchronisierten Raid gibt es „PIN posten“ (PrioPIN kommt mit GuildLoot Sync ab 0.3.19).
- Plündermeister-Fenster: Größe per −/+/1:1 oder Griff unten rechts, Position und Größe werden gespeichert. Unverteilte Items bleiben auch nach dem Schließen des Lootfensters in der Liste (Tasche); Vergabe ohne Lootfenster wird als Übergabe per Handel notiert und gemeldet.
- Loot-Leiste (/gle leiste oder Knopf im Plündermeister-Fenster): schlanke, halbtransparente, verschiebbare Liste der unverteilten Items mit Würfel-Knopf, Vergabe-Knopf und Entfernen je Zeile; sperrbar; Zustand wird gespeichert.
- Aktive Raids → Raid erstellen neu gestaltet: Instanz und Anmeldeart als Knöpfe, Vorlage und Discord-Channel mit Suchliste, Datum mit „Heute“ und „+7 Tage“, Vorschau des Raids, Schrittanzeige.
- Prio für einen Spieler eintragen (Raidleitung): wie „Prio speichern“ im Raidlead-Panel, mit Raidauswahl, Spieler, Server, Klasse, P1 bis P3 aus dem Raidkatalog, P0+, Lead-PIN oder gespeichertem Gildenleitungszugang. Benötigt GuildLoot Sync ab 0.3.19.
- Plündermeister-Fenster (/gle pm, Knopf im Raidprotokoll, öffnet sich beim Plündern automatisch): aktuelle Beute mit Prio-Inhabern, Würfeln mit Ankündigung und Auswertung der /roll-Würfe, Zuteilen über den Plündermeister-Modus (GiveMasterLoot) an berechtigte Spieler, Historie der laufenden Aufzeichnung mit Prio und Wurf.
- Raidmeldung beim Öffnen der Beute: jedes Item ab Lootschwelle wird einmal im Raidchat mit seinen Prio-Inhabern gemeldet (P0+/P0 zuerst, dann P1 bis P3, Bankspieler ausgelassen); Vergaben werden ebenfalls gemeldet. Abschaltbar im Fenster.
- Fenstertitel und Sync-Payload zeigen die installierte Version aus der TOC. Seit 0.24.15 stand dort fest „0.24.15-beta“.
- Prio3 Reforged Export: gleicher Text wie der Website-Export. Spieler, Leerspalte, Klasse und je Prio „Itemname-ID“ (bei Ziffern im Namen „ID-Itemname“, leer „-0“), Tab-getrennt, ohne Kopfzeile. Bisher gab das Addon nur Item-IDs mit Semikolon aus, was Prio3 nicht einlesen konnte.
- Itemnamen kommen aus der Prioliste, sonst aus dem Spielclient oder der Classic-Itemdatenbank. Onyxia exportiert wie die Website nur P1. Bankspieler bleiben ausgelassen.

# GuildLoot 0.24.25-beta

- Raidcheck Mats: Gesegnete Sonnenfrucht, Sonnenfruchtsaft, Angereicherter Manakeks (Argentumdämmerung) und Alterac Manakeks im Nachkauf; mehrere Stapel je Kauf; Hinweise rücken unter die Liste.
- Gildenbank: Hinweis, wenn für die gewählte Gilde kein Bestand hinterlegt ist.

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
