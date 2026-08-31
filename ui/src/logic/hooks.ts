import { useEffect, useRef, useState } from "react";

export default function useTimeout(callback: () => void, delay: number) {
  const timeoutRef = useRef<number | null>(null);
  const savedCallback = useRef(callback);
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);
  useEffect(() => {
    const tick = () => savedCallback.current();
    if (typeof delay === "number") {
      timeoutRef.current = setTimeout(tick, delay);
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }
  }, [delay]);
  return timeoutRef;
}

export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return initial;
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore quota errors in dev, etc.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
// wsCache.js
// const CACHE_KEY = "ws_dev_cache";

// export const getCachedData = (key: string) => {
//   if (typeof window === "undefined") return null;

//   const cached = localStorage.getItem(CACHE_KEY + key);
//   if (!cached) return null;

//   const { data, timestamp } = JSON.parse(cached);
//   if (Date.now() - timestamp > 30 * 60 * 1000) {
//     localStorage.removeItem(CACHE_KEY);
//     return null;
//   }

//   return data;
// };

// export const setCachedData = (key: string, data: any) => {
//   if (typeof window === "undefined") return;
//   localStorage.setItem(
//     CACHE_KEY + key,
//     JSON.stringify({
//       data,
//       timestamp: Date.now(),
//     }),
//   );
// };

// // Add this to your component for easy clearing
// export const clearWebSocketCache = () => {
//   localStorage.removeItem(CACHE_KEY);
//   window.location.reload();
// };

// wsCache.js
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const DB_NAME = "WebSocketCacheDB";
const STORE_NAME = "cache";
const DB_VERSION = 1;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request: IDBOpenDBRequest = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

export const getCachedData = async <T = unknown,>(
  key: string = "default",
): Promise<T | null> => {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request: IDBRequest<CacheEntry<T>> = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (result && Date.now() - result.timestamp < CACHE_DURATION) {
          resolve(result.data);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("[Cache] IndexedDB read failed:", error);
    return null;
  }
};

export const setCachedData = async <T,>(
  data: T,
  key: string = "default",
): Promise<void> => {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
      };

      const request = store.put(entry, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("[Cache] IndexedDB write failed:", error);
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      await clearCache();
    }
  }
};

export const clearCache = async (key?: string): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    if (key) {
      await store.delete(key);
    } else {
      await store.clear();
    }
  } catch (error) {
    console.warn("[Cache] Clear failed:", error);
  }
};
