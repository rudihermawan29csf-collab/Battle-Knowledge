import { GoogleGenAI, Type } from "@google/genai";
import { Category, Question } from "../types";

/**
 * Initializes the AI client using the shimmed process.env.API_KEY.
 */
const getAIClient = () => {
  const apiKey = process.env.API_KEY || "";
  if (!apiKey) {
    throw new Error("TACTICAL ALERT: API_KEY is missing. Intel cannot be gathered.");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Generates an AI image for the question context.
 */
export const generateQuestionImage = async (prompt: string): Promise<string | undefined> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{
          text: `Tactical 3D game illustration for a mobile battle royale. Theme: ${prompt}. Dramatic lighting, vibrant cinematic style.`,
        }],
      },
      config: { 
        imageConfig: { aspectRatio: "16:9" } 
      }
    });

    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (part?.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  } catch (err) {
    console.warn("Failed to generate AI visual:", err);
  }
  return undefined;
};

/**
 * Generates dynamic questions based on the selected category.
 * Offline mode has been removed per user request.
 */
export const generateQuestions = async (category: Category, subTopic: string | null = null, count: number): Promise<Question[]> => {
  const topicName = subTopic ? `${category} (${subTopic})` : category;
  const ai = getAIClient();

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate exactly ${count} multiple-choice quiz questions about "${topicName}" in Indonesian.
      Requirements:
      1. Use high-quality educational content.
      2. Return a valid JSON array of objects.
      3. Each object must have: id (number), question (string), options (array of 4 strings), correctAnswer (string), and imagePrompt (detailed visual description).
      4. correctAnswer must match exactly one of the values in the options array.`,
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
    // Clean up any potential markdown formatting
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    if (!text) throw new Error("EMPTY INTEL: No data received from satellites.");
    
    const rawQuestions: any[] = JSON.parse(text);

    // Fetch images in parallel for a faster start
    const finalQuestions = await Promise.all(rawQuestions.map(async (q, idx) => {
      // For performance, we generate AI images only for the first few questions
      // and use placeholders for others, or attempt for all if latency isn't an issue.
      const imageUrl = await generateQuestionImage(q.imagePrompt || q.question);
      
      return {
        ...q,
        id: idx,
        imageUrl: imageUrl || `https://picsum.photos/seed/intel-${idx}-${category}/800/450`
      };
    }));

    return finalQuestions;

  } catch (error: any) {
    console.error("MISSION FAILURE:", error);
    // Propagate the error to the UI so it doesn't just show empty data
    throw new Error(error?.message || "SIGNAL LOST: Connection to Battle Intelligence failed.");
  }
};