import { GoogleGenAI, Type } from "@google/genai";
import { Category, Question } from "../types";

/**
 * Mendapatkan instance AI. 
 * Kunci API diambil dari process.env.API_KEY yang sudah di-shim oleh Vite.
 */
const getAIClient = () => {
  const apiKey = process.env.API_KEY || "";
  return new GoogleGenAI({ apiKey });
};

/**
 * Soal cadangan jika API tidak tersedia atau gagal.
 */
const getOfflineQuestions = (category: string, count: number): Question[] => {
  const offlineData: Record<string, string[]> = {
    [Category.MATH]: ["Berapa 15 + 25?", "Berapa 100 - 45?", "Berapa 12 x 5?", "Berapa 81 : 9?"],
    [Category.HISTORY_INDO]: ["Kapan Indonesia Merdeka?", "Siapa Presiden pertama Indonesia?", "Apa nama kerajaan Hindu tertua?", "Di mana teks Proklamasi dibacakan?"],
    "default": ["Siapa penemu lampu pijar?", "Apa planet terbesar di tata surya?", "Berapa jumlah provinsi di Indonesia?", "Apa simbol kimia untuk air?"]
  };

  const pool = offlineData[category] || offlineData["default"];

  return Array.from({ length: count }).map((_, i) => {
    const qText = pool[i % pool.length];
    return {
      id: i,
      question: `[OFFLINE] ${qText} (#${i + 1})`,
      options: ["Opsi A", "Opsi B", "Opsi C", "Opsi D"],
      correctAnswer: "Opsi A",
      imageUrl: `https://picsum.photos/seed/offline-${category}-${i}/800/450`
    };
  });
};

/**
 * Menghasilkan gambar menggunakan model image.
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
          text: `A high-quality 3D cinematic game illustration: ${prompt}. Style: Free Fire tactical art.`,
        }],
      },
      config: { imageConfig: { aspectRatio: "16:9" } }
    });

    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (part?.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  } catch (err) {
    console.warn("Gagal generate gambar, menggunakan placeholder.");
  }
  return undefined;
};

/**
 * Menghasilkan daftar soal.
 */
export const generateQuestions = async (category: Category, subTopic: string | null = null, count: number): Promise<Question[]> => {
  const apiKey = process.env.API_KEY;
  const topicName = subTopic ? `${category} - ${subTopic}` : category;

  if (!apiKey || apiKey.length < 5) {
    console.warn("API_KEY tidak valid, menggunakan mode offline.");
    return getOfflineQuestions(topicName, count);
  }

  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Buatlah ${count} soal pilihan ganda tentang "${topicName}" dalam Bahasa Indonesia.
      Output HARUS berupa JSON array murni tanpa markdown.
      Skema objek: { "id": number, "question": string, "options": string[4], "correctAnswer": string, "imagePrompt": string }
      Pastikan correctAnswer sama persis dengan salah satu elemen di options.`,
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

    let text = response.text || "";
    // Membersihkan blok kode markdown jika model tetap menyertakannya
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    if (!text) throw new Error("Respon AI kosong.");
    
    const questions: any[] = JSON.parse(text);

    // Mempercepat dengan tidak menunggu semua gambar selesai digenerate secara sekuensial
    const finalQuestions = questions.map((q, idx) => ({
      ...q,
      id: idx,
      // Placeholder awal, nanti bisa diupdate jika perlu atau biarkan asinkron
      imageUrl: `https://picsum.photos/seed/q-${idx}-${category}/800/450`
    }));

    return finalQuestions;

  } catch (error) {
    console.error("Kesalahan API Gemini, beralih ke offline:", error);
    return getOfflineQuestions(topicName, count);
  }
};