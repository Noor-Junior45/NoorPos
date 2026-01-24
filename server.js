
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import analyzeHandler from './api/analyze.js';
import parseInvoiceHandler from './api/parse-invoice.js';
import storageHandler from './api/storage.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Email Transporter Configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL, // Your sender email (e.g. alerts@noorpos.in)
    pass: process.env.SMTP_PASSWORD // Google App Password
  }
});

// API Routes
app.post('/api/analyze', analyzeHandler);
app.post('/api/parse-invoice', parseInvoiceHandler);

// Email Alert Route
app.post('/api/send-alert', async (req, res) => {
  const { to, subject, items, storeName } = req.body;

  if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
    return res.status(500).json({ error: "Server email configuration missing." });
  }

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2 style="color: #d97706;">⚠️ Expiry Alert: ${storeName}</h2>
      <p>Hello,</p>
      <p>The following items in your inventory are expiring soon or have already expired. Please take action immediately.</p>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        <tr style="background-color: #f3f4f6;">
          <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Product Name</th>
          <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Stock</th>
          <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Expiry Date</th>
        </tr>
        ${items.map(item => `
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">${item.name}</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${item.stock}</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: right; color: #dc2626; font-weight: bold;">${item.date}</td>
          </tr>
        `).join('')}
      </table>

      <p style="margin-top: 20px; font-size: 12px; color: #666;">
        This is an automated message from <strong>Noor POS</strong>. You can disable these alerts in your Store Profile.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Noor POS Alerts" <${process.env.SMTP_EMAIL}>`,
      to: to,
      subject: subject,
      html: htmlContent
    });
    res.status(200).json({ success: true, message: "Email sent" });
  } catch (error) {
    console.error("Email Error:", error);
    res.status(500).json({ error: "Failed to send email" });
  }
});

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
