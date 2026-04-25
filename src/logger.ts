import { appendFile, writeFile } from "node:fs/promises";
import { redact } from "./observability/redaction.js";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogEntry {
  message: string;
  resolve: () => void;
  reject: (error: Error) => void;
}

class Logger {
  private level: LogLevel;
  private logFilePath: string | null = null;
  private readonly writeQueue: LogEntry[] = [];
  private isProcessingQueue = false;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;

    if (process.env.MCP_SERVER_LOG_FILE) {
      let logPath = process.env.MCP_SERVER_LOG_FILE;
      if (logPath.includes("{timestamp}")) {
        const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
        logPath = logPath.replace("{timestamp}", timestamp);
      }
      this.logFilePath = logPath;
      this.initializeLogFile(level).catch((error) => {
        process.stderr.write(`Failed to create log file: ${error}\n`);
      });
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private async initializeLogFile(level: LogLevel): Promise<void> {
    if (!this.logFilePath) return;

    await writeFile(
      this.logFilePath,
      `=== Tailscale MCP Server Log ===\nStarted: ${new Date().toISOString()}\nLog Level: ${LogLevel[level]}\n\n`,
      "utf8",
    );
  }

  private async writeToFileAsync(message: string): Promise<void> {
    if (!this.logFilePath) return;

    return new Promise((resolve, reject) => {
      this.writeQueue.push({ message: `${message}\n`, resolve, reject });
      this.scheduleQueueProcessing();
    });
  }

  private scheduleQueueProcessing(): void {
    if (this.isProcessingQueue || this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.processWriteQueue().catch((error) => {
        process.stderr.write(`Log write failed: ${error}\n`);
      });
    }, 100);
  }

  private async processWriteQueue(): Promise<void> {
    if (this.isProcessingQueue || this.writeQueue.length === 0) return;

    this.isProcessingQueue = true;
    const batch = this.writeQueue.splice(0, 50);
    const messages = batch.map((entry) => entry.message).join("");

    try {
      if (this.logFilePath) {
        await appendFile(this.logFilePath, messages, "utf8");
      }
      for (const entry of batch) entry.resolve();
    } catch (error) {
      for (const entry of batch) entry.reject(error as Error);
    } finally {
      this.isProcessingQueue = false;
    }

    if (this.writeQueue.length > 0) {
      this.scheduleQueueProcessing();
    }
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (level < this.level) return;

    const record = {
      ts: new Date().toISOString(),
      level: LogLevel[level],
      message,
      args: args.length > 0 ? args : undefined,
    };
    const line = redact(record);

    if (this.logFilePath) {
      this.writeToFileAsync(line).catch((error) => {
        process.stderr.write(`Async log write failed: ${error.message}\n`);
      });
      return;
    }

    process.stderr.write(`${line}\n`);
  }

  debug(message: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }

  logObject(level: LogLevel, message: string, obj: unknown): void {
    this.log(level, message, obj);
  }

  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    while (this.writeQueue.length > 0) {
      await this.processWriteQueue();
    }
  }

  async close(): Promise<void> {
    await this.flush();
    this.logFilePath = null;
  }
}

export const logger = new Logger(
  process.env.LOG_LEVEL
    ? Number.parseInt(process.env.LOG_LEVEL, 10)
    : LogLevel.INFO,
);

export { Logger };
