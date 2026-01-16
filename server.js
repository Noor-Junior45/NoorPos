import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import analyzeHandler from './api/analyze.js';
import parseInvoiceHandler from './api/parse-invoice.js';
import storageHandler from './api/storage.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit for image uploads
// NEW: Middleware to parse form data (application/x-www-form-urlencoded) for the HTML Login Form
app.use(express.urlencoded({ extended: true }));

// API Routes
app.post('/api/analyze', analyzeHandler);
app.post('/api/parse-invoice', parseInvoiceHandler);

// Storage Routes (GET to read, POST to save)
app.get('/api/storage', storageHandler);
app.post('/api/storage', storageHandler);

// NEW: Crawler Login Route
app.post('/api/crawler-login', (req, res) => {
  const { username, password } = req.body;
  
  // Hardcoded credentials specifically for AdSense Crawler
  // You enter these exact values into the AdSense Crawler Access settings
  if (username === 'adsense_bot' && password === 'noorpos_access_2025') {
    // Redirect back to the main app with a query parameter confirming access
    res.redirect('/?access_mode=crawler_granted');
  } else {
    res.status(401).send('<h1>401 Unauthorized</h1><p>Invalid credentials.</p><a href="/bot-login.html">Try Again</a>');
  }
});

// Serve Static Files (Production)
app.use(express.static(join(__dirname, 'dist')));

// Fallback for SPA routing
app.get('*', (req, res) => {
  // Check if it's an API call that wasn't caught
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});