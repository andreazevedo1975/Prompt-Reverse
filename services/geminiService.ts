
import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { AnalysisResult } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    role: { type: Type.STRING, description: "O papel principal/persona para uma IA que analisa este código." },
    languageFramework: { type: Type.STRING, description: "A linguagem principal e/ou framework." },
    mainObjective: { type: Type.STRING, description: "Uma breve descrição do que o código implementa." },
    technicalPurpose: { type: Type.STRING, description: "O foco técnico principal." },
    keyFeatures: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Um array de 3-5 strings, cada uma descrevendo uma funcionalidade chave."
    },
    structureClasses: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Um array de strings listando as classes ou componentes principais."
    },
    structureFunctions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Um array de strings listando funções ou métodos chave."
    },
    dependencies: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Um array de strings listando bibliotecas ou dependências críticas."
    }
  },
  required: ["role", "languageFramework", "mainObjective", "technicalPurpose", "keyFeatures", "structureClasses", "structureFunctions", "dependencies"]
};

export const analyzeCode = async (code: string, useDeepThinking: boolean = false): Promise<AnalysisResult> => {
  const modelName = useDeepThinking ? 'gemini-3-pro-preview' : 'gemini-2.5-flash';
  
  const thinkingConfig = useDeepThinking ? {
    thinkingConfig: { thinkingBudget: 32768 } // Max budget for Gemini 3 Pro
  } : {};

  const prompt = `
    Você é um analista de código especialista.
    Analise o código-fonte fornecido abaixo e gere um objeto JSON estruturado.
    
    ${useDeepThinking ? "Use sua capacidade avançada de raciocínio para entender arquiteturas complexas e intenções implícitas no código." : ""}

    Projeto:
    \`\`\`
    ${code.substring(0, 100000)} 
    \`\`\`
    
    Retorne APENAS o JSON válido correspondente ao schema solicitado.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        ...thinkingConfig
      },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as AnalysisResult;
  } catch (error: any) {
    console.error("Code Analysis failed:", error);
    throw new Error(`Falha na análise do código: ${error.message}`);
  }
};

export const researchContext = async (dependencies: string[]): Promise<{ title: string, url: string }[]> => {
  if (!dependencies || dependencies.length === 0) return [];
  
  const query = `What are the latest official documentation links and purpose for these libraries: ${dependencies.slice(0, 5).join(', ')}?`;
  
  try {
    // Google Search Grounding (must use standard model, not thinking model for tools)
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: query,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    // Extract grounding chunks
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      return chunks
        .filter((c: any) => c.web?.uri && c.web?.title)
        .map((c: any) => ({ title: c.web.title, url: c.web.uri }));
    }
    return [];
  } catch (e) {
    console.warn("Search grounding failed", e);
    return [];
  }
};

export const refinePrompt = async (originalPrompt: string, instructions: string): Promise<string> => {
  const prompt = `
    Refine este prompt de engenharia reversa com base no feedback: "${instructions}".
    
    Prompt Original:
    ${originalPrompt}
    
    Retorne apenas o novo prompt.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text.trim();
  } catch (error: any) {
    throw new Error("Falha ao refinar prompt: " + error.message);
  }
};

// --- Creative Tools ---

export const generateProjectLogo = async (description: string): Promise<string> => {
  try {
    const prompt = `A modern, high-quality tech logo for a software project described as: ${description}. Minimalist, vector art style, professional, on a dark background.`;
    
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: '1:1',
        outputMimeType: 'image/jpeg'
      },
    });

    const base64Image = response.generatedImages[0].image.imageBytes;
    return `data:image/jpeg;base64,${base64Image}`;
  } catch (error: any) {
    console.error("Imagen failed:", error);
    throw new Error("Falha na geração de imagem: " + error.message);
  }
};

export const generateAudioSummary = async (text: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Aqui está o resumo do seu projeto: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("Áudio não gerado.");
    
    return `data:audio/wav;base64,${base64Audio}`;
  } catch (error: any) {
    console.error("TTS failed:", error);
    throw new Error("Falha na geração de áudio: " + error.message);
  }
};

export const generateVideoPitch = async (description: string): Promise<string> => {
  try {
    // Veo generation
    // Using fast-generate for responsiveness
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: `A cinematic abstract technology background video representing: ${description}. High tech, futuristic, glowing lines, 4k render.`,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });

    // Polling loop
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) throw new Error("URI do vídeo não encontrado.");

    // Fetch the actual bytes using the key
    const videoUrlWithKey = `${videoUri}&key=${process.env.API_KEY}`;
    return videoUrlWithKey;

  } catch (error: any) {
    console.error("Veo failed:", error);
    throw new Error("Falha na geração de vídeo: " + error.message);
  }
};
