import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { image, mimeType } = req.body;
    
    if (!process.env.API_KEY) {
      throw new Error("API_KEY is not defined in server environment variables.");
    }

    if (!image || !mimeType) {
      throw new Error("Image data or mimeType missing.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Remove header from base64 string if present (e.g., "data:image/png;base64,")
    const base64Data = image.replace(/^data:.+;base64,/, '');

    const prompt = `
      Analyze this image (invoice, inventory list, or product photo) and extract product details.
      
      Rules for Extraction:
      - Name: Concise product name.
      - Stock: Integer quantity. Default to 1 if just a list item.
      - Unit: e.g., 'pcs', 'kg', 'box'. Default to 'pcs'.
      - Buy Price: Unit cost. Default 0.
      - Sell Price: Retail price. If missing, calculate as Buy Price * 1.3.
      - Category: Infer category (e.g., 'Dairy', 'Produce', 'Snacks').
      
      Return a raw JSON object matching the schema.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            products: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  stock: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  buyPrice: { type: Type.NUMBER },
                  sellPrice: { type: Type.NUMBER },
                  category: { type: Type.STRING }
                },
                required: ["name", "stock", "unit", "buyPrice", "sellPrice", "category"]
              }
            }
          }
        }
      }
    });

    const result = JSON.parse(response.text);
    
    // Ensure we return an array even if the model acts uniquely
    const products = result.products || [];

    res.status(200).json({ products });
  } catch (error) {
    console.error("Invoice Parse API Error:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}