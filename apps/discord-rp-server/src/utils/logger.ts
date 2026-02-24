import { env } from '../config/env.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LOG_LEVELS[env.logLevel as LogLevel] ?? LOG_LEVELS.info;

function formatTimestamp(): string {
  return new Date().toISOString();
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= currentLevel;
}

function formatMessage(level: string, message: string, meta?: object): string {
  const timestamp = formatTimestamp();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

export const logger = {
  debug(message: string, meta?: object): void {
    if (shouldLog('debug')) {
      console.debug(formatMessage('debug', message, meta));
    }
  },

  info(message: string, meta?: object): void {
    if (shouldLog('info')) {
      console.info(formatMessage('info', message, meta));
    }
  },

  warn(message: string, meta?: object): void {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, meta));
    }
  },

  error(message: string, error?: unknown, meta?: object): void {
    if (shouldLog('error')) {
      let errorMeta: object;
      if (error instanceof Error) {
        errorMeta = { error: error.message, stack: error.stack, ...meta };
      } else if (error && typeof error === 'object') {
        // Handle Supabase error objects
        const errObj = error as Record<string, unknown>;
        errorMeta = {
          error: errObj.message || errObj.code || JSON.stringify(error),
          code: errObj.code,
          details: errObj.details,
          hint: errObj.hint,
          ...meta
        };
      } else {
        errorMeta = { error: String(error), ...meta };
      }
      console.error(formatMessage('error', message, errorMeta));
    }
  },

  success(message: string, meta?: object): void {
    if (shouldLog('info')) {
      console.info(formatMessage('success', message, meta));
    }
  },

  presence(userId: string, gameName: string | null, event: string): void {
    if (shouldLog('debug')) {
      console.debug(formatMessage('presence', `${event}: ${gameName ?? 'none'}`, { userId }));
    }
  },
};
