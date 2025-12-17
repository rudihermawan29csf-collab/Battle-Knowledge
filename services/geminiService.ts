import { GoogleGenAI, Type } from "@google/genai";
import { Category, Question } from "../types";

// Pastikan kunci API tersedia sebelum inisialisasi untuk mencegah crash total aplikasi
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

/**
 * Utility for exponential backoff retries
 */
async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && error?.message?.includes('429')) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

/**
 * Generates a base64 image using the Gemini image model.
 */
export const generateQuestionImage = async (prompt: string): Promise<string | undefined> => {
  if (!process.env.API_KEY) {
    console.warn("API_KEY missing, skipping image generation");
    return undefined;
  }

  return retryWithBackoff(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `A high-quality 3D cinematic game illustration for a mobile battle royale game like Free Fire. 
            The scene should represent: ${prompt}. 
            Style: semi-realistic, vibrant colors, tactical atmosphere, dramatic lighting. 
            Aspect Ratio: 16:9.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9"
        }
      }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return undefined;
  }).catch(err => {
    console.warn("Image generation failed after retries:", err);
    return undefined;
  });
};

export const generateQuestions = async (category: Category, subTopic: string | null = null, count: number): Promise<Question[]> => {
  const model = "gemini-3-pro-preview";
  
  let promptTopic = category as string;
  if (category === Category.MATH && subTopic) {
    promptTopic = `Matematika Dasar operasi ${subTopic}`;
  }

  const prompt = `Buatkan ${count} soal pilihan ganda tentang "${promptTopic}" untuk anak sekolah.
  Format output harus JSON array. Setiap objek memiliki:
  - id (number)
  - question (string)
  - options (array of 4 strings)
  - correctAnswer (string, must match one of the options exactly)
  - imagePrompt (string, a descriptive prompt for an AI image generator to illustrate this specific question)
  
  Pastikan soal bervariasi dan valid.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.NUMBER },
              question: { type: Type.STRING },
              options: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              correctAnswer: { type: Type.STRING },
              imagePrompt: { type: Type.STRING }
            },
            required: ["id", "question", "options", "correctAnswer", "imagePrompt"]
          }
        }
      }
    });

    if (response.text) {
      const questions: Question[] = JSON.parse(response.text);
      
      const questionsWithImages: Question[] = [];
      for (const q of questions) {
        if (q.imagePrompt) {
          await new Promise(resolve => setTimeout(resolve, 200)); 
          const imageUrl = await generateQuestionImage(q.imagePrompt);
          questionsWithImages.push({ 
            ...q, 
            imageUrl: imageUrl || `https://picsum.photos/seed/${q.id}${category}/800/450` 
          });
        } else {
          questionsWithImages.push(q);
        }
      }

      return questionsWithImages;
    }
    throw new Error("No data returned");
  } catch (error) {
    console.error("Gemini API Error:", error);
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      question: `Contoh soal untuk ${promptTopic} #${i + 1}?`,
      options: ["Jawaban A", "Jawaban B", "Jawaban C", "Jawaban D"],
      correctAnswer: "Jawaban A",
      imageUrl: `https://picsum.photos/seed/${i}${category}/800/450`
    }));
  }
};