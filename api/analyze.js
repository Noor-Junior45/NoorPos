
import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { products, sales } = req.body;
    
    if (!process.env.API_KEY) {
      throw new Error("API_KEY is not defined in server environment variables.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Calculate stats for the AI prompt
    const lowStockItems = products.filter(p => p.stock > 0 && p.stock <= (p.lowStockThreshold || 10));
    const outOfStockCount = products.filter(p => p.stock === 0).length;
    const totalStockValue = products.reduce((acc, p) => acc + (p.stock * p.sellPrice), 0);

    // Calculate expiring items (within 7 days)
    const today = new Date();
    const weekFromNow = new Date();
    weekFromNow.setDate(today.getDate() + 7);

    const expiringItems = products.filter(p => {
      if (!p.expiryDate) return false;
      const exp = new Date(p.expiryDate);
      return exp >= today && exp <= weekFromNow;
    });

    const prompt = `
      Act as a high-level Retail Business Consultant & AI Analyst for "Noor POS".
      Analyze the following store data and provide 3 concise, highly strategic, and actionable insights.

      **Data Snapshot:**
      - Total Inventory Value: ₹${totalStockValue.toLocaleString()}
      - Out of Stock Items: ${outOfStockCount}
      - Critically Low Stock Items (${lowStockItems.length}): ${lowStockItems.slice(0, 5).map(p => `${p.name} (${p.stock} left)`).join(', ') || 'None'}
      - Items Expiring within 7 Days (${expiringItems.length}): ${expiringItems.map(p => `${p.name} (Exp: ${p.expiryDate})`).join(', ') || 'None'}
      - Recent Total Sales Transactions: ${sales.length}

      **Your Task:**
      Provide 3 distinct insights in a professional yet encouraging tone.
      1. One insight MUST focus on Stock/Inventory management (Low stock or dead stock).
      2. One insight MUST focus on Sales/Revenue trends.
      3. One insight MUST focus on Expiry management or Capital efficiency.

      Format the output with bold headings and relevant emojis. Keep it under 150 words total.
      Example Format:
      "**📉 Sales Strategy:** Your revenue is peaking on [Day]. Consider [Action].
      **⚠️ Inventory Risk:** You are missing sales due to [Product] being out of stock.
      **⏳ Expiry Alert:** [Product] expires soon. Launch a 20% discount 'Flash Sale' to recover costs."
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    res.status(200).json({ insight: response.text });
  } catch (error) {
    console.error("Server API Error:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
