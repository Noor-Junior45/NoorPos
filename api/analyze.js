import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  // Handle CORS for local development if needed, though Vercel rewrites usually handle this
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
    
    // Calculate stats for the prompt
    const lowStockItems = products.filter(p => p.stock < p.lowStockThreshold);
    const totalStockValue = products.reduce((acc, p) => acc + (p.stock * p.sellPrice), 0);
    
    const prompt = `
      Act as an expert Warehouse Manager AI. Analyze the following store data and provide 3 concise, actionable strategic insights.
      
      **Data Snapshot:**
      - Total Unique Products: ${products.length}
      - Total Inventory Value: ${totalStockValue.toFixed(2)}
      - Low Stock Items (${lowStockItems.length}): ${lowStockItems.map(p => `${p.name} (only ${p.stock} left)`).join(', ') || 'None'}
      - Recent Sales Count: ${sales.length}

      **Your Task:**
      Generate 3 distinct insights. Each insight should have a clear heading with an emoji.
      Focus on identifying potential risks (like stockouts), opportunities (like fast-moving items), and clear recommendations.
      
      Example Format:
      "**📈 Sales Trend:** Your sales volume is steady. Consider a promotion on [Product] to boost numbers.
      **📦 Stock Alert:** You are critically low on [Product]. Reorder immediately to avoid missing sales.
      **💰 High-Value Stock:** A large portion of your capital is tied up in [Product]. Ensure it has good visibility."
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