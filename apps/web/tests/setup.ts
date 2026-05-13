import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './msw/server';

function createMemoryStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(store).length;
    },
    clear() {
      store = {};
    },
    getItem(k: string) {
      return Object.prototype.hasOwnProperty.call(store, k) ? store[k]! : null;
    },
    key(i: number) {
      return Object.keys(store)[i] ?? null;
    },
    removeItem(k: string) {
      delete store[k];
    },
    setItem(k: string, v: string) {
      store[k] = String(v);
    },
  };
}

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: createMemoryStorage(),
});
Object.defineProperty(window, 'sessionStorage', {
  configurable: true,
  value: createMemoryStorage(),
});

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  window.localStorage.clear();
});
afterAll(() => server.close());
