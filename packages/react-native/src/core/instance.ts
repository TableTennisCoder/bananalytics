import { BananalyticsClient } from './client';

/**
 * Holds the singleton, so that both the public `Bananalytics` object and
 * `BananalyticsRoot` can reach it without importing each other.
 *
 * They used to: the root component imported `Bananalytics` from the package
 * entry point, which exports the root component. That cycle happens to resolve
 * under CommonJS because the import is only read inside an event handler — but
 * it resolves by luck, and Metro is not Node. A module that owns the reference
 * costs nothing and cannot come apart.
 */
let instance: BananalyticsClient | null = null;

export function setInstance(client: BananalyticsClient | null): void {
  instance = client;
}

export function getInstance(): BananalyticsClient | null {
  return instance;
}
