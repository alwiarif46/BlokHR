import { AsyncLocalStorage } from 'node:async_hooks';
import type { SchoolTransportDb } from './db';

export const transportDbAls = new AsyncLocalStorage<SchoolTransportDb>();

export function currentTransportDb(fallback: SchoolTransportDb): SchoolTransportDb {
  return transportDbAls.getStore() ?? fallback;
}
