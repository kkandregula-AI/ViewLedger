// src/lib/db.js
// IndexedDB database using idb library — persists data on device

import { openDB } from "idb";

const DB_NAME = "sms-ledger";
const DB_VERSION = 1;

let dbInstance = null;

// ─────────────────────────────────────────────
// INIT DB
// ─────────────────────────────────────────────
export async function initDB() {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Transactions store
      if (!db.objectStoreNames.contains("transactions")) {
        const store = db.createObjectStore("transactions", { keyPath: "id" });
        store.createIndex("date", "date");
        store.createIndex("type", "type");
        store.createIndex("category", "category");
      }
      // Settings store
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    },
  });

  return dbInstance;
}

// ─────────────────────────────────────────────
// INSERT TRANSACTION
// ─────────────────────────────────────────────
export async function insertTransaction(tx) {
  const db = await initDB();
  await db.put("transactions", tx);
  return true;
}

// ─────────────────────────────────────────────
// GET ALL TRANSACTIONS
// ─────────────────────────────────────────────
export async function getAllTransactions() {
  const db = await initDB();
  const all = await db.getAll("transactions");
  return all.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// ─────────────────────────────────────────────
// GET TRANSACTIONS BY MONTH
// ─────────────────────────────────────────────
export async function getMonthTransactions(year, month) {
  const all = await getAllTransactions();
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  return all.filter((t) => t.date.startsWith(prefix));
}

// ─────────────────────────────────────────────
// GET TODAY'S TRANSACTIONS
// ─────────────────────────────────────────────
export async function getTodayTransactions() {
  const all = await getAllTransactions();
  const today = new Date().toISOString().split("T")[0];
  return all.filter((t) => t.date.startsWith(today));
}

// ─────────────────────────────────────────────
// GET CATEGORY SUMMARY
// ─────────────────────────────────────────────
export async function getCategorySummary(days = 30) {
  const all = await getAllTransactions();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const filtered = all.filter((t) => t.type === "debit" && t.date >= since);

  const map = {};
  for (const tx of filtered) {
    const key = tx.category || "Other";
    if (!map[key]) map[key] = { category: key, icon: tx.categoryIcon, color: tx.categoryColor, total: 0, count: 0 };
    map[key].total += tx.amount;
    map[key].count += 1;
  }

  return Object.values(map).sort((a, b) => b.total - a.total);
}

// ─────────────────────────────────────────────
// GET MONTHLY TOTALS
// ─────────────────────────────────────────────
export async function getMonthlyTotals() {
  const all = await getAllTransactions();
  const map = {};
  for (const tx of all) {
    const month = tx.date.substring(0, 7);
    if (!map[month]) map[month] = { month, credit: 0, debit: 0, count: 0 };
    if (tx.type === "credit") map[month].credit += tx.amount;
    if (tx.type === "debit") map[month].debit += tx.amount;
    map[month].count += 1;
  }
  return Object.values(map).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 6);
}

// ─────────────────────────────────────────────
// DELETE TRANSACTION
// ─────────────────────────────────────────────
export async function deleteTransaction(id) {
  const db = await initDB();
  await db.delete("transactions", id);
}

// ─────────────────────────────────────────────
// UPDATE CATEGORY
// ─────────────────────────────────────────────
export async function updateTransactionCategory(id, category, icon, color) {
  const db = await initDB();
  const tx = await db.get("transactions", id);
  if (tx) {
    tx.category = category;
    tx.categoryIcon = icon;
    tx.categoryColor = color;
    await db.put("transactions", tx);
  }
}

// ─────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────
export async function getSetting(key) {
  const db = await initDB();
  const row = await db.get("settings", key);
  return row?.value || null;
}

export async function setSetting(key, value) {
  const db = await initDB();
  await db.put("settings", { key, value: String(value) });
}

// ─────────────────────────────────────────────
// EXPORT ALL
// ─────────────────────────────────────────────
export async function exportAllData() {
  const all = await getAllTransactions();
  return JSON.stringify({ exportedAt: new Date().toISOString(), count: all.length, transactions: all }, null, 2);
}

// ─────────────────────────────────────────────
// CLEAR ALL
// ─────────────────────────────────────────────
export async function clearAllTransactions() {
  const db = await initDB();
  await db.clear("transactions");
}

// ─────────────────────────────────────────────
// TRANSACTION COUNT
// ─────────────────────────────────────────────
export async function getTransactionCount() {
  const db = await initDB();
  return await db.count("transactions");
}
