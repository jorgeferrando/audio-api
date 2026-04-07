/**
 * Classifies a MongoDB/Mongoose error as transient (retryable) or permanent.
 *
 * Transient errors are typically network or timeout related — the operation
 * might succeed on retry. Permanent errors (validation, duplicate key) will
 * not benefit from retrying.
 */
export function isTransientMongoError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return [
    'MongoNetworkError',
    'MongoNetworkTimeoutError',
    'MongoTimeoutError',
    'MongoServerSelectionError',
  ].includes(error.name)
}
