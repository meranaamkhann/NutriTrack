import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { pool } from "./db/client.js";

const app = buildApp();

const server = app.listen(env.PORT, () => {
  logger.info(`nutritrack backend listening on :${env.PORT}`);
});

async function shutdown(signal: string) {
  logger.info(`received ${signal}, shutting down`);
  server.close();
  await pool.end();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
