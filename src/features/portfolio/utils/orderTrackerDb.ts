import type { Order } from '../types';

const DB_NAME = 'StocksOrderTracker';
const DB_VERSION = 1;
const STORE_NAME = 'orders';
const ORDERS_KEY = 'list';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Load persisted Order Tracker records from IndexedDB.
 */
export function loadOrders(): Promise<Order[]> {
  return openDb().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(ORDERS_KEY);
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
      request.onsuccess = () => {
        db.close();
        const data = request.result;
        resolve(Array.isArray(data) ? data : []);
      };
    });
  });
}

/**
 * Persist Order Tracker records to IndexedDB (async, non-blocking).
 */
export function saveOrders(orders: Order[]): Promise<void> {
  return openDb().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(orders, ORDERS_KEY);
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
      request.onsuccess = () => {
        db.close();
        resolve();
      };
    });
  });
}
