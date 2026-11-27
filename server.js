"use strict";

require("dotenv").config();
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mysql = require("mysql2/promise");

const root = __dirname;
const port = Number(process.env.PORT) || 8091;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

const dbConfig = {
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "daily_audit",
  charset: "utf8mb4"
};

let pool;

function passwordHash(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function json(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error("Invalid JSON")); }
    });
  });
}

async function initializeDatabase() {
  const bootstrap = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    multipleStatements: true
  });
  await bootstrap.query("CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", [dbConfig.database]);
  await bootstrap.end();
  pool = mysql.createPool({ ...dbConfig, waitForConnections: true, connectionLimit: 10, queueLimit: 0 });
  const schema = fs.readFileSync(path.join(root, "schema.sql"), "utf8");
  const connection = await pool.getConnection();
  for (const statement of schema.split(";").map((part) => part.trim()).filter(Boolean)) {
    await connection.query(statement);
  }
  await connection.release();
}

async function getDeliveries() {
  const [rows] = await pool.query(`
    SELECT d.*, i.id AS item_id, i.item_name, i.quantity, i.unit_price
    FROM deliveries d
    LEFT JOIN delivery_items i ON i.delivery_id = d.id
    WHERE d.deleted_at IS NULL
    ORDER BY d.delivery_date DESC, d.created_at DESC, i.id ASC
  `);
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.id)) {
      map.set(row.id, {
        id: row.id,
        date: String(row.delivery_date).slice(0, 10),
        movementType: row.movement_type,
        truck: row.truck,
        supplier: row.supplier,
        preparedBy: row.prepared_by,
        paidAmount: Number(row.paid_amount),
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
        items: []
      });
    }
    if (row.item_id) {
      map.get(row.id).items.push({
        name: row.item_name,
        quantity: Number(row.quantity),
        unitPrice: Number(row.unit_price)
      });
    }
  }
  return [...map.values()];
}

async function syncDeliveries(deliveries, deletedIds = []) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const ids = deletedIds.map((id) => String(id)).filter(Boolean);
    if (ids.length) {
      await connection.query(
        `UPDATE deliveries SET deleted_at=NOW(), deletion_reason='Removed by user' WHERE deleted_at IS NULL AND id IN (?)`,
        [ids]
      );
    }

    for (const delivery of deliveries) {
      if (ids.includes(String(delivery.id))) continue;
      await connection.query(
        "UPDATE deliveries SET deleted_at=NULL, deletion_reason=NULL WHERE id=?",
        [String(delivery.id)]
      );
      await connection.query(`
        INSERT INTO deliveries
          (id, delivery_date, movement_type, truck, supplier, prepared_by, paid_amount, created_at, updated_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
        ON DUPLICATE KEY UPDATE
          delivery_date=VALUES(delivery_date),
          movement_type=VALUES(movement_type),
          truck=VALUES(truck),
          supplier=VALUES(supplier),
          prepared_by=VALUES(prepared_by),
          paid_amount=VALUES(paid_amount),
          updated_at=VALUES(updated_at),
          deleted_at=NULL,
          deletion_reason=NULL
      `, [
        String(delivery.id),
        delivery.date,
        delivery.movementType === "outgoing" ? "outgoing" : "incoming",
        String(delivery.truck || ""),
        String(delivery.supplier || ""),
        String(delivery.preparedBy || ""),
        Number(delivery.paidAmount || 0),
        delivery.createdAt ? new Date(delivery.createdAt) : new Date(),
        delivery.updatedAt ? new Date(delivery.updatedAt) : null
      ]);
      await connection.query("DELETE FROM delivery_items WHERE delivery_id=?", [String(delivery.id)]);
      for (const item of delivery.items || []) {
        await connection.query(
          "INSERT INTO delivery_items (delivery_id,item_name,quantity,unit_price) VALUES (?,?,?,?)",
          [String(delivery.id), String(item.name), Number(item.quantity), Number(item.unitPrice)]
        );
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function ensureDefaultAccount() {
  await pool.query(
    "INSERT IGNORE INTO accounts (email,password_hash) VALUES (?,?)",
    ["wuttmone774@gmail.com", passwordHash("123456")]
  );
}

async function handleApi(request, response, urlPath) {
  if (urlPath === "/api/deliveries" && request.method === "GET") {
    json(response, 200, { deliveries: await getDeliveries() });
    return true;
  }
  if (urlPath === "/api/deliveries/sync" && request.method === "POST") {
    const body = await readJson(request);
    if (!Array.isArray(body.deliveries)) {
      json(response, 400, { error: "deliveries must be a list" });
      return true;
    }
    await syncDeliveries(body.deliveries, Array.isArray(body.deletedIds) ? body.deletedIds : []);
    json(response, 200, { deliveries: await getDeliveries() });
    return true;
  }
  if (urlPath === "/api/account/login" && request.method === "POST") {
    const body = await readJson(request);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com$/i.test(email)) {
      json(response, 400, { error: "Gmail address is invalid" });
      return true;
    }
    if (!email || !password) {
      json(response, 400, { error: "Email and password are required" });
      return true;
    }
    const [rows] = await pool.query("SELECT email FROM accounts WHERE email=? AND password_hash=?", [email, passwordHash(password)]);
    if (!rows.length) {
      if (password === "123456") {
        try {
          await pool.query(
            "INSERT INTO accounts (email,password_hash) VALUES (?,?)",
            [email, passwordHash("123456")]
          );
          json(response, 200, { email, created: true });
          return true;
        } catch (error) {
          if (error.code !== "ER_DUP_ENTRY") throw error;
        }
      }
    }
    if (!rows.length) {
      json(response, 401, { error: "Gmail address or password is incorrect" });
      return true;
    }
    json(response, 200, { email });
    return true;
  }
  if (urlPath === "/api/account/change" && request.method === "POST") {
    const body = await readJson(request);
    const email = String(body.email || "").trim().toLowerCase();
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    if (newPassword.length !== 6) {
      json(response, 400, { error: "Password must contain exactly 6 characters" });
      return true;
    }
    const [rows] = await pool.query(
      "SELECT id FROM accounts WHERE email=? AND password_hash=?",
      [email, passwordHash(currentPassword)]
    );
    if (!rows.length) {
      json(response, 401, { error: "Current password is incorrect" });
      return true;
    }
    await pool.query("UPDATE accounts SET password_hash=? WHERE id=?", [passwordHash(newPassword), rows[0].id]);
    json(response, 200, { success: true });
    return true;
  }
  if (urlPath === "/api/account/reset" && request.method === "POST") {
    const body = await readJson(request);
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) {
      json(response, 400, { error: "Email is required" });
      return true;
    }
    if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com$/i.test(email)) {
      json(response, 400, { error: "Gmail address is invalid" });
      return true;
    }
    const [rows] = await pool.query("SELECT id FROM accounts WHERE email=?", [email]);
    if (!rows.length) {
      await pool.query(
        "INSERT INTO accounts (email,password_hash) VALUES (?,?)",
        [email, passwordHash("123456")]
      );
      json(response, 200, { success: true, password: "123456", created: true });
      return true;
    }
    await pool.query("UPDATE accounts SET password_hash=? WHERE id=?", [passwordHash("123456"), rows[0].id]);
    json(response, 200, { success: true, password: "123456" });
    return true;
  }
  return false;
}

async function main() {
  await initializeDatabase();
  await ensureDefaultAccount();

  http.createServer(async (request, response) => {
    try {
      const urlPath = decodeURIComponent(request.url.split("?")[0]);
      if (urlPath.startsWith("/api/")) {
        const handled = await handleApi(request, response, urlPath);
        if (!handled) json(response, 404, { error: "API route not found" });
        return;
      }
      const relativePath = urlPath === "/" ? "login.html" : urlPath.replace(/^\/+/, "");
      const filePath = path.resolve(root, relativePath);
      if (!filePath.startsWith(root + path.sep) && filePath !== root) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      fs.readFile(filePath, (error, data) => {
        if (error) {
          response.writeHead(404).end("Not found");
          return;
        }
        response.writeHead(200, {
          "Content-Type": types[path.extname(filePath).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-cache"
        });
        response.end(data);
      });
    } catch (error) {
      console.error(error);
      json(response, 500, { error: error.message || "Server error" });
    }
  }).listen(port, "0.0.0.0", () => {
    console.log(`Daily Audit MySQL server running at http://localhost:${port}`);
  });
}

main().catch((error) => {
  console.error("Could not start MySQL server:", error);
  process.exit(1);
});
