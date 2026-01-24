
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
// Handlers
import analyzeHandler from './api/analyze.js';
import parseInvoiceHandler from './api/parse-invoice.js';
import storageHandler from './api/storage.js';
import sendAlertHandler from './api/send-alert.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Check Email Config on Startup
if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
  console.warn("⚠️  WARNING: Email credentials missing in .env file. Alert emails will fail.");
} else {
  console.log("✅ Email configuration detected.");
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'online', 
    emailConfigured: !!(process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD) 
  });
});

app.post('/api/analyze', analyzeHandler);
app.post('/api/parse-invoice', parseInvoiceHandler);
app.post('/api/send-alert', sendAlertHandler); // Now using the separated handler

// Storage Routes
app.get('/api/storage', storageHandler);
app.post('/api/storage', storageHandler);

// NEW: Crawler Login Route
app.post('/api/crawler-login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'adsense_bot' && password === 'noorpos_access_2025') {
    res.redirect('/?access_mode=crawler_granted');
  } else {
    res.status(401).send('<h1>401 Unauthorized</h1><p>Invalid credentials.</p><a href="/bot-login.html">Try Again</a>');
  }
});

// Serve Static Files (Production)
app.use(express.static(join(__dirname, 'dist')));

// Special handling for public invoice links
app.get('/invoice/:id.html', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// Fallback for SPA routing
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
