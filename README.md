# Daily Audit

A Daily Audit application for recording incoming and outgoing items, stock balances, payments, audit history, search, filters, and JSON/CSV exports.

## Run the application

1. Start the application with `npm start` or `start-app.bat`.
2. Open `http://localhost:8091/login.html`.
3. Sign in with a Gmail address.
4. Use the Dashboard, Audit Detail, and History pages to manage records.

The default password is `123456`.

## Features

- Dashboard totals and stock balances
- Add, view, edit, and delete audit records
- Incoming and outgoing item records
- Payment and outstanding balance tracking
- Date and text search
- Audit history
- CSV export
- JSON import and export
- Offline PWA support
- IndexedDB local storage
- Automatic synchronization with MySQL

## Offline storage

Audit records are stored in the `daily-audit-local-v1` IndexedDB database.

- `deliveries` stores audit records and their `pending` or `synced` synchronization status.
- `deletions` stores record IDs awaiting server deletion.
- `credentials` stores an email, random salt, and SHA-256 password verifier.

Passwords are not stored in plaintext in localStorage or IndexedDB.

## PWA support

- `manifest.json` provides installable PWA metadata.
- `sw.js` caches application HTML, CSS, JavaScript, images, icons, and other static assets.
- API requests are never served from the Service Worker cache.
- The application shows Online, Offline, and Connection restored statuses.
- Pending records synchronize automatically when server connectivity returns.

## Synchronization

The existing MySQL backend provides these APIs:

- `GET /api/deliveries`
- `POST /api/deliveries/sync`
- `POST /api/account/login`
- `POST /api/account/change`
- `POST /api/account/reset`

Synchronization uses stable record IDs for idempotent upserts and explicit deleted IDs for safe removals.

## Project files

- `index.html` - Application entry redirect
- `Dashboard.html` / `Dashboard.css` - Dashboard
- `Aduit.html` / `Aduit.css` - Audit Detail page
- `History.html` / `History.css` - Audit history
- `app.js` - Audit CRUD, calculations, filtering, and synchronization
- `offline-db.js` - IndexedDB storage
- `auth.js` - Authentication and connection status
- `login.html` / `login.css` - Login page
- `change.html` / `change.css` - Password change page
- `server.js` - Node.js and MySQL server
- `schema.sql` - MySQL database schema
- `manifest.json` - PWA manifest
- `sw.js` - Service Worker
- `start-app.bat` - Windows startup script
