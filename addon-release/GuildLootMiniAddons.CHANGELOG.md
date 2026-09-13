# GuildLoot Mini-Addons 1.1.4-beta

- GuildBuff, GuildSkills, GuildRaidBag: Liefen bisher trotz installiertem GuildLoot Era parallel weiter, weil die Prüfung „ist GuildLoot Era aktiv?“ beim eigenen Laden lief und WoW die Mini-Addons alphabetisch vor GuildLoot Era lädt. Folge: doppelter Buffcheck und Meldungen wie „… hat Gruppe 1 gebufft“ im Raidchat, obwohl im GuildLoot-Buffpanel „Raidchat: aus“ stand (GuildBuff hatte seine eigene Einstellung). Jetzt lädt GuildLoot Era per OptionalDeps zuerst, zusätzlich zählt ein aktiviertes, ladbares GuildLoot Era als aktiv.
- GuildHeal: Klicks auf Felder blieben im Raid manchmal ohne Wirkung (und der Zauberbalken zeigte entsprechend nichts). Ursache: Die Felder lagen auf Ebene LOW, Addon-Fenster wie das GuildLoot-Buffpanel auf MEDIUM. Im Raid reichte das 8-spaltige Raster unter solche Fenster, die den Klick schluckten. Die Felder liegen jetzt standardmäßig auf Ebene HIGH über Addon-Fenstern; abschaltbar unter Anzeige → „Felder über Addon-Fenstern“.
- GuildHeal: Wird GuildHeal ausgeblendet (Haken in der GuildLoot-Seitenleiste oder /gheal), verschwindet jetzt auch der eigene Zauberbalken und Blizzards Balken kommt zurück; ebenso bleiben die „bereit“-Meldungen der Cooldown-Leiste aus. Beim Einblenden kommt beides wieder, auch im Kampf.
- GuildHeal schneller: Notfall- und Überheilungsprüfung laufen 10-mal pro Sekunde statt in jedem Frame über alle Felder (Animationen bleiben flüssig). Die Namenslisten für Boss-Debuffs, ignorierte Debuffs, beobachtete Auren und fehlende Buffs werden gecacht statt bei jedem Aura-Ereignis je Feld über Zauberabfragen neu aufgebaut. Spürbar in 40er-Raids, wo Aura-Ereignisse sehr häufig sind.
- GuildHeal, zweite Leistungsrunde: Einheiten-Events (Leben, Mana, Auren) werden je Feld bis zum nächsten Frame gesammelt statt jedes Ereignis sofort zu verarbeiten; Auren und Debuffs werden in einem Durchlauf gelesen statt in zwei; Symbolplätze werden nicht mehr bei jeder Aura-Änderung neu verankert; die Einstellungstabelle wird nicht mehr bei jedem Zugriff komplett durchlaufen; Reichweiten-, Bedrohungs- und Leucht-Anzeigen werden nur noch bei Änderung gesetzt; die Cooldown-Leiste wird höchstens 5-mal pro Sekunde neu gezeichnet; Tank-Erkennung wird 3 Sekunden gemerkt.
- GuildHeal: Felder, die beim Einheitenwechsel oder Gruppenwechsel noch versteckt waren, bekamen bis zur nächsten Gruppenänderung keine Lebens-Events mehr (Balken hingen oder liefen verzögert nach). Die Zuordnung Einheit→Feld wird jetzt beim Anzeigen, Verstecken und Einheitenwechsel im nächsten Frame neu aufgebaut, das Feld sofort komplett aktualisiert. Zusätzlich wird UNIT_HEALTH_FREQUENT ausgewertet, falls der Client es liefert.
- GuildHeal: Neuer Befehl /gheal cpu misst die CPU-Zeit je Addon (Messung einschalten, /reload, im Raid spielen, /gheal cpu zeigt die Verteilung; /gheal cpu aus beendet die Messung).
- GuildHeal: Rechtsklick auf ein Feld oder den Spielernamen öffnet kein Blizzard-Einheitenmenü mehr (Freund hinzufügen, Flüstern …). Der Namensbereich reagiert nur noch auf Linksklick (anvisieren), Rechtsklick bleibt frei für eigene Klickzauber. Die Aktion „Einheitenmenü“ ist aus der Auswahl entfernt; alte Belegungen damit werden geleert.

# GuildLoot Mini-Addons 1.1.3-beta

- GuildHeal: Einstellungen lassen sich in das GuildLoot-Era-Hauptfenster einbetten (Seitenleiste → Werkzeuge → GuildHeal).
- GuildHeal: Kein Spieler-Tooltip mehr beim Überfahren der Felder, solange „Tooltip beim Überfahren“ aus ist. Bisher zeigte die Blizzard-Vorlage der Felder den Tooltip trotzdem an.
- GuildHeal: Zauberliste zeigt alle Ränge, auch wenn im Zauberbuch „Alle Zauberränge anzeigen“ aus ist. Die Ränge kommen aus den bekannten Zauber-IDs statt aus dem Zauberbuch; Rangtexte werden nachgeladen und die Liste danach neu aufgebaut. Feste Ränge wie Blitzheilung(Rang 5) gelten damit wieder als bekannt.
- Alle vier Mini-Addons tragen die gemeinsame Version 1.1.3-beta.

# GuildLoot Mini-Addons 1.1.2-beta

- GuildHeal: Reiter Tasten (Maus über Feld + Taste), Reiter Design (Anordnung, Text, Balken, Schrift, Farben), Reiter Warnungen, Modus „UI bearbeiten“ mit Griffen, Cooldown-Leiste frei platzierbar mit Bereit-Meldung, Ziel- und Tankfelder, Heilklick visiert wahlweise an, Priester-Vorbelegung mit festen Rängen.
- GuildRaidBag: Argentumdämmerung-Bufffood und Manakekse im Nachkauf, mehrere Stapel pro Kauf, Hinweise unter der Liste.

# GuildLoot Mini-Addons 1.1.1-beta

- GuildHeal: Heilvorhersage über LibHealComm-4.0 (kompatibel mit VuhDo/HealBot/Grid), Klickzauber je Modifikator für Maustaste 1–5 und Mausrad mit Freitext (Zauber mit Rang, Makro, Gegenstand, Aktionen), Tasten bei Maus über einem Feld, Ketten mit Schmuckstücken und Zusatzzaubern, Klick auf den Namen visiert an, optional visiert jeder Heilklick an.
- GuildHeal: Boss-Debuffs, HoT-Symbole mit Restzeit, Abklingzeiten, Aggro/Bedrohung, Notfall-, Überheilungs- und Mana-Warnung, Tank- und Zielfelder, Farbstufen, Profile je Charakter, Sortierung, Griff mit Zahnrad.
- GuildSkills: Berufefenster mit –/+/1:1 verkleinern und vergrößern.

# GuildLoot Mini-Addons 1.1.0-beta

- Neu: GuildHeal – einfache Heilerframes mit vorbelegten Klickzaubern je Klasse, Debuff-Anzeige, Reichweite, Manabalken. /gheal öffnet die Einstellungen.
- GuildSkills, GuildBuff und GuildRaidBag unverändert (Versionsangleich für das Paket).

# GuildLoot Mini-Addons 1.0.2-beta

Ein Paket mit drei eigenständigen Addons für WoW Classic Era, jedes ohne GuildLoot-Account nutzbar. Ist GuildLoot Era installiert, deaktivieren sie sich selbst, weil die Funktionen dort enthalten sind.

- **GuildSkills** – Berufsübersicht aller Charaktere, Berufe-Datenbank mit Zutaten, Skillguides mit Materialplan, Mengenrechner. /gskills
- **GuildBuff** – Raid-Buffcheck nach Spieler und Gruppe, feste Buffeinteilung, Ablaufwarnungen, Erinnerung per Flüstern, Chatmeldung nach eigenem Buff, Seelenstein-Leiste. /gbuff
- **GuildRaidBag** – Checklisten je Raid, Taschen- und Ausrüstungsprüfung, Auffüllen aus der Bank, Mats-Übersicht, Itemsuche. /grb

Jedes Addon liegt in einem eigenen Ordner und kann in WoW einzeln aktiviert oder deaktiviert werden.
