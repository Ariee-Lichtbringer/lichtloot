// Share schema work within this process; cache only a committed initialization.
// A dedicated connection keeps it independent of caller transactions.
export function createSchemaInitialization(pool, { now = Date.now, retryMs = 5000 } = {}) {
  const tasks = new Map();
  return function ensureSchema(name, initialize) {
    const existing = tasks.get(name);
    if (existing && (existing.pending || existing.ready || now() < existing.retryAt)) {
      return existing.promise;
    }
    const task = { pending: true, ready: false, retryAt: 0 };
    task.promise = Promise.resolve().then(async () => {
      let client;
      try {
        client = await pool.connect();
        await client.query('begin');
        await client.query("set local lock_timeout = '2s'");
        await initialize(client.query.bind(client));
        await client.query('commit');
        task.ready = true;
      } catch (error) {
        if (client) await client.query('rollback').catch(() => {});
        task.retryAt = now() + retryMs;
        throw error;
      } finally {
        task.pending = false;
        client?.release();
      }
    });
    tasks.set(name, task);
    return task.promise;
  };
}
