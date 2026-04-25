import {
  afterEach,
  beforeEach,
  describe,
  expect,
  type Mock,
  mock,
  spyOn,
  test,
} from "bun:test";
import { Logger, LogLevel } from "../../logger";

// Mock fs/promises
mock.module("fs/promises", () => ({
  writeFile: mock(() => Promise.resolve()),
  appendFile: mock(() => Promise.resolve()),
}));

describe("Logger", () => {
  let logger: Logger;
  let stderrSpy: Mock<typeof process.stderr.write>;

  beforeEach(() => {
    // Reset environment variables
    process.env.MCP_SERVER_LOG_FILE = undefined;

    stderrSpy = spyOn(process.stderr, "write").mockImplementation(
      () => true,
    ) as Mock<typeof process.stderr.write>;

    // Create a fresh logger instance with known level
    logger = new Logger(LogLevel.INFO);
  });

  afterEach(() => {
    // Restore all mocks
    mock.restore();
  });

  describe("constructor", () => {
    test("should create logger with default INFO level", () => {
      const defaultLogger = new Logger();
      expect(defaultLogger).toBeInstanceOf(Logger);
    });

    test("should create logger with specified level", () => {
      const debugLogger = new Logger(LogLevel.DEBUG);
      expect(debugLogger).toBeInstanceOf(Logger);
    });

    test("should not initialize file logging when MCP_SERVER_LOG_FILE is not set", () => {
      expect(process.env.MCP_SERVER_LOG_FILE).toBeUndefined();
      // Logger should still be created successfully
      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe("setLevel", () => {
    test("should update log level", () => {
      // Initially at INFO level, debug should not log
      logger.debug("test debug message");
      expect(stderrSpy).not.toHaveBeenCalled();

      // Change to DEBUG level, now debug should log
      logger.setLevel(LogLevel.DEBUG);
      logger.debug("test debug message after level change");
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("test debug message after level change"),
      );
    });
  });

  describe("logging methods", () => {
    test("should log info messages when level is INFO", () => {
      logger.info("test info message");
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("test info message"),
      );
    });

    test("should not log debug messages when level is INFO", () => {
      logger.debug("test debug message");
      expect(stderrSpy).not.toHaveBeenCalled();
    });

    test("should log warn messages", () => {
      logger.warn("test warning");
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("test warning"),
      );
    });

    test("should log error messages", () => {
      logger.error("test error");
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("test error"),
      );
    });

    test("should format messages with additional arguments", () => {
      logger.info("test message", "arg1", { key: "value" });
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('"key": "value"'),
      );
    });
  });

  describe("logObject", () => {
    test("should log objects with proper formatting", () => {
      const testObj = { name: "test", value: 123 };
      logger.logObject(LogLevel.INFO, "Test object:", testObj);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('"name": "test"'),
      );
    });
  });

  describe("LogLevel enum", () => {
    test("should have correct numeric values", () => {
      expect(LogLevel.DEBUG).toBe(0);
      expect(LogLevel.INFO).toBe(1);
      expect(LogLevel.WARN).toBe(2);
      expect(LogLevel.ERROR).toBe(3);
    });

    test("should have correct string representations", () => {
      expect(LogLevel[LogLevel.DEBUG]).toBe("DEBUG");
      expect(LogLevel[LogLevel.INFO]).toBe("INFO");
      expect(LogLevel[LogLevel.WARN]).toBe("WARN");
      expect(LogLevel[LogLevel.ERROR]).toBe("ERROR");
    });
  });
});
