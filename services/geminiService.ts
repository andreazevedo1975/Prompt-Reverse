import { GoogleGenAI, Type } from "@google/genai";
import type { AnalysisResult } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    role: { type: Type.STRING, description: "O papel principal/persona para uma IA que analisa este código (ex: 'Desenvolvedor Sênior React')." },
    languageFramework: { type: Type.STRING, description: "A linguagem principal e/ou framework (ex: 'JavaScript com React')." },
    mainObjective: { type: Type.STRING, description: "Uma breve descrição do que o código implementa (ex: 'um componente de contador simples')." },
    technicalPurpose: { type: Type.STRING, description: "O foco técnico principal (ex: 'gerenciar estado com React Hooks')." },
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


export const analyzeCode = async (code: string): Promise<AnalysisResult> => {
  const prompt = `
    Você é um analista de código especialista e engenheiro de prompts. Sua tarefa é analisar o código-fonte de um projeto com múltiplos arquivos, fornecido abaixo, e gerar um objeto JSON estruturado que detalha suas características principais de forma holística. Este JSON será usado para gerar automaticamente um prompt detalhado para outra IA.

    O projeto consiste nos seguintes arquivos:
    \`\`\`
    ${code}
    \`\`\`

    Com base na sua análise do projeto como um todo, foque na arquitetura geral, como os arquivos interagem e no objetivo principal do projeto. Forneça um objeto JSON com a estrutura definida. Seja conciso e preciso.
  `;

  let response;
  try {
    response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
      },
    });
  } catch (error: any) {
    console.error("Gemini API call failed:", error);

    if (error.message?.includes('API key not valid')) {
       throw new Error("A chave da API do Gemini não é válida. Verifique suas credenciais.");
    }
    
    let isNetworkOrServerError = false;
    let detailedMessage = error.message;

    // Check for common network/server error indicators in the raw string
    if (error.message?.includes('xhr error') || error.message?.includes('500') || error.message?.includes('server error')) {
        isNetworkOrServerError = true;
    }

    // Try to parse the message as JSON for more specific details
    try {
        const errorObj = JSON.parse(error.message);
        if (errorObj.error) {
            detailedMessage = errorObj.error.message || detailedMessage;
            if (errorObj.error.code === 500 || errorObj.error.status === 'UNKNOWN' || errorObj.error.status === 'UNAVAILABLE') {
                isNetworkOrServerError = true;
            }
        }
    } catch(e) {
        // Not a JSON string, we rely on the string check above.
    }
    
    if (isNetworkOrServerError) {
        throw new Error("Falha na comunicação com a API do Gemini. Isso pode ser um problema de rede ou um erro temporário do servidor. Verifique sua conexão com a internet, desative qualquer firewall ou bloqueador de anúncios e tente novamente em alguns instantes.");
    }
    
    throw new Error(`Ocorreu um erro ao comunicar com a API do Gemini. Detalhes: ${detailedMessage}`);
  }
  
  const jsonText = response.text.trim();
  if (!jsonText) {
    throw new Error("A API do Gemini retornou uma resposta vazia. O código pode ser muito complexo ou a solicitação foi bloqueada.");
  }

  try {
    return JSON.parse(jsonText) as AnalysisResult;
  } catch (e) {
    console.error("Failed to parse Gemini's JSON response:", jsonText);
    throw new Error("A resposta da API não era um JSON válido. A IA pode ter retornado um formato inesperado.");
  }
};
