import type { ILogger } from '@shared/ILogger'

// Lightweight logger for testing or environments where Winston is overkill.
// Replace with DatadogLogger, SentryLogger, etc. following the same interface.
export class ConsoleLogger implements ILogger {
  info(message: string, meta?: Record<string, unknown>): void {
    console.log(JSON.stringify({ level: 'info', message, ...meta }))
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(JSON.stringify({ level: 'warn', message, ...meta }))
  }

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(JSON.stringify({ level: 'error', message, ...meta }))
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    console.debug(JSON.stringify({ level: 'debug', message, ...meta }))
  }
}
