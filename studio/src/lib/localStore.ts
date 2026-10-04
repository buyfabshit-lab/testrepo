// Tiny IndexedDB wrapper: local saves work with zero backend configured.
const DB = "apparel-studio";
const STORE = "designs";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const r = fn(t.objectStore(STORE));
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      }),
  );
}

export const localStore = {
  put: <T extends { id: string }>(v: T) => tx("readwrite", (s) => s.put(v)),
  get: <T>(id: string) => tx<T | undefined>("readonly", (s) => s.get(id) as IDBRequest<T | undefined>),
  all: <T>() => tx<T[]>("readonly", (s) => s.getAll() as IDBRequest<T[]>),
  del: (id: string) => tx("readwrite", (s) => s.delete(id)),
};
