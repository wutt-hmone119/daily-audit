"use strict";

const recordViewStyles = document.createElement("style");
recordViewStyles.textContent = `
  body.record-view-open { overflow: hidden; }
  .record-view-overlay {
    position: fixed; z-index: 10000; inset: 0; display: grid; place-items: center;
    padding: 20px; background: rgba(15, 35, 63, .42); backdrop-filter: blur(5px);
  }
  .record-view-dialog {
    width: min(680px, 100%); max-height: calc(100vh - 40px); overflow-y: auto;
    border: 1px solid rgba(255,255,255,.72); border-radius: 18px; background: #fff;
    box-shadow: 0 24px 70px rgba(15,35,63,.24);
  }
  .record-view-header {
    display:flex; align-items:center; justify-content:space-between; gap:16px;
    padding:20px 22px 16px; border-bottom:1px solid #edf2f7;
  }
  .record-view-header h2 { margin:2px 0 0; font-size:21px; color:#10233f; }
  .record-view-eyebrow { margin:0; color:#64748b; font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; }
  .record-view-close {
    width:38px;height:38px;border:1px solid #dfe7f1;border-radius:11px;background:#f8fafc;
    color:#52617a;font-size:24px;line-height:1;cursor:pointer;
  }
  .record-view-close:hover { background:#eef4ff;color:#1d4ed8; }
  .record-view-meta {
    display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:16px 22px;
  }
  .record-view-meta-card { display:flex;flex-direction:column;gap:5px;padding:12px;border:1px solid #e5edf6;border-radius:12px;background:#f8fbff; }
  .record-view-meta-card span { color:#718096;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase; }
  .record-view-meta-card strong { color:#263b58;font-size:13px;overflow-wrap:anywhere; }
  .record-view-items { margin:0 22px 16px;border:1px solid #e5edf6;border-radius:12px;overflow:hidden; }
  .record-view-items-title { display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:#f8fafc;border-bottom:1px solid #edf2f7; }
  .record-view-items-title h3 { margin:0;font-size:14px }.record-view-items-title span { color:#64748b;font-size:11px;font-weight:700 }
  .record-view-item { display:flex;justify-content:space-between;gap:14px;align-items:center;padding:12px 14px;border-bottom:1px solid #f0f3f7; }
  .record-view-item:last-child { border-bottom:0 }.record-view-item>div { display:flex;flex-direction:column;gap:3px }
  .record-view-item>div strong { color:#263b58;font-size:13px }.record-view-item>div span { color:#7b8798;font-size:11px }
  .record-view-item>strong { color:#16304f;font-size:13px;white-space:nowrap }
  .record-view-summary {
    display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 22px 22px;
  }
  .record-view-summary>div { display:flex;flex-direction:column;gap:5px;padding:10px;border:1px solid #e5edf6;border-radius:11px;background:#fbfcfe }
  .record-view-summary span { color:#718096;font-size:10px;text-transform:uppercase;font-weight:700 }.record-view-summary strong { color:#263b58;font-size:12px }
  .record-view-summary .record-view-due { color:#b87918 }.record-view-summary .record-view-paid { color:#14876b }
  body.export-filter-open { overflow:hidden }
  .export-filter-overlay { position:fixed;z-index:10001;inset:0;display:grid;place-items:center;padding:20px;background:rgba(15,35,63,.42);backdrop-filter:blur(5px) }
  .export-filter-dialog { width:min(460px,100%);border:1px solid rgba(255,255,255,.72);border-radius:18px;background:#fff;box-shadow:0 24px 70px rgba(15,35,63,.24);overflow:hidden }
  .export-filter-header { display:flex;justify-content:space-between;align-items:center;padding:18px 20px;border-bottom:1px solid #edf2f7 }
  .export-filter-header p { margin:0 0 3px;color:#64748b;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase }.export-filter-header h2{margin:0;font-size:20px}
  .export-filter-close { width:36px;height:36px;border:1px solid #dfe7f1;border-radius:10px;background:#f8fafc;color:#52617a;font-size:22px;cursor:pointer }
  .export-filter-body { display:grid;grid-template-columns:1fr;gap:14px;padding:18px 20px }
  .export-filter-field { display:flex;flex-direction:column;gap:7px;color:#52677f;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em }
  .export-filter-field select { width:100%;height:44px;padding:9px 11px;border:1px solid #d7e1ef;border-radius:10px;background:#f9fbfe;color:#10233f;font:600 13px "Segoe UI",sans-serif;text-transform:none }
  .export-filter-actions { display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid #edf2f7;background:#fafcff }
  .export-filter-actions button { min-height:40px;padding:8px 14px;border-radius:9px;font-weight:700;cursor:pointer }
  .export-filter-cancel { border:1px solid #dfe7f1;background:#fff;color:#52617a }.export-filter-submit{border:1px solid #1d4ed8;background:#1d4ed8;color:#fff}
  @media(max-width:620px){
    .record-view-overlay{padding:10px}.record-view-dialog{max-height:calc(100vh - 20px);border-radius:14px}
    .record-view-meta{grid-template-columns:1fr}.record-view-summary{grid-template-columns:repeat(2,minmax(0,1fr))}
  }
`;
document.head.append(recordViewStyles);

if (document.body.dataset.page && localStorage.getItem("daily-audit-session-v1") !== "active") {
  window.location.replace("login.html");
}

const STORAGE_KEY = "daily-audit-deliveries-v1";
const form = document.getElementById("delivery-form");
const itemsBody = document.getElementById("items-body");
const deliveryDate = document.getElementById("delivery-date");
const filterDate = document.getElementById("filter-date");
const filterText = document.getElementById("filter-text");
const paidAmountInput = document.getElementById("paid-amount");
const message = document.getElementById("app-message") || document.getElementById("history-message");
const currency = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
let deliveries = [];
let editingId = null;
let messageTimer;

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMoney(value) {
  return currency.format(value);
}

function recordTotal(delivery) {
  return delivery.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

function normalizeDelivery(delivery) {
  if (!delivery || typeof delivery !== "object" || !Array.isArray(delivery.items)) {
    throw new Error("Stored delivery data contains an invalid record.");
  }
  const items = delivery.items.map((item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    if (!item.name || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error("Stored delivery data contains an invalid item.");
    }
    return {
      name: String(item.name),
      quantity,
      unitPrice
    };
  });
  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const paidAmount = Number.isFinite(Number(delivery.paidAmount))
    ? Math.max(0, Number(delivery.paidAmount))
    : delivery.paid ? total : 0;
  return {
    id: String(delivery.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`),
    date: String(delivery.date || ""),
    movementType: delivery.movementType === "outgoing" ? "outgoing" : "incoming",
    truck: String(delivery.truck || ""),
    supplier: String(delivery.supplier || ""),
    preparedBy: String(delivery.preparedBy || ""),
    paidAmount,
    items,
    createdAt: typeof delivery.createdAt === "string" ? delivery.createdAt : null,
    updatedAt: typeof delivery.updatedAt === "string" ? delivery.updatedAt : null
  };
}

async function loadDeliveries() {
  try {
    await window.DailyAuditStore.migrateLegacyDeliveries();
    const records = await window.DailyAuditStore.listDeliveries();
    return records.map(normalizeDelivery);
  } catch (error) {
    console.error("Could not load IndexedDB records.", error);
    window.alert("Could not read offline records from IndexedDB.");
    return [];
  }
}

async function saveDeliveries() {
  try {
    const pending = deliveries.map((delivery) => ({
      ...normalizeDelivery(delivery),
      syncStatus: "pending"
    }));
    await window.DailyAuditStore.putDeliveries(pending);
    if (navigator.onLine) synchronizePending();
    return true;
  } catch (error) {
    console.error("Could not save Daily Audit records to IndexedDB.", error);
    window.alert("Could not save the record. Please check available IndexedDB storage.");
    return false;
  }
}

async function synchronizePending() {
  if (!navigator.onLine || synchronizePending.running) return;
  synchronizePending.running = true;
  try {
    const pending = (await window.DailyAuditStore.listDeliveries())
      .filter((delivery) => delivery.syncStatus === "pending")
      .map(normalizeDelivery);
    const deletions = await window.DailyAuditStore.listDeletions();
    const deletedIds = deletions.map((item) => item.id);
    if (pending.length || deletedIds.length) {
      const response = await fetch("/api/deliveries/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveries: pending, deletedIds })
      });
      if (!response.ok) throw new Error("Could not synchronize pending audit records.");
      await window.DailyAuditStore.markSynced(pending.map((delivery) => ({
        id: delivery.id,
        updatedAt: delivery.updatedAt
      })));
      await window.DailyAuditStore.clearSyncedDeletions(deletedIds);
    }

    const response = await fetch("/api/deliveries");
    if (!response.ok) throw new Error("Could not refresh server audit records.");
    const result = await response.json();
    if (Array.isArray(result.deliveries)) {
      const deleted = new Set((await window.DailyAuditStore.listDeletions()).map((item) => item.id));
      const localRecords = await window.DailyAuditStore.listDeliveries();
      const pendingById = new Map(localRecords
        .filter((delivery) => delivery.syncStatus === "pending")
        .map((delivery) => [delivery.id, delivery]));
      const merged = new Map();
      result.deliveries.map(normalizeDelivery).forEach((delivery) => {
        if (!deleted.has(delivery.id) && !pendingById.has(delivery.id)) {
          merged.set(delivery.id, { ...delivery, syncStatus: "synced" });
        }
      });
      localRecords.forEach((delivery) => {
        if (!deleted.has(delivery.id)) merged.set(delivery.id, delivery);
      });
      await window.DailyAuditStore.putDeliveries([...merged.values()]);
      deliveries = [...merged.values()].map(normalizeDelivery);
      renderAll();
    }
  } catch (error) {
    console.error("Daily Audit synchronization failed.", error);
  } finally {
    synchronizePending.running = false;
  }
}

async function loadDeliveriesFromDatabase() {
  await window.DailyAuditStore.migrateLegacyDeliveries();
  deliveries = await loadDeliveries();
  renderAll();
  if (navigator.onLine) synchronizePending();
}

async function requestPersistentStorage() {
  if (!("storage" in navigator) || !navigator.storage.persist) return;
  try {
    await navigator.storage.persist();
  } catch (error) {
    console.warn("Could not request persistent browser storage.", error);
  }
}

function createItemRow(item = {}) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td><input class="item-input item-name" type="text" maxlength="100" placeholder="Example - Rice" aria-label="Item name" required></td>
    <td><input class="item-input numeric item-quantity" type="number" inputmode="decimal" enterkeyhint="next" min="0.01" step="any" value="${item.quantity ?? 1}" placeholder="1" aria-label="Quantity" required></td>
    <td><input class="item-input numeric item-price" type="number" inputmode="decimal" enterkeyhint="next" min="0" step="any" value="${item.unitPrice ?? ""}" placeholder="0" aria-label="Unit price" required></td>
    <td><span class="line-total">0</span></td>
    <td><button class="icon-button remove-item" type="button" aria-label="Remove this item">×</button></td>`;
  row.querySelector(".item-name").value = item.name || "";
  itemsBody.append(row);
  return row;
}

function getFormItems() {
  return [...itemsBody.querySelectorAll("tr")].map((row) => ({
    name: row.querySelector(".item-name").value.trim(),
    quantity: Number(row.querySelector(".item-quantity").value),
    unitPrice: Number(row.querySelector(".item-price").value)
  }));
}

function updateFormTotal() {
  if (!itemsBody || !paidAmountInput) return;
  let total = 0;
  const itemCount = itemsBody.querySelectorAll("tr").length;
  const itemCountLabel = document.getElementById("item-type-count");
  if (itemCountLabel) itemCountLabel.textContent = `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
  itemsBody.querySelectorAll("tr").forEach((row) => {
    const quantity = Number(row.querySelector(".item-quantity").value) || 0;
    const unitPrice = Number(row.querySelector(".item-price").value) || 0;
    const lineTotal = quantity * unitPrice;
    total += lineTotal;
    row.querySelector(".line-total").textContent = formatMoney(lineTotal);
  });
  const paid = Number(paidAmountInput.value) || 0;
  document.getElementById("form-total").textContent = formatMoney(total);
  document.getElementById("form-due").textContent = formatMoney(Math.max(0, total - paid));
  paidAmountInput.max = String(total);
}

function showMessage(text) {
  if (!message) return;
  message.textContent = text;
  window.clearTimeout(messageTimer);
  messageTimer = window.setTimeout(() => { message.textContent = ""; }, 3500);
}

function showPage(pageName) {
  if (pageName === "dashboard") renderDashboard();
  else if (pageName === "detail") renderDetail();
  else if (pageName === "history") renderHistory();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function sortedDeliveries(records) {
  return [...records].sort((a, b) => b.date.localeCompare(a.date)
    || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

function renderDashboard() {
  const incoming = deliveries.filter((delivery) => delivery.movementType === "incoming");
  const outgoing = deliveries.filter((delivery) => delivery.movementType === "outgoing");
  const total = incoming.reduce((sum, delivery) => sum + recordTotal(delivery), 0);
  const paid = incoming.reduce((sum, delivery) => sum + Math.min(recordTotal(delivery), delivery.paidAmount), 0);
  const outgoingTotal = outgoing.reduce((sum, delivery) => sum + recordTotal(delivery), 0);
  const dashboardDate = document.getElementById("dashboard-filter-date");
  const dateValue = dashboardDate ? dashboardDate.value : "";
  const recent = sortedDeliveries(deliveries.filter((delivery) => !dateValue || delivery.date === dateValue)).slice(0, 100);
  document.getElementById("summary-count").textContent = String(deliveries.length);
  document.getElementById("summary-total").textContent = formatMoney(total);
  document.getElementById("summary-paid").textContent = formatMoney(outgoingTotal);
  document.getElementById("summary-unpaid").textContent = formatMoney(Math.max(0, total - paid));
  renderStock();
  document.getElementById("dashboard-empty").hidden = recent.length > 0;
  renderList(document.getElementById("dashboard-list"), recent);
}

function productKey(name) {
  return name.trim().toLocaleLowerCase();
}

function getStockBalances(records = deliveries) {
  const products = new Map();
  sortedDeliveries(records).reverse().forEach((delivery) => {
    delivery.items.forEach((item) => {
      const key = productKey(item.name);
      if (!products.has(key)) products.set(key, { name: item.name, incoming: 0, outgoing: 0 });
      const product = products.get(key);
      if (delivery.movementType === "outgoing") product.outgoing += item.quantity;
      else product.incoming += item.quantity;
    });
  });
  return products;
}

function getStockViolation(records) {
  const stock = new Map();
  const ordered = [...records].sort((a, b) => a.date.localeCompare(b.date)
    || String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
  for (const delivery of ordered) {
    if (delivery.movementType !== "outgoing") {
      delivery.items.forEach((item) => {
        const key = productKey(item.name);
        stock.set(key, (stock.get(key) || 0) + item.quantity);
      });
      continue;
    }
    for (const item of delivery.items) {
      const key = productKey(item.name);
      const available = stock.get(key) || 0;
      if (item.quantity > available + Number.EPSILON) {
        return { date: delivery.date, item: item.name, available, requested: item.quantity };
      }
      stock.set(key, available - item.quantity);
    }
  }
  return null;
}

function renderStock() {
  const products = [...getStockBalances().values()].sort((a, b) => a.name.localeCompare(b.name));
  const body = document.getElementById("stock-body");
  body.replaceChildren();
  document.getElementById("stock-empty").hidden = products.length > 0;
  document.querySelector(".stock-table").hidden = products.length === 0;
  products.forEach((product) => {
    const row = document.createElement("tr");
    const name = document.createElement("td");
    name.textContent = product.name;
    const incoming = document.createElement("td");
    incoming.textContent = formatMoney(product.incoming);
    const outgoing = document.createElement("td");
    outgoing.textContent = formatMoney(product.outgoing);
    const balance = document.createElement("td");
    balance.className = "stock-balance";
    balance.textContent = formatMoney(product.incoming - product.outgoing);
    row.append(name, incoming, outgoing, balance);
    body.append(row);
  });
}

function renderDetail() {
  if (!document.getElementById("detail-list") || !filterDate || !filterText) return;
  const searchDate = filterDate.value;
  const searchText = filterText.value.trim().toLocaleLowerCase();
  const shown = sortedDeliveries(deliveries.filter((delivery) => {
    if (searchDate && delivery.date !== searchDate) return false;
    if (!searchText) return true;
    const itemMatch = delivery.items.some((item) =>
      item.name.toLocaleLowerCase().includes(searchText)
    );
    const partnerMatch = delivery.supplier.toLocaleLowerCase().includes(searchText);
    return itemMatch || partnerMatch;
  }));
  const empty = shown.length === 0;
  document.getElementById("detail-empty").hidden = !empty;
  const hasFilter = Boolean(searchDate || searchText);
  document.getElementById("detail-empty-title").textContent = hasFilter ? "No matching records" : "No records yet";
  document.getElementById("detail-empty-description").textContent = hasFilter
    ? "Change the search text or date and try again."
    : "Add a new record using the form above.";
  renderList(document.getElementById("detail-list"), shown);
}

function renderHistory() {
  const historyList = document.getElementById("history-list");
  if (!historyList) return;
  const searchDate = document.getElementById("history-filter-date").value;
  const searchText = document.getElementById("history-filter-text").value.trim().toLocaleLowerCase();
  const shown = sortedDeliveries(deliveries.filter((delivery) => {
    if (searchDate && delivery.date !== searchDate) return false;
    if (!searchText) return true;
    const itemMatch = delivery.items.some((item) =>
      item.name.toLocaleLowerCase().includes(searchText)
    );
    const partnerMatch = delivery.supplier.toLocaleLowerCase().includes(searchText);
    const preparedByMatch = delivery.preparedBy.toLocaleLowerCase().includes(searchText);
    return itemMatch || partnerMatch || preparedByMatch;
  }));

  const empty = shown.length === 0;
  document.getElementById("history-empty").hidden = !empty;
  const hasFilter = Boolean(searchDate || searchText);
  document.getElementById("history-empty-title").textContent = hasFilter ? "No matching history" : "No records yet";
  document.getElementById("history-empty-description").textContent = hasFilter
    ? "Change the search information and try again."
    : "Saved records appear in History after being added on the Detail page.";
  renderList(document.getElementById("history-list"), shown);
}

function renderList(list, records) {
  list.replaceChildren();
  records.forEach((delivery) => list.append(createDeliveryCard(delivery)));
}

function formatCreatedAt(delivery) {
  if (!delivery.createdAt) return "Time not recorded";
  const date = new Date(delivery.createdAt);
  if (Number.isNaN(date.getTime())) return "Time not recorded";
  return new Intl.DateTimeFormat("my-MM", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit"
  }).format(date);
}

function formatCsvCreatedAt(delivery) {
  if (!delivery.createdAt) return "";
  const date = new Date(delivery.createdAt);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function createDeliveryCard(delivery) {
  const total = recordTotal(delivery);
  const paid = delivery.movementType === "incoming" ? Math.min(total, delivery.paidAmount) : 0;
  const due = delivery.movementType === "incoming" ? Math.max(0, total - paid) : 0;
  const card = document.createElement("article");
  card.className = "delivery-card";
  const main = document.createElement("div");
  main.className = "delivery-main";

  const info = document.createElement("div");
  info.className = "delivery-info";
  const tile = document.createElement("div");
  tile.className = "date-tile";
  const date = new Date(`${delivery.date}T00:00:00`);
  tile.textContent = Number.isNaN(date.getTime())
    ? delivery.date
    : new Intl.DateTimeFormat("my-MM", { day: "2-digit", month: "short" }).format(date);
  const description = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = delivery.movementType === "outgoing"
    ? `Outgoing items · ${delivery.truck || "Outgoing record"}`
    : `Incoming items · Truck - ${delivery.truck}`;
  const people = document.createElement("p");
  const partnerLabel = delivery.movementType === "outgoing" ? "Recipient" : "Supplier";
  people.textContent = `${partnerLabel} - ${delivery.supplier || "Not recorded"} · Prepared by - ${delivery.preparedBy || "Not recorded"} · ${delivery.items.length} ${delivery.items.length === 1 ? "item" : "items"}`;
  const recordedAt = document.createElement("p");
  recordedAt.className = "recorded-at";
  recordedAt.textContent = `Recorded at - ${formatCreatedAt(delivery)}`;
  description.append(title, people, recordedAt);
  info.append(tile, description);

  const amountBlock = document.createElement("div");
  amountBlock.className = "delivery-amount";
  const amountText = document.createElement("strong");
  amountText.textContent = `${formatMoney(total)} Kyat`;
  const badge = document.createElement("span");
  badge.className = `badge ${due > 0 ? "badge-unpaid" : "badge-paid"}`;
  badge.textContent = delivery.movementType === "outgoing"
    ? "Outgoing items"
    : due > 0 ? `Due ${formatMoney(due)} Kyat` : "Paid";
  amountBlock.append(amountText, badge);
  main.append(info, amountBlock);
  card.append(main);

  const itemList = document.createElement("div");
  itemList.className = "delivery-items";
  delivery.items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "delivery-item";
    const name = document.createElement("span");
    name.textContent = item.name;
    const quantity = document.createElement("span");
    quantity.textContent = `${formatMoney(item.quantity)} × ${formatMoney(item.unitPrice)}`;
    const lineTotal = document.createElement("strong");
    lineTotal.textContent = `${formatMoney(item.quantity * item.unitPrice)} Kyat`;
    row.append(name, quantity, lineTotal);
    itemList.append(row);
  });
  card.append(itemList);

  const actions = document.createElement("div");
  actions.className = "delivery-actions";
  const viewButton = document.createElement("button");
  viewButton.className = "small-button";
  viewButton.type = "button";
  viewButton.textContent = "View";
  viewButton.addEventListener("click", () => viewDelivery(delivery.id));
  actions.append(viewButton);
  if (due > 0) {
    const paidButton = document.createElement("button");
    paidButton.className = "small-button";
    paidButton.type = "button";
    paidButton.textContent = "Mark remaining amount as paid";
    paidButton.addEventListener("click", () => markPaid(delivery.id));
    actions.append(paidButton);
  }
  const editButton = document.createElement("button");
  editButton.className = "small-button";
  editButton.type = "button";
  editButton.textContent = "Edit";
  editButton.addEventListener("click", () => editDelivery(delivery.id));
  const deleteButton = document.createElement("button");
  deleteButton.className = "small-button delete";
  deleteButton.type = "button";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", () => deleteDelivery(delivery.id));
  actions.append(editButton, deleteButton);
  card.append(actions);
  return card;
}

function viewDelivery(id) {
  const delivery = deliveries.find((record) => record.id === id);
  if (!delivery) return;

  const existing = document.querySelector(".record-view-overlay");
  if (existing) existing.remove();

  const total = recordTotal(delivery);
  const paid = delivery.movementType === "incoming" ? Math.min(total, delivery.paidAmount) : 0;
  const due = delivery.movementType === "incoming" ? Math.max(0, total - paid) : 0;
  const status = delivery.movementType === "outgoing"
    ? "Outgoing"
    : due === 0 ? "Paid" : paid > 0 ? "Partially paid" : "Unpaid";
  const partnerLabel = delivery.movementType === "outgoing" ? "Recipient" : "Supplier";

  const overlay = document.createElement("div");
  overlay.className = "record-view-overlay";
  overlay.setAttribute("role", "presentation");

  const dialog = document.createElement("section");
  dialog.className = "record-view-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", "Audit record details");

  dialog.innerHTML = `
    <header class="record-view-header">
      <div>
        <p class="record-view-eyebrow">Audit record</p>
        <h2>${delivery.movementType === "outgoing" ? "Outgoing" : "Incoming"} record</h2>
      </div>
      <button class="record-view-close" type="button" aria-label="Close">×</button>
    </header>
    <div class="record-view-meta">
      <div class="record-view-meta-card"><span>Date</span><strong>${escapeHtml(delivery.date)}</strong></div>
      <div class="record-view-meta-card"><span>${delivery.movementType === "outgoing" ? "Record type" : "Truck"}</span><strong>${escapeHtml(delivery.movementType === "outgoing" ? "Outgoing" : delivery.truck || "Not recorded")}</strong></div>
      <div class="record-view-meta-card"><span>${partnerLabel}</span><strong>${escapeHtml(delivery.supplier || "Not recorded")}</strong></div>
      <div class="record-view-meta-card"><span>Prepared by</span><strong>${escapeHtml(delivery.preparedBy || "Not recorded")}</strong></div>
    </div>
    <div class="record-view-items">
      <div class="record-view-items-title"><h3>Items</h3><span>${delivery.items.length} ${delivery.items.length === 1 ? "item" : "items"}</span></div>
      ${delivery.items.map((item) => `
        <div class="record-view-item">
          <div><strong>${escapeHtml(item.name)}</strong><span>${formatMoney(item.quantity)} × ${formatMoney(item.unitPrice)} Kyat</span></div>
          <strong>${formatMoney(item.quantity * item.unitPrice)} Kyat</strong>
        </div>`).join("")}
    </div>
    <footer class="record-view-summary">
      <div><span>Total</span><strong>${formatMoney(total)} Kyat</strong></div>
      ${delivery.movementType === "incoming" ? `
        <div><span>Paid</span><strong>${formatMoney(paid)} Kyat</strong></div>
        <div><span>Due</span><strong>${formatMoney(due)} Kyat</strong></div>` : ""}
      <div><span>Status</span><strong class="${due > 0 ? "record-view-due" : "record-view-paid"}">${status}</strong></div>
    </footer>
  `;

  overlay.append(dialog);
  document.body.append(overlay);
  document.body.classList.add("record-view-open");

  const close = () => {
    overlay.remove();
    document.body.classList.remove("record-view-open");
  };
  dialog.querySelector(".record-view-close").addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener("keydown", function onEscape(event) {
    if (event.key === "Escape") {
      close();
      document.removeEventListener("keydown", onEscape);
    }
  });
  dialog.querySelector(".record-view-close").focus();
}

function editDelivery(id) {
  const delivery = deliveries.find((record) => record.id === id);
  if (!delivery) return;
  editingId = delivery.id;
  deliveryDate.value = delivery.date;
  document.getElementById("movement-type").value = delivery.movementType;
  document.getElementById("truck-name").value = delivery.truck;
  document.getElementById("supplier-name").value = delivery.supplier;
  document.getElementById("prepared-by").value = delivery.preparedBy;
  paidAmountInput.value = String(delivery.paidAmount);
  syncMovementFields();
  itemsBody.replaceChildren();
  delivery.items.forEach((item) => createItemRow(item));
  updateFormTotal();
  document.getElementById("form-eyebrow").textContent = "Editing existing record";
  document.getElementById("form-title").textContent = "Edit record details";
  document.getElementById("save-button").textContent = "Save changes";
  document.getElementById("cancel-edit").hidden = false;
  showPage("detail");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetForm() {
  editingId = null;
  form.reset();
  deliveryDate.value = localDateString(new Date());
  document.getElementById("movement-type").value = "incoming";
  document.getElementById("truck-name").value = "";
  paidAmountInput.value = "0";
  itemsBody.replaceChildren();
  createItemRow();
  updateFormTotal();
  document.getElementById("form-eyebrow").textContent = "New record";
  document.getElementById("form-title").textContent = "Record incoming or outgoing items";
  document.getElementById("save-button").textContent = "Save record";
  document.getElementById("cancel-edit").hidden = true;
  syncMovementFields();
}

function syncMovementFields() {
  if (!document.getElementById("movement-type")) return;
  const isIncoming = document.getElementById("movement-type").value === "incoming";
  const truckField = document.getElementById("truck-field");
  const paidField = document.getElementById("paid-field");
  const truckInput = document.getElementById("truck-name");
  const partnerLabel = document.getElementById("partner-label");
  truckField.hidden = !isIncoming;
  paidField.hidden = !isIncoming;
  truckInput.required = isIncoming;
  paidAmountInput.required = isIncoming;
  partnerLabel.textContent = isIncoming ? "Supplier name" : "Recipient name";
  document.getElementById("supplier-name").placeholder = isIncoming ? "Supplier name" : "Recipient name";
  if (!isIncoming) {
    truckInput.value = "";
    paidAmountInput.value = "0";
  }
  updateFormTotal();
}

async function markPaid(id) {
  const delivery = deliveries.find((record) => record.id === id);
  if (!delivery) return;
  const previousPaidAmount = delivery.paidAmount;
  const previousUpdatedAt = delivery.updatedAt;
  delivery.paidAmount = recordTotal(delivery);
  delivery.updatedAt = new Date().toISOString();
  if (await saveDeliveries()) {
    renderAll();
    showMessage("The remaining balance was marked as fully paid.");
  } else {
    delivery.paidAmount = previousPaidAmount;
    delivery.updatedAt = previousUpdatedAt;
  }
}

async function deleteDelivery(id) {
  if (!window.confirm("Are you sure you want to delete this record?")) return;
  const previous = deliveries;
  deliveries = deliveries.filter((delivery) => delivery.id !== id);
  const stockViolation = getStockViolation(deliveries);
  if (stockViolation) {
    deliveries = previous;
    window.alert(`Deleting this record would make stock insufficient on ${stockViolation.date} for ${stockViolation.item}. Edit the outgoing record first.`);
    return;
  }
  if (await saveDeliveries()) {
    await window.DailyAuditStore.markDeleted(id);
    if (navigator.onLine) synchronizePending();
    renderAll();
    showMessage("The record was deleted.");
  } else {
    deliveries = previous;
  }
}

function renderAll() {
  const pageName = document.body.dataset.page;
  showPage(pageName);
}

function csvCell(value) {
  const text = String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function exportJson() {
  const json = JSON.stringify(deliveries, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `daily-audit-history-${localDateString(new Date())}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showMessage("The JSON backup file was exported.");
}

async function importJson(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const source = Array.isArray(parsed) ? parsed : parsed.deliveries;
    if (!Array.isArray(source)) throw new Error("JSON data is not a deliveries list.");
    const imported = source.map(normalizeDelivery);
    const importedIds = new Set(imported.map((delivery) => delivery.id));
    const removedIds = deliveries
      .map((delivery) => delivery.id)
      .filter((id) => !importedIds.has(id));
    deliveries = imported;
    if (!await saveDeliveries()) throw new Error("Could not save imported JSON data.");
    await Promise.all(removedIds.map((id) => window.DailyAuditStore.markDeleted(id)));
    if (navigator.onLine) synchronizePending();
    renderAll();
    showMessage(`Restored ${imported.length} records from JSON.`);
  } catch (error) {
    console.error("Could not import Daily Audit JSON.", error);
    showMessage("Invalid JSON file. Please select a valid backup file.");
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getVisibleExportRecords() {
  const pageName = document.body.dataset.page;
  if (pageName === "history") {
    const date = document.getElementById("history-filter-date")?.value || "";
    const text = document.getElementById("history-filter-text")?.value.trim().toLocaleLowerCase() || "";
    return sortedDeliveries(deliveries.filter((delivery) => {
      if (date && delivery.date !== date) return false;
      if (!text) return true;
      return delivery.supplier.toLocaleLowerCase().includes(text)
        || delivery.preparedBy.toLocaleLowerCase().includes(text)
        || delivery.items.some((item) => item.name.toLocaleLowerCase().includes(text));
    }));
  }
  if (pageName === "dashboard") {
    const date = document.getElementById("dashboard-filter-date")?.value || "";
    return sortedDeliveries(deliveries.filter((delivery) => !date || delivery.date === date));
  }
  const date = filterDate?.value || "";
  const text = filterText?.value.trim().toLocaleLowerCase() || "";
  return sortedDeliveries(deliveries.filter((delivery) => {
    if (date && delivery.date !== date) return false;
    if (!text) return true;
    return delivery.supplier.toLocaleLowerCase().includes(text)
      || delivery.items.some((item) => item.name.toLocaleLowerCase().includes(text));
  }));
}

function openExportDialog(format) {
  const existing = document.querySelector(".export-filter-overlay");
  if (existing) existing.remove();

  const suppliers = [...new Set(deliveries
    .map((delivery) => String(delivery.supplier || "").trim())
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  const dates = [...new Set(deliveries.map((delivery) => delivery.date).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a));

  const overlay = document.createElement("div");
  overlay.className = "export-filter-overlay";
  overlay.innerHTML = `
    <section class="export-filter-dialog" role="dialog" aria-modal="true" aria-label="Export filters">
      <header class="export-filter-header">
        <div><p>Filtered export</p><h2>${format === "csv" ? "Export CSV" : "Print / PDF"}</h2></div>
        <button class="export-filter-close" type="button" aria-label="Close">×</button>
      </header>
      <div class="export-filter-body">
        <label class="export-filter-field">
          <span>Supplier / Recipient</span>
          <select id="export-supplier">
            <option value="">All suppliers / recipients</option>
            ${suppliers.map((supplier) => `<option value="${escapeHtml(supplier)}">${escapeHtml(supplier)}</option>`).join("")}
          </select>
        </label>
        <label class="export-filter-field">
          <span>Date</span>
          <select id="export-date">
            <option value="">All dates</option>
            ${dates.map((date) => `<option value="${escapeHtml(date)}">${escapeHtml(date)}</option>`).join("")}
          </select>
        </label>
      </div>
      <footer class="export-filter-actions">
        <button class="export-filter-cancel" type="button">Cancel</button>
        <button class="export-filter-submit" type="button">${format === "csv" ? "Export CSV" : "Create Cards"}</button>
      </footer>
    </section>`;
  document.body.append(overlay);
  document.body.classList.add("export-filter-open");

  const close = () => {
    overlay.remove();
    document.body.classList.remove("export-filter-open");
  };
  overlay.querySelector(".export-filter-close").addEventListener("click", close);
  overlay.querySelector(".export-filter-cancel").addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });

  const pageName = document.body.dataset.page;
  if (pageName === "detail" && filterDate?.value) {
    overlay.querySelector("#export-date").value = filterDate.value;
  } else if (pageName === "history") {
    const historyDate = document.getElementById("history-filter-date")?.value;
    if (historyDate) overlay.querySelector("#export-date").value = historyDate;
  } else if (pageName === "dashboard") {
    const dashboardDate = document.getElementById("dashboard-filter-date")?.value;
    if (dashboardDate) overlay.querySelector("#export-date").value = dashboardDate;
  }

  overlay.querySelector(".export-filter-submit").addEventListener("click", () => {
    const supplier = overlay.querySelector("#export-supplier").value.trim().toLocaleLowerCase();
    const date = overlay.querySelector("#export-date").value;
    const records = sortedDeliveries(deliveries.filter((delivery) => {
      if (date && delivery.date !== date) return false;
      if (supplier && delivery.supplier.trim().toLocaleLowerCase() !== supplier) return false;
      return true;
    }));
    close();
    if (records.length === 0) {
      showMessage("No records match the selected supplier and date.");
      return;
    }
    if (format === "csv") exportCsv(records);
    else exportCardReport(records);
  });
}

function exportCardReport(recordsToExport) {
  const records = recordsToExport || getVisibleExportRecords();
  if (records.length === 0) {
    showMessage("There are no records to print.");
    return;
  }

  const cards = records.map((delivery) => {
    const total = recordTotal(delivery);
    const paid = delivery.movementType === "incoming" ? Math.min(total, delivery.paidAmount) : 0;
    const due = delivery.movementType === "incoming" ? Math.max(0, total - paid) : 0;
    const status = delivery.movementType === "outgoing"
      ? "Outgoing"
      : due === 0 ? "Paid" : paid > 0 ? "Partially paid" : "Unpaid";
    const partnerLabel = delivery.movementType === "outgoing" ? "Recipient" : "Supplier";
    const itemRows = delivery.items.map((item) => `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${formatMoney(item.quantity)} × ${formatMoney(item.unitPrice)}</td>
        <td>${formatMoney(item.quantity * item.unitPrice)} Kyat</td>
      </tr>`).join("");

    return `
      <article class="audit-card">
        <header class="audit-card-header">
          <div>
            <p class="eyebrow">AUDIT RECORD</p>
            <h1>${delivery.movementType === "outgoing" ? "Outgoing" : "Incoming"} record</h1>
          </div>
          <div class="close-mark" aria-hidden="true">×</div>
        </header>
        <div class="meta-grid">
          <div class="meta-card"><span>Date</span><strong>${escapeHtml(delivery.date)}</strong></div>
          <div class="meta-card"><span>${delivery.movementType === "outgoing" ? "Record type" : "Truck"}</span><strong>${escapeHtml(delivery.movementType === "outgoing" ? "Outgoing" : delivery.truck || "Not recorded")}</strong></div>
          <div class="meta-card"><span>${partnerLabel}</span><strong>${escapeHtml(delivery.supplier || "Not recorded")}</strong></div>
          <div class="meta-card"><span>Prepared by</span><strong>${escapeHtml(delivery.preparedBy || "Not recorded")}</strong></div>
        </div>
        <section class="items-card">
          <header class="items-title"><h2>Items</h2><span>${delivery.items.length} ${delivery.items.length === 1 ? "item" : "items"}</span></header>
          <table class="items-table"><tbody>${itemRows}</tbody></table>
        </section>
        <footer class="summary-grid">
          <div><span>Total</span><strong>${formatMoney(total)} Kyat</strong></div>
          ${delivery.movementType === "incoming" ? `<div><span>Paid</span><strong>${formatMoney(paid)} Kyat</strong></div><div><span>Due</span><strong>${formatMoney(due)} Kyat</strong></div>` : ""}
          <div><span>Status</span><strong class="${due > 0 ? "due" : "paid"}">${status}</strong></div>
        </footer>
      </article>`;
  }).join("");

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    showMessage("Pop-up blocked. Allow pop-ups to print or save the report.");
    return;
  }
  printWindow.document.write(`<!doctype html>
    <html lang="en"><head><meta charset="utf-8"><title>Daily Audit Report</title>
    <style>
      *{box-sizing:border-box} body{margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#10233f}
      .report-title{display:none}
      .audit-card{width:840px;margin:18px auto;background:#fff;border:1px solid #dfe8f2;border-radius:14px;padding:18px 20px 20px;break-after:page;break-inside:avoid;box-shadow:0 12px 30px rgba(43,70,106,.08)}
      .audit-card:last-child{break-after:auto}
      .audit-card-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px}
      .audit-card-header .eyebrow{margin:0 0 4px;color:#64748b;font-size:10px;font-weight:700;letter-spacing:.06em}
      .audit-card-header h1{margin:0;color:#10233f;font-size:25px}
      .close-mark{width:42px;height:42px;display:grid;place-items:center;border:2px solid #ffad32;border-radius:11px;color:#10233f;font-size:28px;line-height:1}
      .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px}
      .meta-card{min-height:78px;display:flex;flex-direction:column;gap:8px;padding:13px 14px;border:1px solid #e1e9f4;border-radius:11px;background:#fff}
      .meta-card span{color:#718096;font-size:11px;font-weight:700;text-transform:uppercase}.meta-card strong{color:#263b58;font-size:14px}
      .items-card{border:1px solid #e1e9f4;border-radius:11px;overflow:hidden;margin-bottom:18px}
      .items-title{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid #edf2f7}.items-title h2{margin:0;font-size:15px}.items-title span{color:#718096;font-size:11px;font-weight:700}
      .items-table{width:100%;border-collapse:collapse}.items-table td{padding:13px 14px;border-bottom:1px solid #edf2f7}.items-table tr:last-child td{border-bottom:0}.items-table td:nth-child(2){text-align:center}.items-table td:nth-child(3){text-align:right;font-weight:700}
      .summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.summary-grid>div{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid #e1e9f4;border-radius:11px}.summary-grid span{color:#718096;font-size:10px;font-weight:700;text-transform:uppercase}.summary-grid strong{font-size:13px}.summary-grid .due{color:#b87918}.summary-grid .paid{color:#14876b}
      @media print{body{background:#fff}.audit-card{width:100%;margin:0;border:0;box-shadow:none;border-bottom:1px solid #dfe7ef;border-radius:0;padding:16px}}
    </style></head><body>
      <h1 class="report-title">Daily Audit Report</h1>
      ${cards}
    </body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.setTimeout(() => printWindow.print(), 250);
  showMessage(`Prepared ${records.length} record(s) for print or PDF.`);
}

function exportCsv(recordsToExport) {
  const filter = filterDate ? filterDate.value : "";
  const records = recordsToExport || sortedDeliveries(deliveries.filter((delivery) => {
    if (filter && delivery.date !== filter) return false;
    return true;
  }));
  if (records.length === 0) {
    showMessage(filter ? "No records exist for the selected date." : "There are no records to export.");
    return;
  }
  const headers = [
    "Date", "Incoming / Outgoing", "Truck number / name", "Supplier / Recipient", "Prepared by", "Recorded at",
    "Payment status", "Amount paid (Kyat)", "Amount due (Kyat)", "Item count", "Items",
    "Item total (Kyat)"
  ];
  const rows = [headers];
  records.forEach((delivery) => {
    const total = recordTotal(delivery);
    const paid = delivery.movementType === "incoming" ? Math.min(total, delivery.paidAmount) : 0;
    const due = delivery.movementType === "incoming" ? Math.max(0, total - paid) : 0;
    const status = delivery.movementType === "outgoing"
      ? "Outgoing items"
      : due === 0 ? "Paid" : paid > 0 ? "Partially paid" : "Unpaid";
    const itemSummary = delivery.items.map((item) =>
      `${item.name}: ${formatMoney(item.quantity)} x ${formatMoney(item.unitPrice)} = ${formatMoney(item.quantity * item.unitPrice)}`
    ).join(" | ");
    rows.push([
      delivery.date, delivery.movementType === "outgoing" ? "Outgoing" : "Incoming",
      delivery.truck, delivery.supplier, delivery.preparedBy, formatCsvCreatedAt(delivery),
      status, paid, due, delivery.items.length, itemSummary, total
    ]);
  });

  const csv = "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `daily-audit-${filter || localDateString(new Date())}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showMessage("The CSV file was exported for Excel.");
}

if (form) form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const items = getFormItems();
  if (items.length === 0 || items.some((item) => !item.name || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) {
    showMessage("Enter a valid item name, quantity, and unit price.");
    return;
  }
  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const movementType = document.getElementById("movement-type").value;
  const paidAmount = movementType === "incoming" ? Number(paidAmountInput.value) : 0;
  if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > total) {
    showMessage("The amount paid must be between zero and the total value.");
    paidAmountInput.focus();
    return;
  }

  const now = new Date().toISOString();
  const existing = editingId ? deliveries.find((delivery) => delivery.id === editingId) : null;
  const record = {
    id: editingId || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    date: deliveryDate.value,
    movementType,
    truck: document.getElementById("truck-name").value.trim(),
    supplier: document.getElementById("supplier-name").value.trim(),
    preparedBy: document.getElementById("prepared-by").value.trim(),
    paidAmount,
    items,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: existing ? now : null
  };
  if ((movementType === "incoming" && !record.truck) || !record.supplier || !record.preparedBy) {
    showMessage("Please complete the required names and record information.");
    return;
  }

  const previous = deliveries;
  let updatedDeliveries;
  if (existing) {
    updatedDeliveries = deliveries.map((delivery) => delivery.id === editingId ? record : delivery);
  } else {
    updatedDeliveries = [...deliveries, record];
  }
  const stockViolation = getStockViolation(updatedDeliveries);
  if (stockViolation) {
    showMessage(`${stockViolation.item} has only ${formatMoney(stockViolation.available)} available on ${stockViolation.date}. Check the outgoing quantity.`);
    return;
  }
  deliveries = updatedDeliveries;
  if (await saveDeliveries()) {
    const wasEditing = Boolean(existing);
    resetForm();
    renderAll();
    showMessage(wasEditing ? "The changes were saved." : "The record was saved.");
  } else {
    deliveries = previous;
  }
});

const addItemButton = document.getElementById("add-item-button");
if (addItemButton) addItemButton.addEventListener("click", () => {
  createItemRow();
  updateFormTotal();
  itemsBody.lastElementChild.querySelector(".item-name").focus();
});

if (itemsBody) itemsBody.addEventListener("input", updateFormTotal);
if (itemsBody) itemsBody.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-item");
  if (!button) return;
  if (itemsBody.children.length === 1) {
    showMessage("At least one item is required.");
    return;
  }
  button.closest("tr").remove();
  updateFormTotal();
});

if (paidAmountInput) paidAmountInput.addEventListener("input", updateFormTotal);
if (paidAmountInput) paidAmountInput.addEventListener("focus", () => paidAmountInput.select());
const movementTypeInput = document.getElementById("movement-type");
if (movementTypeInput) movementTypeInput.addEventListener("change", syncMovementFields);
if (filterDate) filterDate.addEventListener("input", renderDetail);
if (filterText) filterText.addEventListener("input", renderDetail);
const clearDetailFilter = document.getElementById("clear-filter");
if (clearDetailFilter) clearDetailFilter.addEventListener("click", () => {
  filterDate.value = "";
  filterText.value = "";
  renderDetail();
});
const historyFilterDate = document.getElementById("history-filter-date");
const historyFilterText = document.getElementById("history-filter-text");
if (historyFilterDate) historyFilterDate.addEventListener("input", renderHistory);
if (historyFilterText) historyFilterText.addEventListener("input", renderHistory);
const clearHistoryFilter = document.getElementById("history-clear-filter");
if (clearHistoryFilter) clearHistoryFilter.addEventListener("click", () => {
  document.getElementById("history-filter-date").value = "";
  document.getElementById("history-filter-text").value = "";
  renderHistory();
});
const exportJsonButton = document.getElementById("export-json-button");
if (exportJsonButton) exportJsonButton.addEventListener("click", exportJson);
const importJsonButton = document.getElementById("import-json-button");
if (importJsonButton) importJsonButton.addEventListener("click", () => {
  document.getElementById("import-json-input").click();
});
const importJsonInput = document.getElementById("import-json-input");
if (importJsonInput) importJsonInput.addEventListener("change", (event) => {
  importJson(event.target.files[0]);
  event.target.value = "";
});
const cancelEditButton = document.getElementById("cancel-edit");
if (cancelEditButton) cancelEditButton.addEventListener("click", () => {
  resetForm();
  showMessage("Editing was cancelled.");
});
const exportButton = document.getElementById("export-button");
if (exportButton) exportButton.addEventListener("click", () => openExportDialog("pdf"));
const csvExportButton = document.getElementById("csv-export-button");
if (csvExportButton) csvExportButton.addEventListener("click", () => openExportDialog("csv"));
const logoutButton = document.getElementById("logout-button");
if (logoutButton) logoutButton.addEventListener("click", () => {
  localStorage.removeItem("daily-audit-session-v1");
  window.location.replace("login.html");
});
const dashboardFilterDate = document.getElementById("dashboard-filter-date");
if (dashboardFilterDate) dashboardFilterDate.addEventListener("input", renderDashboard);
const dashboardClearDate = document.getElementById("dashboard-clear-date");
if (dashboardClearDate) dashboardClearDate.addEventListener("click", () => {
  dashboardFilterDate.value = "";
  renderDashboard();
});

const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");
function setSidebarOpen(open) {
  document.body.classList.toggle("sidebar-open", open);
  if (sidebarToggle) sidebarToggle.setAttribute("aria-expanded", String(open));
}
if (sidebarToggle) sidebarToggle.addEventListener("click", () => {
  setSidebarOpen(!document.body.classList.contains("sidebar-open"));
});
if (sidebarBackdrop) sidebarBackdrop.addEventListener("click", () => setSidebarOpen(false));
document.querySelectorAll(".main-nav .nav-link").forEach((link) => {
  link.addEventListener("click", () => setSidebarOpen(false));
});

window.addEventListener("storage", () => {});
window.addEventListener("online", synchronizePending);

if (deliveryDate) deliveryDate.value = localDateString(new Date());
if (itemsBody) {
  createItemRow();
  updateFormTotal();
  if (document.getElementById("movement-type")) syncMovementFields();
}
requestPersistentStorage();
showPage(document.body.dataset.page || "dashboard");
loadDeliveriesFromDatabase();
