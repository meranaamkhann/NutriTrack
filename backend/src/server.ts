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
  // Don't hang forever on idle keep-alive connections.
  const force = setTimeout(() => {
    logger.warn("shutdown timed out, exiting");
    process.exit(1);
  }, 10_000);
  force.unref();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  server.closeIdleConnections?.();
  await pool.end();
  process.exit(0);
}

process.on("unhandledRejection", (reason) => logger.error({ err: reason }, "unhandled promise rejection"));
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaught exception");
  void shutdown("uncaughtException");
});

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
