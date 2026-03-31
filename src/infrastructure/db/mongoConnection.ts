import mongoose from 'mongoose'
import type { ILogger } from '@shared/ILogger'

/**
 * Wraps Mongoose connection lifecycle.
 *
 * Keeping connect/disconnect here (instead of calling mongoose directly in index.ts)
 * allows tests to inject an in-memory MongoDB URI without touching the composition root.
 */
export async function connectMongo(uri: string, logger: ILogger): Promise<void> {
  await mongoose.connect(uri)
  logger.info('MongoDB connected', { uri: uri.replace(/\/\/.*@/, '//<credentials>@') })
}

export async function disconnectMongo(logger: ILogger): Promise<void> {
  await mongoose.disconnect()
  logger.info('MongoDB disconnected')
}
