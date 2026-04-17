/** Base error class for all Bananalytics SDK errors. */
export class BananalyticsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BananalyticsError';
  }
}

/** Error thrown when a network request fails. */
export class NetworkError extends BananalyticsError {
  public readonly statusCode: number | undefined;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'NetworkError';
    this.statusCode = statusCode;
  }

  /** Whether the error is retryable (5xx or no status code / network error). */
  get isRetryable(): boolean {
    return this.statusCode === undefined || this.statusCode >= 500;
  }
}

/** Error thrown for invalid configuration. */
export class ConfigError extends BananalyticsError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** Error thrown for validation failures. */
export class ValidationError extends BananalyticsError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
