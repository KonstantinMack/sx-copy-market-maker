/**
 * Logging Service
 * Provides structured logging with file and console output
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import type { LogEntry, LoggingConfig, Order } from "@/types/index.js";
import { sanitizeForLogging } from "@/utils/validation.js";

/**
 * Logger Service
 * Handles all logging for the application with support for multiple outputs and log levels
 */
export class Logger {
  private config: LoggingConfig;
  private logPath: string;
  private appLogFile: string;
  private errorLogFile: string;
  private orderLogFile: string;

  constructor(config: LoggingConfig) {
    this.config = config;
    this.logPath = resolve(process.cwd(), config.file.path);
    this.appLogFile = join(this.logPath, "app.log");
    this.errorLogFile = join(this.logPath, "error.log");
    this.orderLogFile = join(this.logPath, "orders.log");

    this.initializeLogFiles();
  }

  /**
   * Initializes log files and directories
   */
  private initializeLogFiles(): void {
    if (!this.config.file.enabled) {
      return;
    }

    // Create log directory if it doesn't exist
    if (!existsSync(this.logPath)) {
      mkdirSync(this.logPath, { recursive: true });
    }

    // Rotate logs if needed
    this.rotateLogs();
  }

  /**
   * Rotates log files if they exceed the maximum size
   */
  private rotateLogs(): void {
    const maxSizeBytes = this.parseSize(this.config.file.maxSize);
    const logFiles = [this.appLogFile, this.errorLogFile, this.orderLogFile];

    for (const logFile of logFiles) {
      if (existsSync(logFile)) {
        const stats = statSync(logFile);
        if (stats.size > maxSizeBytes) {
          this.rotateFile(logFile);
        }
      }
    }

    // Clean up old rotated files
    this.cleanupOldLogs();
  }

  /**
   * Rotates a single log file
   */
  private rotateFile(logFile: string): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const rotatedFile = `${logFile}.${timestamp}`;

    try {
      // Rename current log file
      const content = existsSync(logFile)
        ? require("node:fs").readFileSync(logFile)
        : "";
      if (content) {
        writeFileSync(rotatedFile, content);
        writeFileSync(logFile, ""); // Clear current log
      }
    } catch (error) {
      console.error(`Failed to rotate log file ${logFile}:`, error);
    }
  }

  /**
   * Cleans up old rotated log files
   */
  private cleanupOldLogs(): void {
    if (!existsSync(this.logPath)) {
      return;
    }

    const files = readdirSync(this.logPath);
    const logFilePattern = /\.(log\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/;

    // Get all rotated log files with timestamps
    const rotatedFiles = files
      .filter((f) => logFilePattern.test(f))
      .map((f) => ({
        name: f,
        path: join(this.logPath, f),
        mtime: statSync(join(this.logPath, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime); // Sort by newest first

    // Keep only the configured number of files
    const toDelete = rotatedFiles.slice(this.config.file.maxFiles);
    for (const file of toDelete) {
      try {
        unlinkSync(file.path);
      } catch (error) {
        console.error(`Failed to delete old log file ${file.name}:`, error);
      }
    }
  }

  /**
   * Parses size string (e.g., "10m", "1g") to bytes
   */
  private parseSize(size: string): number {
    const units: Record<string, number> = {
      b: 1,
      k: 1024,
      m: 1024 * 1024,
      g: 1024 * 1024 * 1024,
    };

    const match = size.toLowerCase().match(/^(\d+)([bkmg])$/);
    if (!match) {
      return 10 * 1024 * 1024; // Default 10MB
    }

    const value = Number.parseInt(match[1], 10);
    const unit = match[2];
    return value * (units[unit] || 1);
  }

  /**
   * Creates a log entry
   */
  private createLogEntry(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (context) {
      entry.context = sanitizeForLogging(context);
    }

    if (error) {
      entry.error = {
        message: error.message,
        ...(this.config.includeStackTrace && error.stack
          ? { stack: error.stack }
          : {}),
        ...("code" in error && error.code ? { code: String(error.code) } : {}),
      };
    }

    return entry;
  }

  /**
   * Formats log entry for output
   */
  private formatLogEntry(entry: LogEntry): string {
    const parts = [
      entry.timestamp,
      entry.level.toUpperCase().padEnd(5),
      entry.message,
    ];

    if (entry.context) {
      parts.push(JSON.stringify(entry.context));
    }

    if (entry.error) {
      parts.push(`Error: ${entry.error.message}`);
      if (entry.error.stack) {
        parts.push(`Stack: ${entry.error.stack}`);
      }
    }

    return parts.join(" | ");
  }

  /**
   * Writes log entry to file
   */
  private writeToFile(entry: LogEntry, file: string): void {
    if (!this.config.file.enabled) {
      return;
    }

    try {
      const line = `${this.formatLogEntry(entry)}\n`;
      appendFileSync(file, line, "utf-8");

      // Check if rotation is needed
      const stats = statSync(file);
      const maxSize = this.parseSize(this.config.file.maxSize);
      if (stats.size > maxSize) {
        this.rotateFile(file);
      }
    } catch (error) {
      console.error(`Failed to write to log file ${file}:`, error);
    }
  }

  /**
   * Writes log entry to console
   */
  private writeToConsole(entry: LogEntry): void {
    if (!this.config.console) {
      return;
    }

    const formatted = this.formatLogEntry(entry);

    switch (entry.level) {
      case "debug":
        console.debug(formatted);
        break;
      case "info":
        console.info(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      case "error":
        console.error(formatted);
        break;
    }
  }

  /**
   * Logs a message
   */
  private log(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    // Check if this level should be logged
    const levels = ["debug", "info", "warn", "error"];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);

    if (messageLevelIndex < currentLevelIndex) {
      return; // Skip this message
    }

    const entry = this.createLogEntry(level, message, context, error);

    // Write to console
    this.writeToConsole(entry);

    // Write to files
    if (this.config.file.enabled) {
      this.writeToFile(entry, this.appLogFile);

      // Also write errors to error log
      if (level === "error") {
        this.writeToFile(entry, this.errorLogFile);
      }
    }
  }

  /**
   * Logs a debug message
   */
  public debug(message: string, context?: Record<string, unknown>): void {
    this.log("debug", message, context);
  }

  /**
   * Logs an info message
   */
  public info(message: string, context?: Record<string, unknown>): void {
    this.log("info", message, context);
  }

  /**
   * Logs a warning message
   */
  public warn(message: string, context?: Record<string, unknown>): void {
    this.log("warn", message, context);
  }

  /**
   * Logs an error message
   */
  public error(
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    this.log("error", message, context, error);
  }

  /**
   * Logs order detection event
   */
  public logOrderDetected(order: Order, monitoredWallet: string): void {
    const entry = this.createLogEntry(
      "info",
      "Order detected from monitored wallet",
      {
        orderHash: order.orderHash,
        marketHash: order.marketHash,
        monitoredWallet,
        totalBetSize: order.totalBetSize,
        percentageOdds: order.percentageOdds,
        isMakerBettingOutcomeOne: order.isMakerBettingOutcomeOne,
        eventId: order.sportXeventId,
      }
    );

    this.writeToConsole(entry);
    if (this.config.file.enabled) {
      this.writeToFile(entry, this.appLogFile);
      this.writeToFile(entry, this.orderLogFile);
    }
  }

  /**
   * Logs successful order submission
   */
  public logOrderSuccess(
    orderHash: string,
    context?: Record<string, unknown>
  ): void {
    const entry = this.createLogEntry("info", "Order submitted successfully", {
      orderHash,
      ...context,
    });

    this.writeToConsole(entry);
    if (this.config.file.enabled) {
      this.writeToFile(entry, this.appLogFile);
      this.writeToFile(entry, this.orderLogFile);
    }
  }

  /**
   * Logs failed order submission
   */
  public logOrderFailure(
    orderHash: string,
    reason: string,
    context?: Record<string, unknown>
  ): void {
    const entry = this.createLogEntry("error", "Order submission failed", {
      orderHash,
      reason,
      ...context,
    });

    this.writeToConsole(entry);
    if (this.config.file.enabled) {
      this.writeToFile(entry, this.appLogFile);
      this.writeToFile(entry, this.errorLogFile);
      this.writeToFile(entry, this.orderLogFile);
    }
  }

  /**
   * Logs API request
   */
  public logAPIRequest(
    method: string,
    path: string,
    context?: Record<string, unknown>
  ): void {
    this.debug(`API ${method} ${path}`, context);
  }

  /**
   * Logs API response
   */
  public logAPIResponse(
    method: string,
    path: string,
    statusCode: number,
    duration: number
  ): void {
    this.debug(`API ${method} ${path} - ${statusCode}`, {
      statusCode,
      duration: `${duration}ms`,
    });
  }

  /**
   * Logs API error
   */
  public logAPIError(
    method: string,
    path: string,
    error: Error,
    context?: Record<string, unknown>
  ): void {
    this.error(`API ${method} ${path} failed`, context, error);
  }

  /**
   * Flushes all logs (ensures all writes complete)
   */
  public async flush(): Promise<void> {
    // In Node.js, file writes are buffered but we don't need to do anything special
    // This method exists for compatibility with future enhancements
    return Promise.resolve();
  }
}
