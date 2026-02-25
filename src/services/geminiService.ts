import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ExtractedParcelData {
  lrNumber?: string;
  partyName?: string;
  weight?: number;
  totalAmount?: number;
  date?: string;
}

export const extractParcelDataFromImage = async (file: File): Promise<ExtractedParcelData> => {
  try {
    // Convert file to base64
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const model = "gemini-flash-latest";
    const prompt = `
      Analyze this image of a transport receipt or LR (Lorry Receipt).
      Extract the following information in JSON format:
      - lrNumber: The LR Number or Receipt Number.
      - partyName: The name of the party or consignee being billed.
      - weight: The total weight in kg (number only).
      - totalAmount: The total amount or grand total (number only).
      - date: The date of the receipt in YYYY-MM-DD format.

      If a field is not found, return null for that field.
      Return ONLY the JSON object, no markdown formatting.
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: file.type,
              data: base64Data
            }
          },
          {
            text: prompt
          }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from AI");
    }

    const data = JSON.parse(text);
    return data as ExtractedParcelData;

  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw new Error("Failed to extract data from image.");
  }
};
