# Thandal Collection Tracker (React + Node.js + MongoDB)

A mobile-account collection tracker with a React/Vite frontend, Express API, and MongoDB database.

## Mobile accounts

Users can register and log in with a mobile number only. Indian 10-digit numbers are normalized to `+91`; other numbers must include a country code. Each account has its own settings and collection ledger. The first account adopts existing unassigned records.

Mobile-only sign-in does not verify phone ownership: anyone who knows a registered number can access that account. Do not use it for sensitive or multi-user deployments without adding OTP verification or another authentication factor.

## Business rule built into the app

The daily collection has two separate parts:

- **Auto / rent collection:** default ₹320 per day. This is recorded for tracking and **never reduces the loan principal**.
- **Daily loan repayment:** default ₹700 per day. Only the amount actually received in this field reduces the outstanding ₹8,00,000 loan principal.
- **Monthly payment:** default ₹15,000. It is a separate monthly ledger entry and **does not reduce the loan principal**.

For example, when ₹320 auto/rent and ₹700 loan repayment are due, but the customer pays only ₹320, the entry records ₹320 received and ₹700 pending. The outstanding loan remains unchanged because no loan repayment was received. If ₹500 is received as the loan repayment, only ₹500 is deducted from the loan balance.

Daily and monthly entries are saved in MongoDB. Saving another entry with the same date and type updates the existing entry for that date to avoid double-counting. Deleting an entry causes the displayed loan balance to be recalculated from the remaining loan-repayment records.

## Requirements

- Node.js 18 or newer
- MongoDB Community running locally, or a MongoDB Atlas connection string

## 1. Configure MongoDB

From this folder, copy `.env.example` to `.env` and edit `MONGODB_URI` as needed.

For a local MongoDB server, the default is:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/thandal_ledger
JWT_SECRET=replace-with-a-random-secret-of-at-least-32-characters
AUTH_TOKEN_TTL=7d
```

Set `JWT_SECRET` to a private random value of at least 32 characters and keep it stable across server restarts. `AUTH_TOKEN_TTL` controls how long a login remains valid (for example, `7d` or `12h`). The app keeps valid sessions across reloads and returns to login when a token expires.

For MongoDB Atlas, use your Atlas connection string instead. Keep `.env` private; do not commit database credentials to source control.

## 2. Install dependencies

```bash
npm install
```

## 3. Start the API server

In terminal 1:

```bash
npm run server:dev
```

The API will start at `http://localhost:5000`. The server checks the MongoDB connection before starting.

## 4. Start the React frontend

In terminal 2, from the same project folder:

```bash
npm run dev
```

Open the Vite URL printed in the terminal, usually `http://localhost:5173`. Requests to `/api` are proxied to the Node.js API.

## Production build

```bash
npm run build
npm start
```

The Express server will serve the generated frontend from `dist` and the API from `/api`.

## API endpoints

- `GET /api/auth/session` — validate the signed-in account token and return its expiry
 `GET /api/customers` — list customers for the signed-in account
 `POST /api/customers` — add a customer with a name and mobile number

## Customer messages

After saving an entry, the message preview includes the saved amounts, pending amount, and current outstanding loan balance. Select **Open WhatsApp message** to open WhatsApp with the message filled in, review it, and press Send manually. This application does not send messages automatically.

## Data and backup

Collection records and settings are stored in MongoDB, not `localStorage`. The app also supports CSV and JSON downloads for backups. Store exported backup files securely because they contain customer and collection information.

### If you used the earlier browser-only version

The new database-backed version does not automatically import entries from browser `localStorage`. Before replacing that version, export its JSON/CSV backup and keep it safe. This project currently provides exports for backup; it does not include an automatic legacy-import endpoint.
