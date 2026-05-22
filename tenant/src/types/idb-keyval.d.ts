/**
 * idb-keyval@6.2.3 ships `types: ./dist/index.d.ts` in package.json but the
 * file is missing from the published tarball, so TS can't resolve it.
 * Declare the small subset of the API we actually use.
 */
declare module 'idb-keyval' {
  export function get<T = unknown>(key: IDBValidKey): Promise<T | undefined>;
  export function set(key: IDBValidKey, value: unknown): Promise<void>;
  export function del(key: IDBValidKey): Promise<void>;
  export function clear(): Promise<void>;
  export function keys<K extends IDBValidKey = IDBValidKey>(): Promise<K[]>;
}
