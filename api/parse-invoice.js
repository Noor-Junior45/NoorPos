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
      You are an automated inventory data entry assistant. 
      Analyze this invoice or inventory list image and extract all product line items.
      
      For each item, extract or infer the following:
      1. name: The product name.
      2. stock: The quantity listed. If only 1 is implied, use 1.
      3. unit: The unit of measure (e.g., pcs, kg, box). Infer 'pcs' if not specified.
      4. buyPrice: The unit price listed on the invoice. If missing, estimate based on total or set to 0.
      5. sellPrice: Estimate a retail selling price (buyPrice * 1.3). If buyPrice is 0, set to 0.
      6. category: Infer a short category name (e.g., 'Dairy', 'Fruits', 'Electronics') based on the product name.
      
      Return ONLY a raw JSON array of objects. Do not include markdown formatting like \`\`\`json.
      
      Example output format:
      [
        { "name": "Apple", "stock": 10, "unit": "kg", "buyPrice": 2.5, "sellPrice": 3.25, "category": "Fruits" },
        { "name": "Milk", "stock": 5, "unit": "l", "buyPrice": 1.0, "sellPrice": 1.3, "category": "Dairy" }
      ]
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview', // Using a model capable of vision tasks
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64Data } },
          { text: prompt }
        ]
      }
    });

    let rawText = response.text;
    
    // Clean up markdown if present
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const products = JSON.parse(rawText);

    res.status(200).json({ products });
  } catch (error) {
    console.error("Invoice Parse API Error:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}