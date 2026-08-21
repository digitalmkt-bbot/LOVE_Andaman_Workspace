import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { closePool } from '@la/db';

/** How long a graceful shutdown gets before we stop being graceful. */
const SHUTDOWN_DEADLINE_MS = 10_000;

const config = loadConfig();
const app = await buildApp(config);

let shuttingDown = false;

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, 'shutting down');

    // Without this, a close() that hangs on an in-flight query or an undrained
    // socket leaves the container sitting until the platform's SIGKILL.
    const deadline = setTimeout(() => {
      app.log.error({ ms: SHUTDOWN_DEADLINE_MS }, 'graceful shutdown timed out; forcing exit');
      process.exit(1);
    }, SHUTDOWN_DEADLINE_MS);
    deadline.unref();

    void (async () => {
      let code = 0;
      try {
        await app.close();
        await closePool();
      } catch (err) {
        // A rejection here would otherwise surface as an unhandled rejection
        // and never reach process.exit at all.
        app.log.error({ err }, 'error during shutdown');
        code = 1;
      } finally {
        clearTimeout(deadline);
        process.exit(code);
      }
    })();
  });
}

try {
  await app.listen({ port: config.PORT, host: config.HOST });
} catch (err) {
  app.log.error({ err }, 'failed to start');
  // The pool may already hold a connection even though listen() failed.
  await closePool().catch(() => undefined);
  process.exit(1);
}
