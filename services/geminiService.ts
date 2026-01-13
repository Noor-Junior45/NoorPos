import { Product, Sale } from "../types";

export const GeminiService = {
  async analyzeInventory(products: Product[], sales: Sale[]): Promise<string> {
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ products, sales }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      return data.insight || "No insights generated.";
    } catch (error) {
      console.error("Gemini API Error:", error);
      return "Unable to generate AI insights. Please ensure the server is running and the API key is configured.";
    }
  }
};