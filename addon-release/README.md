# GuildLoot CurseForge releases

Project: 1689420. Token: repository Actions secret CF_API_TOKEN.

For each approved release, update GuildLootEra.zip, CHANGELOG.md and release.json together in one main-branch commit. release.json contains the version and ZIP SHA-256. That commit triggers the CurseForge workflow automatically. Website-only changes do not upload an addon.

Actions → Publish GuildLoot to CurseForge → Run workflow defaults to validation only; enable the publish checkbox for an explicitly requested upload.

The workflow validates the clean ZIP and TOC, verifies the CurseForge connection, selects Classic Era 1.15.9 and publishes a beta with its changelog. A curseforge-upload/VERSION tag reserves each version before the external upload. Re-running an already reserved version stops before sending another file. If a network failure occurs, inspect CurseForge and the workflow receipt before any retry. Never delete a reservation without checking whether its file was received.

Successful uploads store the CurseForge file ID and URL in a workflow artifact and the run summary. CurseForge may still need to approve the file.

No secret belongs in this folder. Update the manifest game version and compatibility validation together when a different Classic Era client is supported.

API: https://support.curseforge.com/support/solutions/articles/9000197321
Classic Era version-type mapping: https://github.com/BigWigsMods/packager/blob/master/release.sh
