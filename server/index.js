import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Settings from './models/Settings.js';
import CollectionEntry from './models/CollectionEntry.js';
import Account from './models/Account.js';
import Customer from './models/Customer.js';

const app = express();
const PORT = Number(process.env.PORT || 5000);
const AUTH_TOKEN_TTL = process.env.AUTH_TOKEN_TTL || '7d';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

app.use(express.json({ limit: '1mb' }));

const DEFAULT_SETTINGS = {
  key: 'primary',
  customerName: '',
  phone: '',
  whatsappOptIn: false,
  loanAmount: 800000,
  autoDailyAmount: 320,
  loanDailyAmount: 700,
  monthlyAmount: 15000,
};

const numericSettingKeys = ['loanAmount', 'autoDailyAmount', 'loanDailyAmount', 'monthlyAmount'];
const isNonNegativeNumber = (value) => Number.isFinite(Number(value)) && Number(value) >= 0;

async function getOrCreateSettings(mobileNumber) {
  return Settings.findOneAndUpdate(
    { key: `primary:${mobileNumber}` },
    { $setOnInsert: { ...DEFAULT_SETTINGS, key: `primary:${mobileNumber}` } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
}

const normalizeMobileNumber = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (/^0?[6-9]\d{9}$/.test(digits)) return `+91${digits.replace(/^0/, '')}`;
  if (/^[1-9]\d{7,14}$/.test(digits)) return `+${digits}`;
  return '';
};

const settingsKey = (mobileNumber) => `primary:${mobileNumber}`;

function issueAuthToken(mobileNumber) {
  return jwt.sign({ sub: mobileNumber }, process.env.JWT_SECRET, {
    expiresIn: AUTH_TOKEN_TTL,
    issuer: 'thandal-ledger',
    audience: 'thandal-ledger-app',
  });
}

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const mobileNumber = normalizeMobileNumber(req.body?.mobileNumber);
    if (!mobileNumber) return res.status(400).json({ message: 'Enter a valid mobile number, including country code for non-Indian numbers.' });
    if (await Account.exists({ mobileNumber })) return res.status(409).json({ message: 'This mobile number is already registered. Please log in.' });

    const isFirstAccount = (await Account.countDocuments()) === 0;
    const account = await Account.create({ mobileNumber });
    if (isFirstAccount) {
      await Settings.updateOne({ key: 'primary' }, { $set: { key: settingsKey(mobileNumber) } });
      await CollectionEntry.updateMany(
        { $or: [{ accountMobile: { $exists: false } }, { accountMobile: '' }] },
        { $set: { accountMobile: mobileNumber } },
      );
    }
    res.status(201).json({ mobileNumber: account.mobileNumber, token: issueAuthToken(account.mobileNumber) });
  } catch (error) { next(error); }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const mobileNumber = normalizeMobileNumber(req.body?.mobileNumber);
    if (!mobileNumber) return res.status(400).json({ message: 'Enter a valid mobile number, including country code for non-Indian numbers.' });
    const account = await Account.findOne({ mobileNumber }).select('mobileNumber').lean();
    if (!account) return res.status(404).json({ message: 'No account found for this mobile number. Register first.' });
    res.json({ mobileNumber: account.mobileNumber, token: issueAuthToken(account.mobileNumber) });
  } catch (error) { next(error); }
});

app.use('/api', async (req, res, next) => {
  if (req.path === '/health') return next();
  try {
    const authorization = req.get('authorization') || '';
    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Please log in to continue.' });
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'thandal-ledger',
      audience: 'thandal-ledger-app',
    });
    const mobileNumber = normalizeMobileNumber(payload.sub);
    if (!mobileNumber || !(await Account.exists({ mobileNumber }))) {
      return res.status(401).json({ message: 'Session is no longer valid. Please log in again.' });
    }
    req.accountMobile = mobileNumber;
    req.authExpiresAt = payload.exp * 1000;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: 'Session expired or invalid. Please log in again.' });
    }
    next(error);
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.get('/api/auth/session', (req, res) => {
  res.json({ mobileNumber: req.accountMobile, expiresAt: req.authExpiresAt });
});

app.get('/api/settings', async (_req, res, next) => {
  try {
    const settings = await getOrCreateSettings(_req.accountMobile);
    res.json(settings);
  } catch (error) { next(error); }
});

const saveSettings = async (req, res, next) => {
  try {
    const allowed = ['customerName', 'phone', 'whatsappOptIn', ...numericSettingKeys];
    const changes = {};
    for (const key of allowed) {
      if (!(key in req.body)) continue;
      if (numericSettingKeys.includes(key)) {
        if (!isNonNegativeNumber(req.body[key])) return res.status(400).json({ message: `${key} must be a non-negative number.` });
        changes[key] = Number(req.body[key]);
      } else if (key === 'whatsappOptIn') {
        changes[key] = req.body[key] === true;
      } else {
        changes[key] = String(req.body[key] ?? '').trim();
      }
    }
    const settings = await Settings.findOneAndUpdate(
      { key: settingsKey(req.accountMobile) },
      { $set: changes, $setOnInsert: { ...DEFAULT_SETTINGS, key: settingsKey(req.accountMobile) } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();
    res.json(settings);
  } catch (error) { next(error); }
};

app.post('/api/settings', saveSettings);
app.put('/api/settings', saveSettings);

app.post('/api/whatsapp/collection-message', async (req, res, next) => {
  try {
    const { entryId } = req.body ?? {};
    if (!mongoose.isValidObjectId(entryId)) return res.status(400).json({ message: 'Invalid collection entry id.' });

    const entry = await CollectionEntry.findOne({ _id: entryId, accountMobile: req.accountMobile }).lean();
    if (!entry) return res.status(404).json({ message: 'Collection entry not found.' });

    const settings = await getOrCreateSettings(req.accountMobile);
    if (!settings.whatsappOptIn) return res.status(403).json({ message: 'Customer WhatsApp consent has not been recorded in settings.' });

    const recipient = normalizeMobileNumber(settings.phone);
    if (!recipient) return res.status(400).json({ message: 'Add a valid customer WhatsApp number in settings.' });

    const { WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE_NAME, WHATSAPP_TEMPLATE_LANGUAGE, WHATSAPP_GRAPH_API_VERSION } = process.env;
    if (![WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE_NAME, WHATSAPP_TEMPLATE_LANGUAGE, WHATSAPP_GRAPH_API_VERSION].every(Boolean)) {
      return res.status(503).json({ message: 'WhatsApp sending is not configured on the server.' });
    }

    const expected = entry.type === 'monthly'
      ? Number(entry.monthlyExpected || 0)
      : Number(entry.autoExpected || 0) + Number(entry.loanExpected || 0);
    const received = entry.type === 'monthly'
      ? Number(entry.monthlyReceived || 0)
      : Number(entry.autoReceived || 0) + Number(entry.loanReceived || 0);
    const pending = Math.max(0, expected - received);
    const formatAmount = (value) => new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR', maximumFractionDigits: 0,
    }).format(value);
    const dateText = new Date(`${entry.date}T00:00:00`).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
    const parameters = [
      settings.customerName.trim() || 'Customer',
      entry.type === 'monthly' ? 'monthly' : 'daily',
      dateText,
      formatAmount(expected),
      formatAmount(received),
      formatAmount(pending),
    ].map((text) => ({ type: 'text', text }));

    let response;
    try {
      response = await fetch(`https://graph.facebook.com/${encodeURIComponent(WHATSAPP_GRAPH_API_VERSION)}/${encodeURIComponent(WHATSAPP_PHONE_NUMBER_ID)}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipient.replace(/\D/g, ''),
          type: 'template',
          template: {
            name: WHATSAPP_TEMPLATE_NAME,
            language: { code: WHATSAPP_TEMPLATE_LANGUAGE },
            components: [{ type: 'body', parameters }],
          },
        }),
      });
    } catch {
      return res.status(502).json({ message: 'Could not reach WhatsApp. The collection entry was saved.' });
    }

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(502).json({ message: result.error?.message || 'WhatsApp rejected the message. The collection entry was saved.' });
    }
    res.json({ sent: true, messageId: result.messages?.[0]?.id });
  } catch (error) { next(error); }
});

app.get('/api/customers', async (req, res, next) => {
  try {
    const customers = await Customer.find({ accountMobile: req.accountMobile })
      .sort({ name: 1, createdAt: -1 })
      .lean();
    res.json(customers);
  } catch (error) { next(error); }
});

app.post('/api/customers', async (req, res, next) => {
  try {
    const name = String(req.body?.name ?? '').trim();
    const mobileNumber = normalizeMobileNumber(req.body?.mobileNumber);
    if (!name || name.length > 100) return res.status(400).json({ message: 'Enter a customer name up to 100 characters.' });
    if (!mobileNumber) return res.status(400).json({ message: 'Enter a valid mobile number.' });

    const exists = await Customer.exists({ accountMobile: req.accountMobile, mobileNumber });
    if (exists) return res.status(409).json({ message: 'This mobile number is already in your customer list.' });

    const customer = await Customer.create({ accountMobile: req.accountMobile, name, mobileNumber });
    res.status(201).json(customer);
  } catch (error) { next(error); }
});

app.get('/api/entries', async (_req, res, next) => {
  try {
    const entries = await CollectionEntry.find({ accountMobile: _req.accountMobile }).sort({ date: -1, updatedAt: -1 }).lean();
    res.json(entries);
  } catch (error) { next(error); }
});

app.post('/api/entries', async (req, res, next) => {
  try {
    const { date, type } = req.body;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ message: 'Please provide a valid collection date.' });
    }
    if (!['daily', 'monthly'].includes(type)) {
      return res.status(400).json({ message: 'Entry type must be daily or monthly.' });
    }

    const fields = type === 'daily'
      ? ['autoExpected', 'autoReceived', 'loanExpected', 'loanReceived']
      : ['monthlyExpected', 'monthlyReceived'];
    const values = {};
    for (const field of fields) {
      const value = req.body[field] ?? 0;
      if (!isNonNegativeNumber(value)) return res.status(400).json({ message: `${field} must be a non-negative number.` });
      values[field] = Number(value);
    }
    if (type === 'daily') {
      if (values.autoReceived > values.autoExpected) return res.status(400).json({ message: 'Auto/rent received amount cannot exceed its expected amount.' });
      if (values.loanReceived > values.loanExpected) return res.status(400).json({ message: 'Loan repayment received amount cannot exceed its expected amount.' });
      values.monthlyExpected = 0;
      values.monthlyReceived = 0;
    } else {
      if (values.monthlyReceived > values.monthlyExpected) return res.status(400).json({ message: 'Monthly received amount cannot exceed its expected amount.' });
      values.autoExpected = 0;
      values.autoReceived = 0;
      values.loanExpected = 0;
      values.loanReceived = 0;
    }

    const update = {
      date: String(date),
      type,
      ...values,
      note: String(req.body.note ?? '').trim().slice(0, 1000),
    };
    const saved = await CollectionEntry.findOneAndUpdate(
      { accountMobile: req.accountMobile, date: String(date), type },
      { $set: { ...update, accountMobile: req.accountMobile } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();
    res.status(200).json(saved);
  } catch (error) { next(error); }
});

app.delete('/api/entries/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid entry id.' });
    const deleted = await CollectionEntry.findOneAndDelete({ _id: req.params.id, accountMobile: req.accountMobile }).lean();
    if (!deleted) return res.status(404).json({ message: 'Collection entry not found.' });
    res.json({ ok: true, deletedId: req.params.id });
  } catch (error) { next(error); }
});

// Serve the compiled frontend when `npm run build` has been run.
app.use(express.static(path.join(projectRoot, 'dist')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(projectRoot, 'dist', 'index.html'), (error) => {
    if (error) next();
  });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error?.code === 11000) return res.status(409).json({ message: 'An entry for this date and type already exists. Refresh and try again.' });
  if (error?.name === 'ValidationError' || error?.name === 'CastError') return res.status(400).json({ message: error.message });
  res.status(500).json({ message: 'Server error. Check the Node.js console and MongoDB connection.' });
});

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('JWT_SECRET is missing or too short. Set a random secret of at least 32 characters in .env.');
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is missing. Copy .env.example to .env and configure MongoDB.');
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    await Account.init();
    await Customer.init();
    await CollectionEntry.syncIndexes();
    app.listen(PORT, () => console.log(`Thandal Ledger API is running at http://localhost:${PORT}`));
  } catch (error) {
    console.error('Could not connect to MongoDB. Check MONGODB_URI and make sure the database is reachable.');
    console.error(error.message);
    process.exit(1);
  }
}

start();
