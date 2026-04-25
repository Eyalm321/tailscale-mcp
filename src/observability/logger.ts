import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { AppConfig } from "../config/env.js";
import { redact } from "./redaction.js";

export type LogLevelName = "debug" | "info" | "warn" | "error";

const logRank: Record<LogLevelName, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface AppLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  flush(): Promise<void>;
  close(): Promise<void>;
}

export function createLogger(
  config: Pick<AppConfig, "LOG_LEVEL" | "MCP_SERVER_LOG_FILE">,
): AppLogger {
  const level = config.LOG_LEVEL;
  const logFile = config.MCP_SERVER_LOG_FILE;

  if (logFile) {
    mkdirSync(dirname(logFile), { recursive: true });
  }

  function write(entryLevel: LogLevelName, message: string, args: unknown[]) {
    if (logRank[entryLevel] < logRank[level]) {
      return;
    }

    const record = {
      ts: new Date().toISOString(),
      level: entryLevel,
      message,
      args: args.length > 0 ? args : undefined,
    };
    const line = `${redact(record)}\n`;

    if (logFile) {
      appendFileSync(logFile, line, "utf8");
      return;
    }

    process.stderr.write(line);
  }

  return {
    debug: (message, ...args) => write("debug", message, args),
    info: (message, ...args) => write("info", message, args),
    warn: (message, ...args) => write("warn", message, args),
    error: (message, ...args) => write("error", message, args),
    flush: async () => {},
    close: async () => {},
  };
}
