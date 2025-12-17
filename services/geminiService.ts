import { GoogleGenAI, Type } from "@google/genai";
import { Category, Question } from "../types";

// Inisialisasi AI dengan pengecekan kunci
const getAIClient = () => {
  const apiKey = process.env.API_KEY || "";
  return new GoogleGenAI({ apiKey });
};

/**
 * Fungsi pembantu untuk memberikan soal offline jika API gagal
 */
const getOfflineQuestions = (category: string, count: number): Question[] => {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    question: `[OFFLINE MODE] Pertanyaan strategis tentang ${category} Sektor ${i + 1}?`,
    options: ["Opsi A (Taktis)", "Opsi B (Strategis)", "Opsi C (Teknis)", "Opsi D (Operasional)"],
    correctAnswer: "Opsi A (Taktis)",
    imageUrl: `https://picsum.photos/seed/${i}${category}/800/450`
  }));
};

/**
 * Generates a base64 image using the Gemini image model.
 */
export const generateQuestionImage = async (prompt: string): Promise<string | undefined> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return undefined;

  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{
          text: `Tactical game asset for a battle royale quiz: ${prompt}. Cinematic lighting, 3D render style.`,
        }],
      },
      config: { imageConfig: { aspectRatio: "16:9" } }
    });

    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (part?.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  } catch (err) {
    console.warn("Image generation failed:", err);
  }
  return undefined;
};

export const generateQuestions = async (category: Category, subTopic: string | null = null, count: number): Promise<Question[]> => {
  const apiKey = process.env.API_KEY;
  const topic = subTopic ? `${category} (${subTopic})` : category;

  if (!apiKey) {
    console.warn("API_KEY tidak ditemukan. Menggunakan mode offline.");
    return getOfflineQuestions(topic, count);
  }

  try {
    const ai = getAIClient();
    // Menggunakan gemini-3-flash-preview untuk kecepatan dan efisiensi JSON
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Buatkan ${count} soal pilihan ganda tentang "${topic}" dalam Bahasa Indonesia.
      Output HARUS berupa JSON array. Setiap objek memiliki:
      id (number), question (string), options (array of 4 strings), 
      correctAnswer (string, harus sama persis dengan salah satu opsi), 
      imagePrompt (deskripsi visual singkat untuk soal ini).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.NUMBER },
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.STRING },
              imagePrompt: { type: Type.STRING }
            },
            required: ["id", "question", "options", "correctAnswer", "imagePrompt"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini");
    
    const questions: Question[] = JSON.parse(text);

    // Proses gambar secara paralel agar lebih cepat
    const finalQuestions = await Promise.all(questions.map(async (q) => {
      // Kita batasi generasi gambar asli hanya untuk beberapa soal pertama untuk menghemat rate limit
      // Sisanya gunakan placeholder berkualitas
      const useAIImage = q.id < 3; 
      let imageUrl = `https://picsum.photos/seed/q-${q.id}-${topic}/800/450`;
      
      if (useAIImage) {
        const aiImg = await generateQuestionImage(q.imagePrompt || q.question);
        if (aiImg) imageUrl = aiImg;
      }

      return { ...q, imageUrl };
    }));

    return finalQuestions;

  } catch (error) {
    console.error("Gemini API Error, switching to offline:", error);
    return getOfflineQuestions(topic, count);
  }
};