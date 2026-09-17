import { AsyncLocalStorage } from 'node:async_hooks';
import type { SchoolLibraryDb } from './db';

export const libraryDbAls = new AsyncLocalStorage<SchoolLibraryDb>();

export function currentLibraryDb(fallback: SchoolLibraryDb): SchoolLibraryDb {
  return libraryDbAls.getStore() ?? fallback;
}
