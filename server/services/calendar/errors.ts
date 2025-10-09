/**
 * Calendar Write Errors
 * Custom error types for CalDAV write operations
 */

export class ConflictError extends Error {
  constructor(
    message: string,
    public readonly before: any,
    public readonly attempted: any,
    public readonly remoteSummary?: string
  ) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

export class WriteNotAllowedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WriteNotAllowedError';
  }
}

export class DryRunError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DryRunError';
  }
}
