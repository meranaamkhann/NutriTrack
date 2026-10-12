import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { pool } from "./db/client.js";
import { deleteExpiredExportFiles } from "./modules/export/export.service.js";

const app = buildApp();

const server = app.listen(env.PORT, () => {
  logger.info(`nutritrack backend listening on :${env.PORT}`);
});

const exportCleanupInterval = setInterval(() => {
  deleteExpiredExportFiles().catch((err) => logger.error({ err }, "export cleanup failed"));
}, 15 * 60 * 1000);
deleteExpiredExportFiles().catch((err) => logger.error({ err }, "export cleanup failed"));

async function shutdown(signal: string) {
  logger.info(`received ${signal}, shutting down`);
  clearInterval(exportCleanupInterval);
  server.close();
  await pool.end();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
