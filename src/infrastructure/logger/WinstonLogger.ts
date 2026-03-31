import winston from 'winston'
import type { ILogger } from '@shared/ILogger'

export class WinstonLogger implements ILogger {
  private readonly instance: winston.Logger

  constructor(env: string = process.env.NODE_ENV ?? 'production') {
    const isDevelopment = env === 'development'

    this.instance = winston.createLogger({
      level: isDevelopment ? 'debug' : 'info',
      format: isDevelopment ? this.devFormat() : this.prodFormat(),
      transports: [new winston.transports.Console()],
    })
  }

  get level(): string {
    return this.instance.level
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.instance.info(message, meta)
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.instance.warn(message, meta)
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.instance.error(message, meta)
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.instance.debug(message, meta)
  }

  private devFormat(): winston.Logform.Format {
    return winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ level, message, timestamp, ...meta }) => {
        const metaStr = Object.keys(meta).length
          ? '\n' + JSON.stringify(meta, null, 2)
          : ''
        return `${timestamp} ${level}: ${message}${metaStr}`
      })
    )
  }

  private prodFormat(): winston.Logform.Format {
    return winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    )
  }
}
