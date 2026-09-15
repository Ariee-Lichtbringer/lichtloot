import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const digest = value => createHash('sha256').update(String(value)).digest('hex');
const normalize = value => String(value || '').trim().normalize('NFC').toLowerCase();
export const sensitiveKey = key => /^(?:pin|.*pin|mastercode|newcode|password|securityanswer|token|queuetoken|authorization)$/i.test(key);

export function redactAccessDetails(value) {
  return String(value ?? '')
    .replace(/([?&](?:[\w-]*pin|mastercode|newcode|password|securityanswer|token|queuetoken|authorization)=)[^&#\s"'<>]*/gi, '$1[REDACTED]')
    .replace(/("(?:[\w-]*pin|mastercode|newcode|password|securityanswer|token|queuetoken|authorization)"\s*:\s*")[^"]*/gi, '$1[REDACTED]')
    .replace(/(\/players\/by-pin\/)[^/\s?#]+/gi, '$1[REDACTED]');
}

export async function hashSecurityAnswer(value) {
  if (!normalize(value)) return null;
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(normalize(value), salt, 32, { N: 32768, r: 8, p: 1, maxmem: 67108864 });
  return `scrypt-v1$${salt}$${hash.toString('hex')}`;
}

export async function verifySecurityAnswer(stored, value) {
  if (!value || typeof stored !== 'string') return false;
  const [version, salt, hash, extra] = stored.split('$');
  if (version !== 'scrypt-v1' || extra !== undefined || !/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{64}$/.test(hash || '')) return false;
  const actual = await scrypt(normalize(value), salt, 32, { N: 32768, r: 8, p: 1, maxmem: 67108864 });
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'));
}

// Compare-and-set preserves concurrent recovery changes. No answers enter logs.
export async function migrateSecurityAnswers(query) {
  let count = 0;
  for (;;) {
    const { rows } = await query("select id,security_answer from players where coalesce(security_answer,'')<>'' and security_answer not like 'scrypt-v1$%' limit 50");
    if (!rows.length) return count;
    for (const row of rows) {
      const hash = await hashSecurityAnswer(row.security_answer);
      const result = await query('update players set security_answer=$1 where id=$2 and security_answer=$3', [hash, row.id, row.security_answer]);
      count += result.rowCount || 0;
    }
  }
}

export function installAccessSecurity(app, { allowedOrigins, now = Date.now, enforceTransport = true } = {}) {
  const attempts = new Map();
  const period = 15 * 60 * 1000;
  function prune() { for (const [key, value] of attempts) if (value.expires <= now()) attempts.delete(key); }
  const timer = setInterval(prune, 60000);
  timer.unref?.();
  function bucket(key) {
    key = digest(key);
    let entry = attempts.get(key);
    if (!entry || entry.expires <= now()) {
      if (attempts.size >= 100000) { prune(); if (attempts.size >= 100000) return null; }
      entry = { expires: now() + period, count: 0, values: new Set() };
      attempts.set(key, entry);
    }
    return entry;
  }
  function limit(key, max) { const entry = bucket(key); return entry && ++entry.count <= max; }
  app.use('/api', (req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' });
    const origin = req.get('Origin');
    if (origin && !allowedOrigins.has(origin)) return res.status(403).json({ success: false, error: 'Diese Herkunft ist für API-Zugriffe nicht freigegeben.' });
    const rejectUrlCredentials = enforceTransport === true || (enforceTransport === 'browser' && Boolean(origin || req.get('Sec-Fetch-Mode')));
    if (rejectUrlCredentials && (Object.keys(req.query || {}).some(sensitiveKey) || /\/players\/by-pin\//.test(req.path))) {
      return res.status(400).json({ success: false, code: 'CREDENTIALS_IN_URL', error: 'Zugangsdaten dürfen nicht in der URL stehen. Bitte die Seite neu laden oder den Client aktualisieren.' });
    }
    if (rejectUrlCredentials && req.query?.callback) return res.status(400).json({ success: false, error: 'JSONP wird nicht mehr unterstützt. Bitte JSON per POST verwenden.' });
    const params = { ...req.query, ...req.body };
    const hasCredential = Object.entries(params).some(([key, value]) => sensitiveKey(key) && typeof value === 'string' && value)
      || /\/players\/by-pin\//.test(req.path);
    let allowed = true;
    if (hasCredential) {
      const entry = bucket(`failed-access|${req.ip}`);
      allowed = Boolean(entry && entry.count < 30);
      if (allowed) {
        const originalJson = res.json;
        let counted = false;
        res.json = function(body) {
          const characterLookup = params.action === 'getCharactersByPin' || /\/players\/(?:characters$|by-pin\/)/.test(req.path);
          const emptyLogin = characterLookup && Array.isArray(body?.characters) && body.characters.length === 0;
          if (!counted && (emptyLogin || res.statusCode >= 400 || body?.success === false || body?.error)) {
            counted = true;
            entry.count++;
          }
          return originalJson.call(this, body);
        };
      }
    }
    if (/^(createPlayerPin|resetPlayerPin|resetPlayerPinBySecurity|resolveGuildByPin)$/.test(String(params.action || ''))) allowed = limit(`account-access|${req.ip}`, 20) && allowed;
    if (params.action === 'resetPlayerPinBySecurity') {
      // Also bound distributed guessing against one account. The key contains no
      // clear-text name or answer, and does not depend on the submitted question.
      const account = [params.guild || params.guildSlug || '', params.char || params.charName || '', params.server || ''].map(normalize).join('|');
      allowed = limit(`recovery|${account}`, 5) && allowed;
    }
    if (!allowed) {
      res.set('Retry-After', '900');
      return res.status(429).json({ success: false, error: 'Zu viele Zugriffsversuche. Bitte in 15 Minuten erneut versuchen.' });
    }
    next();
  });
  return { close: () => clearInterval(timer) };
}
