
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
    const { history, message, context, image, mimeType } = req.body;
    
    if (!process.env.API_KEY) {
      throw new Error("API_KEY is not defined in server environment variables.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Construct System Instruction based on Store Context
    const systemInstruction = `
      You are the elite AI Manager for a retail store named "${context.storeName}". 
      You act as a Finance Manager, Inventory Analyst, and Senior Staff Member.
      
      **Current Live Store Data:**
      - Total Revenue: ${context.totalRevenue}
      - Total Outstanding Dues: ${context.totalDues}
      - Low Stock Items: ${context.lowStockCount}
      - Top Selling Product: ${context.topProduct}
      - Total Transactions: ${context.transactionCount}

      **Your Capabilities:**
      1. **Analyze Strategy:** Suggest how to increase sales based on the data.
      2. **Process Invoices:** If the user uploads an image, analyze it. If it's a supplier invoice, extract the total, date, and list of items formatted as a clean table.
      3. **General Assistance:** Answer questions about business math, margins, and customer retention.
      
      **Tone:** Professional, encouraging, and data-driven. Use emojis sparingly but effectively.
      **Output:** Use Markdown formatting. Use tables for lists.
    `;

    // Build the content parts
    const parts = [];
    
    // If there is an image, add it first
    if (image && mimeType) {
        // Remove header if present
        const base64Data = image.replace(/^data:.+;base64,/, '');
        parts.push({ inlineData: { mimeType: mimeType, data: base64Data } });
        parts.push({ text: "Analyze this image contextually." });
    }

    // Add the user's text message
    if (message) {
        parts.push({ text: message });
    }

    // Convert history to Gemini format (simple turn-based)
    // We limit history to last 10 turns to save tokens and context window
    const chatHistory = history.slice(-10).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
    }));

    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: systemInstruction,
      },
      history: chatHistory
    });

    const result = await chat.sendMessage({ 
        content: { parts } 
    });

    res.status(200).json({ reply: result.text });

  } catch (error) {
    console.error("Chat API Error:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
