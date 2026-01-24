
import nodemailer from 'nodemailer';

// Initialize Transporter outside the handler to reuse connection in Serverless environment
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD
  }
});

export default async function handler(req, res) {
  // Handle CORS for Vercel Serverless (if called directly)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { to, subject, items, storeName } = req.body;

  // Validation
  if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
    console.error("Missing Email Credentials in Environment Variables");
    return res.status(500).json({ error: "Server missing SMTP_EMAIL or SMTP_PASSWORD." });
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
    console.error("Nodemailer Error:", error);
    res.status(500).json({ error: error.message || "Failed to send email" });
  }
}
