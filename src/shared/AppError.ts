export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message)
    this.name = this.constructor.name
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super(`${entity} '${id}' not found`, 'NOT_FOUND')
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR')
  }
}

export class ConflictError extends AppError {
  constructor(entity: string, id: string) {
    super(`${entity} '${id}' already exists`, 'CONFLICT')
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super(message, 'DATABASE_ERROR')
  }
}

export class StorageError extends AppError {
  constructor(message: string) {
    super(message, 'STORAGE_ERROR')
  }
}
