
import { Product, Sale } from "../types";
import { getApiUrl } from "./apiConfig";

export const GeminiService = {
  async analyzeInventory(products: Product[], sales: Sale[]): Promise<string> {
    try {
      const response = await fetch(getApiUrl('/api/analyze'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products, sales }),
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();
      return data.insight || "No insights generated.";
    } catch (error) {
      console.error("Gemini API Error:", error);
      return "Unable to generate AI insights. Check server connection.";
    }
  },

  async parseInvoice(file: File): Promise<Partial<Product>[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const base64String = reader.result as string;
          const response = await fetch(getApiUrl('/api/parse-invoice'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              image: base64String,
              mimeType: file.type
            }),
          });
          if (!response.ok) throw new Error("Failed to parse invoice");
          const data = await response.json();
          resolve(data.products);
        } catch (error) { reject(error); }
      };
      reader.onerror = (error) => reject(error);
    });
  }
};
