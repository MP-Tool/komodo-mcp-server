import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { AsyncLocalStorage } from 'async_hooks';
import { config, SERVER_NAME } from '../config/index.js';

/**
 * Available logging levels ordered by severity.
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

/**
 * Context for the current execution (e.g. Request ID, MCP Connection).
 * Used to correlate logs with specific requests or sessions.
 */
export interface LogContext {
  requestId?: string;
  sessionId?: string;
  component?: string;
  sendMcpLog?: (level: LogLevel, message: string) => void;
}

/**
 * Numeric values for log levels to determine if a message should be logged.
 */
const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
};

/**
 * List of keys that are considered sensitive and should be redacted from logs.
 * Includes common authentication and security related terms.
 */
const SENSITIVE_KEYS = [
  'password',
  'apiKey',
  'apiSecret',
  'token',
  'secret',
  'authorization',
  'key',
  'access_token',
  'refresh_token',
  'jwt',
  'bearer',
];

/**
 * Pre-compiled regex patterns for secret scrubbing.
 * Performance optimization: compile once at module load instead of on every log call.
 */
// JWT: eyJ...
const SCRUB_JWT_REGEX = /\beyJ[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+/g;
// Bearer token
const SCRUB_BEARER_REGEX = /\bBearer\s+[a-zA-Z0-9._-]+/gi;
// Key-value pairs for sensitive keys (excluding bearer/authorization which are handled separately)
const SCRUB_KV_PATTERN = SENSITIVE_KEYS.filter((k) => !['bearer', 'authorization'].includes(k.toLowerCase())).join('|');
const SCRUB_KV_REGEX = new RegExp(`\\b(${SCRUB_KV_PATTERN})\\b(\\s*[:=]\\s*)(["']?)([^\\s"']+)\\3`, 'gi');

/**
 * Centralized logger for the application.
 * Handles log formatting, level filtering, context management, and secret scrubbing.
 * Supports both standard output and MCP client logging.
 */
export class Logger {
  private level: number;
  private static contextStorage = new AsyncLocalStorage<LogContext>();
  private component: string = 'server';
  private static streams: Map<string, fs.WriteStream> = new Map();
  private static initialized = false;

  /**
   * Initialize the logger with the configured log level.
   */
  constructor(component: string = 'server') {
    this.level = LOG_LEVELS[config.LOG_LEVEL];
    this.component = component;
    Logger.initStreams();
  }

  /**
   * Initialize file streams if LOG_DIR is configured.
   */
  private static initStreams() {
    if (Logger.initialized || !config.LOG_DIR) return;

    try {
      if (!fs.existsSync(config.LOG_DIR)) {
        fs.mkdirSync(config.LOG_DIR, { recursive: true });
      }

      // Create streams for known components
      ['server', 'api', 'transport'].forEach((comp) => {
        const stream = fs.createWriteStream(path.join(config.LOG_DIR!, `${comp}.log`), { flags: 'a' });
        Logger.streams.set(comp, stream);
      });

      Logger.initialized = true;
    } catch (err) {
      console.error('Failed to initialize log streams:', err);
    }
  }

  /**
   * Closes all file streams gracefully.
   * Should be called during application shutdown to ensure all logs are flushed.
   *
   * @returns Promise that resolves when all streams are closed
   */
  public static async closeStreams(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    for (const [name, stream] of Logger.streams.entries()) {
      closePromises.push(
        new Promise<void>((resolve, reject) => {
          stream.end(() => {
            stream.close((err) => {
              if (err) {
                console.error(`Failed to close log stream for ${name}:`, err);
                reject(err);
              } else {
                resolve();
              }
            });
          });
        }),
      );
    }

    await Promise.allSettled(closePromises);
    Logger.streams.clear();
    Logger.initialized = false;
  }

  /**
   * Create a child logger with a specific component context.
   */
  public child(context: { component: string }): Logger {
    return new Logger(context.component);
  }

  /**
   * Run a function within a logging context (e.g. with a Request ID or MCP Logger)
   */
  public runWithContext<T>(context: LogContext, fn: () => T): T {
    return Logger.contextStorage.run(context, fn);
  }

  /**
   * Get the current logging context
   */
  public getContext(): LogContext | undefined {
    return Logger.contextStorage.getStore();
  }

  /**
   * Log a message at TRACE level.
   * @param message The message to log (supports printf-style formatting)
   * @param args Additional arguments for formatting or metadata
   */
  public trace(message: string, ...args: unknown[]): void {
    this.log('trace', message, ...args);
  }

  /**
   * Log a message at DEBUG level.
   * @param message The message to log (supports printf-style formatting)
   * @param args Additional arguments for formatting or metadata
   */
  public debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, ...args);
  }

  /**
   * Log a message at INFO level.
   * @param message The message to log (supports printf-style formatting)
   * @param args Additional arguments for formatting or metadata
   */
  public info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args);
  }

  /**
   * Log a message at WARN level.
   * @param message The message to log (supports printf-style formatting)
   * @param args Additional arguments for formatting or metadata
   */
  public warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args);
  }

  /**
   * Log a message at ERROR level.
   * @param message The message to log (supports printf-style formatting)
   * @param args Additional arguments for formatting or metadata
   */
  public error(message: string, ...args: unknown[]): void {
    this.log('error', message, ...args);
  }

  /**
   * Internal log handler.
   * Formats the message, adds context, scrubs secrets, and writes to output.
   */
  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (LOG_LEVELS[level] < this.level) {
      return;
    }

    // Separate metadata from format args
    let meta: Record<string, unknown> = {};
    let formatArgs = args;

    if (args.length > 0 && typeof args[args.length - 1] === 'object' && args[args.length - 1] !== null) {
      // Check if the last arg is intended as metadata
      // If the message has fewer placeholders than args, the last one might be metadata
      // Simple heuristic: if it's an object and not an Error (unless explicitly passed as meta), treat as meta
      // However, standard Node.js console.log behavior treats objects as part of formatting if %o/%O is used,
      // or just appends them.
      // To support `logger.info('msg', { meta: 1 })`, we check if the last arg is an object.
      const lastArg = args[args.length - 1];
      if (!util.types.isNativeError(lastArg)) {
        meta = this.redact(lastArg) as Record<string, unknown>;
        formatArgs = args.slice(0, -1);
      }
    }

    const timestamp = new Date().toISOString(); // ISO 8601
    const formattedMessage = util.format(message, ...formatArgs);
    const context = Logger.contextStorage.getStore();
    const component = context?.component || this.component;

    if (config.LOG_FORMAT === 'json') {
      const logEntry = {
        timestamp,
        level: level.toUpperCase(),
        message: formattedMessage,
        service: {
          name: SERVER_NAME,
          component: component,
        },
        trace: {
          id: context?.requestId,
        },
        session: {
          id: context?.sessionId,
        },
        ...meta,
      };
      this.write(level, JSON.stringify(logEntry), component);
    } else {
      // Text format: [YYYY-MM-DD HH:mm:ss.SSS] [LEVEL] [Component] [SessionID:ReqID] Message {meta}
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      const displayTimestamp = timestamp.replace('T', ' ').slice(0, -1);

      let contextStr = '';
      if (context?.sessionId && context?.requestId) {
        contextStr = ` [${context.sessionId.slice(0, 8)}:${context.requestId.slice(0, 8)}]`;
      } else if (context?.sessionId) {
        contextStr = ` [${context.sessionId.slice(0, 8)}]`;
      } else if (context?.requestId) {
        contextStr = ` [Req:${context.requestId.slice(0, 8)}]`;
      }

      // Pad level to 5 chars for alignment
      const levelStr = level.toUpperCase().padEnd(5);

      const output = `[${displayTimestamp}] [${levelStr}] [${component}]${contextStr} ${formattedMessage}${metaStr}`;
      this.write(level, output, component);
    }

    // Send to MCP Client if available in context
    if (context?.sendMcpLog) {
      // We send the scrubbed message to the client
      const safeMessage = this.scrubSecrets(formattedMessage);
      context.sendMcpLog(level, safeMessage);
    }
  }

  /**
   * Write the formatted log entry to the appropriate output stream.
   * Handles log injection prevention and final secret scrubbing.
   */
  private write(level: LogLevel, output: string, component: string): void {
    // 1. Prevent Log Injection (CWE-117)
    // Replace newlines to ensure one log entry = one line.
    // This prevents attackers from forging log entries by injecting newlines.
    const singleLineOutput = this.preventLogInjection(output);

    // 2. Scrub secrets (like JWTs) from the final output string
    // This catches secrets in the message body, formatted args, and even metadata values if they leaked
    const safeOutput = this.scrubSecrets(singleLineOutput);

    // Write to file if configured
    if (config.LOG_DIR) {
      const stream = Logger.streams.get(component) || Logger.streams.get('server');
      if (stream) {
        stream.write(safeOutput + '\n');
      }
    }

    // In Stdio mode, we MUST write to stderr to avoid corrupting JSON-RPC on stdout
    if (config.MCP_TRANSPORT === 'stdio') {
      console.error(safeOutput);
      return;
    }

    // In SSE mode, we can use stdout for info/debug and stderr for warn/error
    // This is standard for container logs
    if (level === 'error' || level === 'warn') {
      console.error(safeOutput);
    } else {
      console.log(safeOutput);
    }
  }

  /**
   * Prevents Log Injection (CWE-117) by escaping newline characters.
   * This ensures that a single log entry is always written as a single line.
   */
  private preventLogInjection(text: string): string {
    return text.replace(/[\n\r]/g, (match) => {
      switch (match) {
        case '\n':
          return '\\n';
        case '\r':
          return '\\r';
        default:
          return match;
      }
    });
  }

  /**
   * Remove sensitive information from text using pre-compiled regex patterns.
   * Handles JWTs, Bearer tokens, and key-value pairs matching sensitive keys.
   * Performance: Uses module-level compiled regex instead of compiling per-call.
   */
  private scrubSecrets(text: string): string {
    let scrubbed = text;

    // 1. Known Secret Formats (High Confidence)
    // JWT: eyJ... - Use pre-compiled regex
    scrubbed = scrubbed.replace(SCRUB_JWT_REGEX, '**********');

    // 2. Common Auth Headers
    // Bearer token - Use pre-compiled regex
    // We run this BEFORE the generic KV scrubber to ensure "Bearer <token>" is handled as a unit
    scrubbed = scrubbed.replace(SCRUB_BEARER_REGEX, 'Bearer **********');

    // 3. Context-based Scrubbing (Key-Value pairs)
    // Looks for: key=value, key: value - Use pre-compiled regex
    scrubbed = scrubbed.replace(SCRUB_KV_REGEX, (match, key, sep, quote, value) => {
      // Don't redact if it's already redacted (e.g. by Bearer scrubber)
      if (value.includes('**********')) return match;
      return `${key}${sep}${quote}**********${quote}`;
    });

    return scrubbed;
  }

  /**
   * Recursively redact sensitive keys in an object.
   */
  private redact(obj: unknown): unknown {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.redact(item));
    }

    const redacted: Record<string, unknown> = {};
    const objRecord = obj as Record<string, unknown>;

    for (const key in objRecord) {
      if (Object.prototype.hasOwnProperty.call(objRecord, key)) {
        if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
          redacted[key] = '**********';
        } else if (typeof objRecord[key] === 'object') {
          redacted[key] = this.redact(objRecord[key]);
        } else {
          redacted[key] = objRecord[key];
        }
      }
    }
    return redacted;
  }
}

export const logger = new Logger();
