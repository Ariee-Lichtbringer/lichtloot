import { betaArtifacts } from './addon-beta-manifest.js';
import { materializeBetaArtifact } from './addon-beta-artifacts.js';

// Public installer downloads. Profile authentication remains in the Sync API.
export function installAddonBetaDownload(app, {
  encryptionKey = process.env.ADDON_BETA_FILE_KEY || '',
  artifacts = betaArtifacts,
  materialize = materializeBetaArtifact,
} = {}) {
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
      return res.download(downloaded, artifact.name, {headers:{'Content-Type':artifact.type}}, error => {
        if (error && !res.headersSent) res.status(503).json({error:'Das Installationspaket konnte nicht heruntergeladen werden. Bitte erneut versuchen.'});
      });
    } catch (error) {
      console.warn('Sync installer download failed:', error.message);
      res.status(503).json({error:'Das Installationspaket ist gerade nicht verfügbar. Bitte erneut versuchen.'});
    }
  });
}
