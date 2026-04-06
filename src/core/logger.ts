import * as winston from 'winston';

const logFormat = winston.format.printf(({ timestamp, level, message, sessionId, label }) => {
  const parts: string[] = [timestamp as string, `[${(level as string).toUpperCase()}]`];
  if (sessionId) parts.push(`[${sessionId as string}]`);
  if (label) parts.push(`[${label as string}]`);
  parts.push(message as string);
  return parts.join(' ');
});

class PipelineLogger {
  private readonly winstonLogger: winston.Logger;
  private fileTransport?: winston.transports.FileTransportInstance;

  constructor() {
    this.winstonLogger = winston.createLogger({
      level: process.env.LOG_LEVEL ?? 'info',
      format: winston.format.combine(winston.format.timestamp(), logFormat),
      transports: [new winston.transports.Console()],
    });
  }

  /** Suppress all console output (used in MCP mode where stdout is reserved for JSON-RPC). */
  set silent(value: boolean) {
    this.winstonLogger.silent = value;
  }

  get level(): string {
    return this.winstonLogger.level;
  }

  set level(value: string) {
    this.winstonLogger.level = value;
  }

  /** Inject session ID into every subsequent log entry. */
  setSessionId(id: string): void {
    this.winstonLogger.defaultMeta = { ...this.winstonLogger.defaultMeta, sessionId: id };
  }

  /** Add a file transport writing to the given path. Replaces any previous file transport. */
  addFileTransport(filePath: string): void {
    this.removeFileTransport();
    this.fileTransport = new winston.transports.File({ filename: filePath });
    this.winstonLogger.add(this.fileTransport);
  }

  /** Remove any previously added file transport. */
  removeFileTransport(): void {
    if (this.fileTransport) {
      this.winstonLogger.remove(this.fileTransport);
      this.fileTransport = undefined;
    }
  }

  /** Create a child logger that includes a label in every entry. */
  child(label: string): winston.Logger {
    return this.winstonLogger.child({ label });
  }

  info(message: string): void {
    this.winstonLogger.info(message);
  }

  warn(message: string): void {
    this.winstonLogger.warn(message);
  }

  error(message: string): void {
    this.winstonLogger.error(message);
  }

  debug(message: string): void {
    this.winstonLogger.debug(message);
  }
}

export const Logger = new PipelineLogger();
