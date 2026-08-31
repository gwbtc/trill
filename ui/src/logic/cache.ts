// indexedDBCache.ts
export interface CacheConfig {
  dbName: string;
  storeName: string;
  version?: number;
}

export interface CachedData<T> {
  key: string;
  data: T;
  timestamp: number;
  expiresAt?: number;
}

class IndexedDBCache {
  private dbName: string;
  private storeName: string;
  private version: number;
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(config: CacheConfig) {
    this.dbName = config.dbName;
    this.storeName = config.storeName;
    this.version = config.version || 1;
  }

  /**
   * Initialize the IndexedDB database
   */
  private async initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error}`));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, {
            keyPath: "key",
          });
          objectStore.createIndex("timestamp", "timestamp", { unique: false });
          objectStore.createIndex("expiresAt", "expiresAt", { unique: false });
        }
      };
    });

    return this.dbPromise;
  }

  /**
   * Store data in IndexedDB
   */
  async set<T>(key: string, data: T, ttlMs?: number): Promise<void> {
    const db = await this.initDB();
    const timestamp = Date.now();
    const expiresAt = ttlMs ? timestamp + ttlMs : undefined;

    const cachedData: CachedData<T> = {
      key,
      data,
      timestamp,
      expiresAt,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.put(cachedData);

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(`Failed to store data: ${request.error}`));
    });
  }

  /**
   * Retrieve data from IndexedDB
   */
  async get<T>(key: string): Promise<T | null> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result as CachedData<T> | undefined;

        if (!result) {
          resolve(null);
          return;
        }

        // Check if data has expired
        if (result.expiresAt && Date.now() > result.expiresAt) {
          // Delete expired data
          this.delete(key);
          resolve(null);
          return;
        }

        resolve(result.data);
      };

      request.onerror = () =>
        reject(new Error(`Failed to retrieve data: ${request.error}`));
    });
  }

  /**
   * Delete data from IndexedDB
   */
  async delete(key: string): Promise<void> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(`Failed to delete data: ${request.error}`));
    });
  }

  /**
   * Check if a key exists and is not expired
   */
  async has(key: string): Promise<boolean> {
    const data = await this.get(key);
    return data !== null;
  }

  /**
   * Clear all data from the store
   */
  async clear(): Promise<void> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(`Failed to clear store: ${request.error}`));
    });
  }

  /**
   * Get all keys in the store
   */
  async keys(): Promise<string[]> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.getAllKeys();

      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () =>
        reject(new Error(`Failed to get keys: ${request.error}`));
    });
  }

  /**
   * Remove expired entries
   */
  async cleanExpired(): Promise<number> {
    const db = await this.initDB();
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest)
          .result as IDBCursorWithValue | null;

        if (cursor) {
          const value = cursor.value as CachedData<unknown>;

          if (value.expiresAt && Date.now() > value.expiresAt) {
            cursor.delete();
            deletedCount++;
          }

          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };

      request.onerror = () =>
        reject(new Error(`Failed to clean expired: ${request.error}`));
    });
  }
}

// Export a singleton factory
export const createCache = (config: CacheConfig) => new IndexedDBCache(config);

export default IndexedDBCache;
