import "dotenv/config";
import { createMcpServer } from "./app/create-server.js";
import { loadConfig, parseCliOverrides } from "./config/env.js";
import { startHttpTransport } from "./mcp/transports/http.js";
import { startStdioTransport } from "./mcp/transports/stdio.js";
import { createLogger } from "./observability/logger.js";

async function main(): Promise<void> {
  const config = loadConfig(process.env, parseCliOverrides());
  const logger = createLogger(config);

  try {
    if (config.MCP_TRANSPORT === "http") {
      await startHttpTransport({ config, logger });
      return;
    }

    const server = await createMcpServer({ config, logger });
    await startStdioTransport({ server, logger });
  } catch (error) {
    logger.error("Fatal startup error", error);
    await logger.close();
    process.exit(1);
  }
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exit(1);
});
