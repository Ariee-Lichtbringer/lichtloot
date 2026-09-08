import { createHash, timingSafeEqual, createDecipheriv } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

export function installAddonBetaDownload(app, {
  pinHash = process.env.ADDON_BETA_PIN_SHA256 || '',
  encryptionKey = process.env.ADDON_BETA_FILE_KEY || '',
  file = fileURLToPath(new URL('../private/GuildLootEra-beta.enc', import.meta.url)),
  now = Date.now,
} = {}) {
  const attempts = new Map();
  const windowMs = 15 * 60 * 1000;
  app.post('/api/addon-beta/download', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!/^[a-f0-9]{64}$/i.test(pinHash) || !/^[a-f0-9]{64}$/i.test(encryptionKey)) return res.status(503).json({error:'Der Beta-Download ist noch nicht freigeschaltet.'});
    const time = now();
    for (const [key, value] of attempts) if (value.until <= time) attempts.delete(key);
    const key = req.ip;
    const attempt = attempts.get(key) || {count:0, until:time + windowMs};
    if (attempt.count >= 5) {
      res.set('Retry-After', String(Math.ceil((attempt.until-time)/1000)));
      return res.status(429).json({error:'Zu viele Versuche. Bitte in 15 Minuten erneut versuchen.'});
    }
    const pin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
    const actual = createHash('sha256').update(pin).digest();
    if (!/^\d{8}$/.test(pin) || !timingSafeEqual(actual, Buffer.from(pinHash, 'hex'))) {
      attempt.count++; attempts.set(key, attempt);
      return res.status(403).json({error:'Falsche PIN. Bitte versuche es erneut.'});
    }
    attempts.delete(key);
    try {
      // Only the server has the independent AES key; the repository holds ciphertext.
      const encrypted = await readFile(file);
      const decipher = createDecipheriv('aes-256-gcm', Buffer.from(encryptionKey, 'hex'), encrypted.subarray(0, 12));
      decipher.setAuthTag(encrypted.subarray(12, 28));
      const zip = Buffer.concat([decipher.update(encrypted.subarray(28)), decipher.final()]);
      res.attachment('GuildLootEra-0.19.0-beta.zip').type('application/zip').send(zip);
    } catch {
      res.status(503).json({error:'Die Beta-Datei ist gerade nicht verfügbar.'});
    }
  });
}
