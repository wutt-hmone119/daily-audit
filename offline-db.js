"use strict";

(function () {
  const DATABASE_NAME = "daily-audit-local-v1";
  const DATABASE_VERSION = 1;
  const LEGACY_DELIVERIES_KEY = "daily-audit-deliveries-v1";
  let databasePromise;

  function openDatabase() {
    if (!("indexedDB" in window)) {
      return Promise.reject(new Error("IndexedDB is not available in this browser."));
    }
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains("deliveries")) {
          const deliveries = database.createObjectStore("deliveries", { keyPath: "id" });
          deliveries.createIndex("syncStatus", "syncStatus", { unique: false });
        }
        if (!database.objectStoreNames.contains("deletions")) {
          database.createObjectStore("deletions", { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains("credentials")) {
          database.createObjectStore("credentials", { keyPath: "email" });
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
        resolve(database);
      };
      request.onerror = () => reject(request.error || new Error("Could not open IndexedDB."));
      request.onblocked = () => reject(new Error("IndexedDB upgrade is blocked by another open tab."));
    });
    return databasePromise;
  }

  async function readAll(storeName) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error(`Could not read ${storeName}.`));
      transaction.onabort = () => reject(transaction.error || new Error(`Could not read ${storeName}.`));
    });
  }

  async function write(storeName, operation) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      operation(transaction.objectStore(storeName));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error(`Could not update ${storeName}.`));
      transaction.onabort = () => reject(transaction.error || new Error(`Could not update ${storeName}.`));
    });
  }

  async function migrateLegacyDeliveries() {
    let legacyData;
    try {
      legacyData = localStorage.getItem(LEGACY_DELIVERIES_KEY);
    } catch (error) {
      throw new Error(`Could not access legacy browser records: ${error.message}`);
    }
    if (!legacyData) return;

    let records;
    try {
      records = JSON.parse(legacyData);
    } catch (error) {
      throw new Error(`Legacy browser records are not valid JSON: ${error.message}`);
    }
    if (!Array.isArray(records)) {
      throw new Error("Legacy browser records are not a list.");
    }

    const database = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction("deliveries", "readwrite");
      const store = transaction.objectStore("deliveries");
      records.forEach((record) => {
        if (record && record.id) {
          const getRequest = store.get(String(record.id));
          getRequest.onsuccess = () => {
            if (!getRequest.result) {
              store.put({ ...record, id: String(record.id), syncStatus: "pending" });
            }
          };
        }
      });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("Could not migrate browser records."));
      transaction.onabort = () => reject(transaction.error || new Error("Could not migrate browser records."));
    });
    localStorage.removeItem(LEGACY_DELIVERIES_KEY);
  }

  async function saveCredential(email, salt, passwordHash) {
    await write("credentials", (store) => store.put({
      email: email.trim().toLowerCase(),
      salt,
      passwordHash
    }));
  }

  async function getCredential(email) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction("credentials", "readonly");
      const request = transaction.objectStore("credentials").get(email.trim().toLowerCase());
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Could not read the offline credential."));
    });
  }

  window.DailyAuditStore = {
    migrateLegacyDeliveries,
    listDeliveries: () => readAll("deliveries"),
    listDeletions: () => readAll("deletions"),
    putDelivery: (delivery) => write("deliveries", (store) => store.put(delivery)),
    putDeliveries: (deliveries) => write("deliveries", (store) => {
      deliveries.forEach((delivery) => store.put(delivery));
    }),
    markDeleted: (id) => write("deliveries", (store) => store.delete(String(id)))
      .then(() => write("deletions", (store) => store.put({ id: String(id), syncStatus: "pending" }))),
    markSynced: (sentRecords) => write("deliveries", (store) => {
      sentRecords.forEach((sent) => {
        const request = store.get(sent.id);
        request.onsuccess = () => {
          const current = request.result;
          if (current && current.syncStatus === "pending" && current.updatedAt === sent.updatedAt) {
            store.put({ ...current, syncStatus: "synced" });
          }
        };
      });
    }),
    clearSyncedDeletions: (ids) => write("deletions", (store) => {
      ids.forEach((id) => store.delete(String(id)));
    }),
    saveCredential,
    getCredential,
    deleteCredential: (email) => write("credentials", (store) => store.delete(email.trim().toLowerCase()))
  };
})();
