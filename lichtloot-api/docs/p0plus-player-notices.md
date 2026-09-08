# Persönliche P0+-Nachrichten

Migration 042 erzeugt für neue `raid_transfer`- und `item_received_clear`-
Audit-Einträge einen Auftrag vom Typ `p0plus_points_notice`. Er wird in derselben
Transaktion gespeichert; ein Rollback verwirft Punkteänderung und Nachricht.
Vorgemerkter Item-Erhalt, manuelle Korrekturen und Null-Punkte-Übertragungen
lösen keine Übertragungs-DM aus. Frühere Audit-Einträge werden nicht nachversandt.

Der Empfänger wird anhand der Discord-Verknüpfung des Charakters bzw. seines
Spielerkontos innerhalb derselben Gilde ermittelt, niemals anhand eines frei
angegebenen Namens oder einer Rolle. Ohne Verknüpfung bleibt ein fehlgeschlagener
Auftrag mit entsprechendem Grund sichtbar. Blockierte DMs werden ebenfalls
als Zustellfehler erfasst; die Punkteänderung bleibt bestehen.

Der Bot zeigt Raidtermin, Item, Veränderung und Stand zum Zeitpunkt der Buchung.
Der neue Stand betrifft das genannte Item im jeweiligen Punktebereich.
Der bestehende Zustellmechanismus verwendet Empfangsbelege und sucht bei
Wiederholungen nach dem Auftragsmarker in der DM, bevor er erneut sendet.
Der eindeutige Audit-Schlüssel verhindert doppelte Aufträge für denselben
Audit-Eintrag. Die bestehenden Übertragungs-/Item-Erhalt-Abläufe verhindern
wiederholte Buchungen desselben Vorgangs.
