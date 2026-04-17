/** Internal debug logger that only outputs when debug mode is enabled. */
export class Logger {
  private enabled: boolean;

  constructor(debug: boolean) {
    this.enabled = debug;
  }

  /** Log a debug message. Only outputs when debug mode is enabled. */
  debug(message: string, ...args: unknown[]): void {
    if (this.enabled) {
      console.log(`[Bananalytics] ${message}`, ...args);
    }
  }

  /** Log a warning. Always outputs regardless of debug mode. */
  warn(message: string, ...args: unknown[]): void {
    console.warn(`[Bananalytics] ${message}`, ...args);
  }

  /** Log an error. Always outputs regardless of debug mode. */
  error(message: string, ...args: unknown[]): void {
    console.error(`[Bananalytics] ${message}`, ...args);
  }
}
