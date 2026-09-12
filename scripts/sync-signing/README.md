# Windows-Signierung von GuildLoot Sync (Azure Trusted Signing)

Signiert App, Installer und Deinstaller beim Build auf dem Mac mit jsign, damit Windows SmartScreen keine Warnung mehr zeigt.

## Einmalige Einrichtung (Azure-Portal, nur durch die Kontoinhaberin)
1. Azure-Konto anlegen und ein Abonnement mit Zahlungsmethode hinterlegen.
2. Ressource **Trusted Signing Account** anlegen (Region West Europe, SKU Basic).
3. Unter **Identity validation** eine Prüfung starten (Einzelperson: Name, Adresse, Ausweis; dauert 1–7 Tage).
4. Nach erfolgreicher Prüfung ein **Certificate profile** vom Typ *Public Trust* anlegen.
5. In Microsoft Entra eine **App registration** anlegen, dazu ein **Client secret** erzeugen.
6. Im Trusted-Signing-Konto der App die Rolle **Trusted Signing Certificate Profile Signer** zuweisen.

## Zugangsdaten auf dem Build-Mac (nie ins Repo)
Datei `~/.guildloot-signing.env` mit:

    AZURE_TENANT_ID=…
    AZURE_CLIENT_ID=…
    AZURE_CLIENT_SECRET=…
    TRUSTED_SIGNING_ENDPOINT=https://weu.codesigning.azure.net
    TRUSTED_SIGNING_ACCOUNT=<Kontoname>
    TRUSTED_SIGNING_PROFILE=<Profilname>

Rechte: `chmod 600 ~/.guildloot-signing.env`.

## Voraussetzungen auf dem Mac
- Java: `brew install openjdk` (Pfad /opt/homebrew/opt/openjdk/bin/java)
- jsign: /private/tmp/guildloot-builder-tools/jsign/jsign.jar (GitHub-Release ebourg/jsign)

## Verwendung
- electron-builder: in builder.json unter `win` den Eintrag `"sign": "<Pfad>/scripts/sync-signing/sign-windows.cjs"` setzen. Der Builder ruft das Skript für jede .exe auf.
- Manuell prüfen: `node scripts/sync-signing/sign-windows.cjs pfad/zur/Datei.exe`
- Ohne Zugangsdaten läuft der Build unsigniert weiter und meldet das im Log.
