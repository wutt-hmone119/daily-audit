"use strict";

const STORAGE_KEY = "daily-audit-deliveries-v1";
const form = document.getElementById("delivery-form");
const itemsBody = document.getElementById("items-body");
const deliveryDate = document.getElementById("delivery-date");
const filterDate = document.getElementById("filter-date");
const filterText = document.getElementById("filter-text");
const paidAmountInput = document.getElementById("paid-amount");
const message = document.getElementById("app-message");
const currency = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
let deliveries = loadDeliveries();
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
    return { name: String(item.name), quantity, unitPrice };
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

function loadDeliveries() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) throw new Error("Stored delivery data is not a list.");
    return parsed.map(normalizeDelivery);
  } catch (error) {
    console.error("Could not load Daily Audit records.", error);
    window.alert("သိမ်းထားသောစာရင်းကို ဖတ်မရပါ။ Browser storage ကို စစ်ဆေးပါ။");
    return [];
  }
}

function saveDeliveries() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deliveries));
    return true;
  } catch (error) {
    console.error("Could not save Daily Audit records.", error);
    window.alert("စာရင်းသိမ်းမရပါ။ Browser storage နေရာလွတ်ကို စစ်ဆေးပါ။");
    return false;
  }
}

function createItemRow(item = {}) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td><input class="item-input item-name" type="text" maxlength="100" placeholder="ဥပမာ - ဆန်" aria-label="ပစ္စည်းအမည်" required></td>
    <td><input class="item-input numeric item-quantity" type="number" min="0.01" step="any" value="1" aria-label="အရေအတွက်" required></td>
    <td><input class="item-input numeric item-price" type="number" min="0" step="any" placeholder="0" aria-label="တစ်ခုတန်ဖိုး" required></td>
    <td><span class="line-total">0</span></td>
    <td><button class="icon-button remove-item" type="button" aria-label="ဤပစ္စည်းကို ဖယ်ရှားရန်">×</button></td>`;
  row.querySelector(".item-name").value = item.name || "";
  row.querySelector(".item-quantity").value = item.quantity || 1;
  row.querySelector(".item-price").value = item.unitPrice ?? "";
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
  let total = 0;
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
  message.textContent = text;
  window.clearTimeout(messageTimer);
  messageTimer = window.setTimeout(() => { message.textContent = ""; }, 3500);
}

function showPage(pageName) {
  const isDashboard = pageName !== "detail";
  document.getElementById("dashboard-page").hidden = !isDashboard;
  document.getElementById("detail-page").hidden = isDashboard;
  document.querySelectorAll("[data-page-link]").forEach((link) => {
    const active = link.dataset.pageLink === (isDashboard ? "dashboard" : "detail");
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (isDashboard) renderDashboard();
  else renderDetail();
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
  const recent = sortedDeliveries(deliveries).slice(0, 5);
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
  document.getElementById("detail-empty-title").textContent = hasFilter ? "လိုက်ဖက်သော စာရင်းမရှိပါ" : "စာရင်းမရှိသေးပါ";
  document.getElementById("detail-empty-description").textContent = hasFilter
    ? "ရှာဖွေမှုစာလုံးသို့မဟုတ် ရက်စွဲကို ပြောင်း၍ ထပ်မံကြည့်ရှုပါ။"
    : "အပေါ်က ဖောင်မှာ ပစ္စည်းစာရင်းအသစ် ထည့်နိုင်ပါတယ်။";
  renderList(document.getElementById("detail-list"), shown);
}

function renderList(list, records) {
  list.replaceChildren();
  records.forEach((delivery) => list.append(createDeliveryCard(delivery)));
}

function formatCreatedAt(delivery) {
  if (!delivery.createdAt) return "အချိန် မမှတ်တမ်းတင်ထားပါ";
  const date = new Date(delivery.createdAt);
  if (Number.isNaN(date.getTime())) return "အချိန် မမှတ်တမ်းတင်ထားပါ";
  return new Intl.DateTimeFormat("my-MM", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  }).format(date);
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
    ? `ပစ္စည်းအထွက် · ${delivery.truck || "အထွက်စာရင်း"}`
    : `ပစ္စည်းအဝင် · ကား - ${delivery.truck}`;
  const people = document.createElement("p");
  const partnerLabel = delivery.movementType === "outgoing" ? "လက်ခံသူ" : "ပို့သူ";
  people.textContent = `${partnerLabel} - ${delivery.supplier || "မမှတ်တမ်းတင်ထား"} · စာရင်းပြုစုသူ - ${delivery.preparedBy || "မမှတ်တမ်းတင်ထား"}`;
  const recordedAt = document.createElement("p");
  recordedAt.className = "recorded-at";
  recordedAt.textContent = `မှတ်တမ်းချိန် - ${formatCreatedAt(delivery)}`;
  description.append(title, people, recordedAt);
  info.append(tile, description);

  const amountBlock = document.createElement("div");
  amountBlock.className = "delivery-amount";
  const amountText = document.createElement("strong");
  amountText.textContent = `${formatMoney(total)} ကျပ်`;
  const badge = document.createElement("span");
  badge.className = `badge ${due > 0 ? "badge-unpaid" : "badge-paid"}`;
  badge.textContent = delivery.movementType === "outgoing"
    ? "ပစ္စည်းအထွက်"
    : due > 0 ? `ပေးရန်ကျန် ${formatMoney(due)} ကျပ်` : "ပေးပြီး";
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
    lineTotal.textContent = `${formatMoney(item.quantity * item.unitPrice)} ကျပ်`;
    row.append(name, quantity, lineTotal);
    itemList.append(row);
  });
  card.append(itemList);

  const actions = document.createElement("div");
  actions.className = "delivery-actions";
  if (due > 0) {
    const paidButton = document.createElement("button");
    paidButton.className = "small-button";
    paidButton.type = "button";
    paidButton.textContent = "ကျန်ငွေအားလုံး ပေးပြီးဟု မှတ်ရန်";
    paidButton.addEventListener("click", () => markPaid(delivery.id));
    actions.append(paidButton);
  }
  const editButton = document.createElement("button");
  editButton.className = "small-button";
  editButton.type = "button";
  editButton.textContent = "ပြင်ဆင်ရန်";
  editButton.addEventListener("click", () => editDelivery(delivery.id));
  const deleteButton = document.createElement("button");
  deleteButton.className = "small-button delete";
  deleteButton.type = "button";
  deleteButton.textContent = "ဖျက်ရန်";
  deleteButton.addEventListener("click", () => deleteDelivery(delivery.id));
  actions.append(editButton, deleteButton);
  card.append(actions);
  return card;
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
  document.getElementById("form-eyebrow").textContent = "အရင်စာရင်းကို ပြင်ဆင်နေသည်";
  document.getElementById("form-title").textContent = "စာရင်းအချက်အလက် ပြင်ဆင်ရန်";
  document.getElementById("save-button").textContent = "ပြင်ဆင်ချက်သိမ်းရန်";
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
  document.getElementById("form-eyebrow").textContent = "စာရင်းအသစ်";
  document.getElementById("form-title").textContent = "ပစ္စည်းရောက်ရှိမှု မှတ်တမ်းတင်ရန်";
  document.getElementById("save-button").textContent = "စာရင်းသိမ်းရန်";
  document.getElementById("cancel-edit").hidden = true;
  syncMovementFields();
}

function syncMovementFields() {
  const isIncoming = document.getElementById("movement-type").value === "incoming";
  const truckField = document.getElementById("truck-field");
  const paidField = document.getElementById("paid-field");
  const truckInput = document.getElementById("truck-name");
  const partnerLabel = document.getElementById("partner-label");
  truckField.hidden = !isIncoming;
  paidField.hidden = !isIncoming;
  truckInput.required = isIncoming;
  paidAmountInput.required = isIncoming;
  partnerLabel.textContent = isIncoming ? "ပစ္စည်းပို့သူအမည်" : "ပစ္စည်းလက်ခံသူအမည်";
  document.getElementById("supplier-name").placeholder = isIncoming ? "ပစ္စည်းပို့သူအမည်" : "ပစ္စည်းလက်ခံသူအမည်";
  if (!isIncoming) {
    truckInput.value = "";
    paidAmountInput.value = "0";
  }
  updateFormTotal();
}

function markPaid(id) {
  const delivery = deliveries.find((record) => record.id === id);
  if (!delivery) return;
  const previousPaidAmount = delivery.paidAmount;
  const previousUpdatedAt = delivery.updatedAt;
  delivery.paidAmount = recordTotal(delivery);
  delivery.updatedAt = new Date().toISOString();
  if (saveDeliveries()) {
    renderAll();
    showMessage("ပေးရန်ကျန်ငွေကို အပြည့်ပေးပြီးဟု မှတ်သားပြီးပါပြီ။");
  } else {
    delivery.paidAmount = previousPaidAmount;
    delivery.updatedAt = previousUpdatedAt;
  }
}

function deleteDelivery(id) {
  if (!window.confirm("ဤစာရင်းကို ဖျက်မှာ သေချာပါသလား။")) return;
  const previous = deliveries;
  deliveries = deliveries.filter((delivery) => delivery.id !== id);
  const stockViolation = getStockViolation(deliveries);
  if (stockViolation) {
    deliveries = previous;
    window.alert(`ဤစာရင်းကိုဖျက်ပါက ${stockViolation.date} ရက်နေ့တွင် ${stockViolation.item} လက်ကျန်မလုံလောက်ပါ။ အထွက်စာရင်းကို အရင်ပြင်ဆင်ပါ။`);
    return;
  }
  if (saveDeliveries()) {
    renderAll();
    showMessage("စာရင်းကို ဖျက်ပြီးပါပြီ။");
  } else {
    deliveries = previous;
  }
}

function renderAll() {
  renderDashboard();
  renderDetail();
}

function csvCell(value) {
  const text = String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv() {
  const filter = filterDate.value;
  const searchText = filterText.value.trim().toLocaleLowerCase();
  const records = sortedDeliveries(deliveries.filter((delivery) => {
    if (filter && delivery.date !== filter) return false;
    if (!searchText) return true;
    return delivery.supplier.toLocaleLowerCase().includes(searchText)
      || delivery.items.some((item) => item.name.toLocaleLowerCase().includes(searchText));
  }));
  if (records.length === 0) {
    showMessage(filter ? "ရွေးထားသောရက်အတွက် စာရင်းမရှိပါ။" : "Excel ထုတ်ရန် စာရင်းမရှိသေးပါ။");
    return;
  }
  const headers = [
    "ရက်စွဲ", "အဝင် / အထွက်", "ကားနံပါတ် / ကားအမည်", "ပို့သူ / လက်ခံသူ", "စာရင်းပြုစုသူ", "စာရင်းပြုစုသည့်အချိန်",
    "ငွေပေးချေမှု", "ပေးချေပြီးငွေ (ကျပ်)", "ပေးရန်ကျန် (ကျပ်)", "ပစ္စည်းအမည်", "အရေအတွက်",
    "တစ်ခုတန်ဖိုး (ကျပ်)", "ပစ္စည်းစုစုပေါင်း (ကျပ်)"
  ];
  const rows = [headers];
  records.forEach((delivery) => {
    const total = recordTotal(delivery);
    const paid = delivery.movementType === "incoming" ? Math.min(total, delivery.paidAmount) : 0;
    const due = delivery.movementType === "incoming" ? Math.max(0, total - paid) : 0;
    const status = delivery.movementType === "outgoing"
      ? "ပစ္စည်းအထွက်"
      : due === 0 ? "ပေးပြီး" : paid > 0 ? "တစ်စိတ်တစ်ပိုင်းပေးပြီး" : "မပေးရသေး";
    delivery.items.forEach((item) => {
      rows.push([
        delivery.date, delivery.movementType === "outgoing" ? "အထွက်" : "အဝင်",
        delivery.truck, delivery.supplier, delivery.preparedBy, formatCreatedAt(delivery),
        status, paid, due, item.name, item.quantity, item.unitPrice, item.quantity * item.unitPrice
      ]);
    });
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
  showMessage("Excel တွင်ဖွင့်နိုင်သော CSV ဖိုင်ကို ထုတ်ပြီးပါပြီ။");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const items = getFormItems();
  if (items.length === 0 || items.some((item) => !item.name || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) {
    showMessage("ပစ္စည်းအမည်၊ အရေအတွက်နှင့် တန်ဖိုးတို့ကို မှန်ကန်စွာဖြည့်ပါ။");
    return;
  }
  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const movementType = document.getElementById("movement-type").value;
  const paidAmount = movementType === "incoming" ? Number(paidAmountInput.value) : 0;
  if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > total) {
    showMessage("ပေးချေပြီးငွေသည် သုညနှင့် စုစုပေါင်းတန်ဖိုးကြား ဖြစ်ရပါမယ်။");
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
    showMessage("လိုအပ်သော အမည်နှင့် စာရင်းအချက်အလက်များကို ဖြည့်ပါ။");
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
    showMessage(`${stockViolation.date} ရက်နေ့အတွက် ${stockViolation.item} လက်ကျန် ${formatMoney(stockViolation.available)} သာရှိပါသည်။ ထုတ်ယူမည့်အရေအတွက်ကို စစ်ဆေးပါ။`);
    return;
  }
  deliveries = updatedDeliveries;
  if (saveDeliveries()) {
    const wasEditing = Boolean(existing);
    resetForm();
    renderAll();
    showMessage(wasEditing ? "ပြင်ဆင်ချက်ကို သိမ်းဆည်းပြီးပါပြီ။" : "စာရင်းကို သိမ်းဆည်းပြီးပါပြီ။");
  } else {
    deliveries = previous;
  }
});

document.getElementById("add-item-button").addEventListener("click", () => {
  createItemRow();
  updateFormTotal();
  itemsBody.lastElementChild.querySelector(".item-name").focus();
});

itemsBody.addEventListener("input", updateFormTotal);
itemsBody.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-item");
  if (!button) return;
  if (itemsBody.children.length === 1) {
    showMessage("အနည်းဆုံး ပစ္စည်းတစ်ခု ရှိရပါမယ်။");
    return;
  }
  button.closest("tr").remove();
  updateFormTotal();
});

paidAmountInput.addEventListener("input", updateFormTotal);
document.getElementById("movement-type").addEventListener("change", syncMovementFields);
filterDate.addEventListener("input", renderDetail);
filterText.addEventListener("input", renderDetail);
document.getElementById("clear-filter").addEventListener("click", () => {
  filterDate.value = "";
  filterText.value = "";
  renderDetail();
});
document.getElementById("cancel-edit").addEventListener("click", () => {
  resetForm();
  showMessage("ပြင်ဆင်မှုကို ပယ်ဖျက်လိုက်ပါပြီ။");
});
document.getElementById("export-button").addEventListener("click", exportCsv);
document.querySelectorAll("[data-page-link]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const pageName = link.dataset.pageLink;
    window.history.replaceState(null, "", `#${pageName}`);
    showPage(pageName);
  });
});
document.querySelectorAll("[data-open-detail]").forEach((button) => {
  button.addEventListener("click", () => {
    window.history.replaceState(null, "", "#detail");
    showPage("detail");
    deliveryDate.focus();
  });
});
window.addEventListener("hashchange", () => showPage(window.location.hash === "#detail" ? "detail" : "dashboard"));

deliveryDate.value = localDateString(new Date());
createItemRow();
updateFormTotal();
showPage(window.location.hash === "#detail" ? "detail" : "dashboard");
