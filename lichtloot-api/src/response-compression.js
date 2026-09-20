import compression from 'compression';

// Negotiate encoding with each client; older clients still receive plain data.
// Keep live event streams unbuffered and respect compression's no-transform rule.
export const responseCompression = compression({
  threshold: 1024,
  filter(req, res) {
    if (String(res.getHeader('Content-Type') || '').startsWith('text/event-stream')) return false;
    return compression.filter(req, res);
  },
});
