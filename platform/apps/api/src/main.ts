import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { closePool } from '@la/db';

const config = loadConfig();
const app = await buildApp(config);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.log.info({ signal }, 'shutting down');
    void (async () => {
      await app.close();
      await closePool();
      process.exit(0);
    })();
  });
}

try {
  await app.listen({ port: config.PORT, host: config.HOST });
} catch (err) {
  app.log.error({ err }, 'failed to start');
  process.exit(1);
}
