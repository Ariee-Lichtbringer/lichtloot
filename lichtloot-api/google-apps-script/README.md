# Automatic native Google Sheets

Deploy Code.gs as an Apps Script web app with the advanced Drive API v3 service enabled. Run as the owning Google account; allow web requests. Set GOOGLE_SHEETS_BRIDGE_URL on the API to the deployment /exec URL. The API sends its existing LICHTBOT_QUEUE_TOKEN in the HTTPS request body; the script validates it against the guild-scoped backfill preview before accessing Drive. No token is stored in the script.

Each raid is converted from the generated XLSX into a native Google Sheet in the ChatGPT folder, shared read-only by link. Drive appProperties and the API cache identify the guild, analysis and source digest. Regeneration updates the existing Google file, retaining its URL. XLSX remains the conversion source and optional download.

Each guild enables layout.logWorkbookAutoPost and selects its analysis destination. PO Bot uses the matching MC/BWL/AQ40/NAXX/ZG/AQ20/ONY thread under that channel, reopens archived unlocked threads, or creates a missing thread. Explicit thread IDs are also supported. Locked or ambiguous destinations fail without posting in the parent channel.

For correction of previously posted exports, the authenticated workbook-backfill endpoint accepts exact analysisIds (maximum five), dryRun:false, replaceExisting:true. A native Sheet URL replaces the old queue payload. Only after the new thread post succeeds does the bot delete the old message, validating its bot author, guild and exact raid footer. Normal retries edit the existing raid post.
