import { betaArtifacts } from './addon-beta-manifest.js';
import { materializeBetaArtifact } from './addon-beta-artifacts.js';

// Public installer downloads. Profile authentication remains in the Sync API.
export function installAddonBetaDownload(app, {
  encryptionKey = process.env.ADDON_BETA_FILE_KEY || '',
  artifacts = betaArtifacts,
  materialize = materializeBetaArtifact,
} = {}) {
  // Versionsauskunft für die Update-Prüfung in GuildLoot Sync (ohne Anmeldung, keine Download-Links).
  app.get('/api/addon-beta/version', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const summary = {};
    let version = null;
    for (const [platform, artifact] of Object.entries(artifacts)) {
      const match = /GuildLoot-Sync-(\d+\.\d+\.\d+)-/.exec(artifact.name || '');
      if (!match) continue;
      version = version || match[1];
      summary[platform] = { name: artifact.name, size: artifact.size, sha256: artifact.sha256 };
    }
    if (!version) return res.status(503).json({ error: 'Keine Sync-Version verfügbar.' });
    res.json({ success: true, version, artifacts: summary });
  });
  app.post('/api/addon-beta/download', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const platform = req.body?.platform;
    if (!['windows', 'mac-arm64', 'mac-x64'].includes(platform) || !Object.hasOwn(artifacts, platform)) {
      return res.status(400).json({error:'Bitte ein verfügbares Sync-Installationspaket auswählen.'});
    }
    if (!/^[a-f0-9]{64}$/i.test(encryptionKey)) return res.status(503).json({error:'Der Download ist gerade nicht verfügbar.'});
    try {
      const artifact = artifacts[platform];
      const downloaded = await materialize(artifact, encryptionKey);
      if (res.destroyed) return;
      const contentType = /\.pkg$/i.test(artifact.name) ? 'application/x-newton-compatible-pkg' : /\.exe$/i.test(artifact.name) ? 'application/x-msdownload' : artifact.type;
      return res.download(downloaded, artifact.name, {headers:{'Content-Type':contentType}}, error => {
        if (error && !res.headersSent) res.status(503).json({error:'Das Installationspaket konnte nicht heruntergeladen werden. Bitte erneut versuchen.'});
      });
    } catch (error) {
      console.warn('Sync installer download failed:', error.message);
      res.status(503).json({error:'Das Installationspaket ist gerade nicht verfügbar. Bitte erneut versuchen.'});
    }
  });
}
