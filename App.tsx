
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Header } from './components/Header';
import { CodeInput } from './components/CodeInput';
import { PromptOutput } from './components/PromptOutput';
import { Loader } from './components/Loader';
import { ErrorBoundary } from './components/ErrorBoundary';
import { analyzeCode, refinePrompt, researchContext } from './services/geminiService';
import { BrainIcon, SearchIcon } from './components/icons';
import type { AnalysisResult, UploadedFile, GenerationContext } from './types';

type PromptStyle = 'technical' | 'compact' | 'concise' | 'popular' | 'friendly' | 'lovable' | 'descriptive' | 'base44';

const formatTechnicalPrompt = (analysis: AnalysisResult, originalCode: string, task: string): string => {
  const {
    languageFramework,
    mainObjective,
    technicalPurpose,
    keyFeatures,
    structureClasses,
    structureFunctions,
    dependencies,
    groundingLinks
  } = analysis;

  const language = languageFramework.split(' ')[0]?.toLowerCase() || 'text';

  let prompt = `Olá! Por favor, comporte-se como um engenheiro de software sênior especialista.

Analise o seguinte projeto de código, cuja referência completa está no final.

**Resumo da Análise:**

- **Linguagem/Framework Principal:** ${languageFramework}
- **Objetivo Principal:** ${mainObjective}
- **Propósito Técnico:** ${technicalPurpose}

**Funcionalidades Chave:**
${keyFeatures.map(f => `- ${f}`).join('\n')}

**Estrutura do Código:**
- **Classes/Componentes Principais:**
${structureClasses.length > 0 ? structureClasses.map(c => `  - ${c}`).join('\n') : '  - Nenhuma identificada'}
- **Funções/Métodos Principais:**
${structureFunctions.length > 0 ? structureFunctions.map(f => `  - ${f}`).join('\n') : '  - Nenhuma identificada'}
- **Dependências Críticas:**
${dependencies.length > 0 ? dependencies.map(d => `  - ${d}`).join('\n') : '  - Nenhuma identificada'}

**Código-Fonte de Referência:**
\`\`\`${language}
${originalCode}
\`\`\`
`;

  if (groundingLinks && groundingLinks.length > 0) {
    prompt += `\n**Referências Externas (Documentação):**\n${groundingLinks.map(l => `- [${l.title}](${l.url})`).join('\n')}\n`;
  }

  if (task) {
    prompt += `\n**Tarefa Solicitada:**\nCom base na análise e no código fornecido, execute a seguinte tarefa: **${task}**`;
  }

  return prompt.trim();
};

const formatCompactPrompt = (analysis: AnalysisResult, originalCode: string, task: string): string => {
  const {
    languageFramework,
    mainObjective,
    keyFeatures,
  } = analysis;

  const language = languageFramework.split(' ')[0]?.toLowerCase() || 'text';

  let prompt = `Atue como um engenheiro de software sênior. Analise o código de forma direta e objetiva.

**Contexto Essencial:**
- **Linguagem/Framework:** ${languageFramework}
- **Objetivo Principal:** ${mainObjective}

**Funcionalidades Chave:**
${keyFeatures.map(f => `- ${f}`).join('\n')}

**Código de Referência:**
\`\`\`${language}
${originalCode}
\`\`\`
`;

  if (task) {
    prompt += `\n**Tarefa:**\n${task}`;
  }

  return prompt.trim();
};

const formatConcisePrompt = (analysis: AnalysisResult, originalCode: string, task: string): string => {
  const {
    languageFramework,
    mainObjective,
    keyFeatures,
  } = analysis;

  const language = languageFramework.split(' ')[0]?.toLowerCase() || 'text';

  let prompt = `**Linguagem:** ${languageFramework}
**Objetivo:** ${mainObjective}

**Funcionalidades:**
${keyFeatures.map(f => `- ${f}`).join('\n')}

**Código:**
\`\`\`${language}
${originalCode}
\`\`\`
`;

  if (task) {
    prompt += `\n**Tarefa:** ${task}`;
  }

  return prompt.trim();
};

const formatPopularPrompt = (analysis: AnalysisResult, originalCode: string, task: string): string => {
  const {
    mainObjective,
    keyFeatures,
    languageFramework,
  } = analysis;

  const language = languageFramework.split(' ')[0]?.toLowerCase() || 'text';

  let prompt = `Me explica de um jeito fácil o que esse código em **${languageFramework}** faz.

**O que ele faz, em poucas palavras:**
${mainObjective}

**Principais funcionalidades (o que ele consegue fazer):**
${keyFeatures.map(f => `- ${f}`).join('\n')}

Para referência, aqui está o código completo:
\`\`\`${language}
${originalCode}
\`\`\`
`;

  if (task) {
    prompt += `\nAgora, com base no que você entendeu, me ajude com isso:\n**${task}**`;
  }

  return prompt.trim();
};

const formatFriendlyPrompt = (analysis: AnalysisResult, originalCode: string, task: string): string => {
  const {
    languageFramework,
    mainObjective,
    keyFeatures,
  } = analysis;

  const language = languageFramework.split(' ')[0]?.toLowerCase() || 'text';

  let prompt = `👋 Oi! Gostaria de conversar sobre este código em **${languageFramework}**.

🌟 **O que ele é:**
${mainObjective}

✨ **Funcionalidades legais:**
${keyFeatures.map(f => `🔹 ${f}`).join('\n')}

📂 **Aqui está o código original:**
\`\`\`${language}
${originalCode}
\`\`\`
`;

  if (task) {
    prompt += `\n🤝 **Poderia me ajudar com isso?**\n${task}`;
  } else {
    prompt += `\nMe diga o que acha dele! 😊`;
  }

  return prompt.trim();
};

const formatDescriptivePrompt = (analysis: AnalysisResult, originalCode: string, task: string): string => {
  const {
    mainObjective,
    keyFeatures,
  } = analysis;

  let prompt = `Você é um especialista em tecnologia focado em explicar soluções para pessoas não técnicas.
Por favor, descreva este software focando puramente no valor que ele entrega e na experiência do usuário, ignorando detalhes de código.

**Resumo do Produto:**
${mainObjective}

**O que eu consigo fazer com isso (Funcionalidades):**
${keyFeatures.map(f => `- ${f}`).join('\n')}

**Contexto:**
Eu tenho os arquivos deste projeto, mas não sei programar. Quero entender para que ele serve e como ele facilita a vida do usuário, em linguagem simples e direta.

**Arquivo de Referência (Código):**
\`\`\`text
${originalCode}
\`\`\`
`;

  if (task) {
    prompt += `\n**Gostaria de ajuda com:**\n${task}`;
  }

  return prompt.trim();
};

const formatLovablePrompt = (analysis: AnalysisResult, originalCode: string, task: string): string => {
  const {
    languageFramework,
    mainObjective,
    technicalPurpose,
    keyFeatures,
    structureClasses,
    structureFunctions,
    dependencies,
  } = analysis;

  const language = languageFramework.split(' ')[0]?.toLowerCase() || 'text';

  let prompt = `✨ **Olá! Vamos transformar código em algo incrível!** 🚀

Atue como um "CreativeAI Companion" - um parceiro de codificação amigável, entusiasta e altamente qualificado.

**🎯 Visão Geral:**
${mainObjective}

**🧠 A Lógica Brilhante:**
${technicalPurpose}

**💻 Tech Stack:** ${languageFramework}

**🌟 Funcionalidades Mágicas:**
${keyFeatures.map(f => `✨ ${f}`).join('\n')}

**🏗️ Estrutura:**
${structureClasses.length > 0 ? structureClasses.map(c => `🧩 ${c}`).join('\n') : ''}
${structureFunctions.length > 0 ? structureFunctions.map(f => `⚡ ${f}`).join('\n') : ''}
${structureClasses.length === 0 && structureFunctions.length === 0 ? '🧱 Estrutura simplificada' : ''}

**📦 Dependências:**
${dependencies.length > 0 ? dependencies.map(d => `📦 ${d}`).join('\n') : '📦 Sem dependências extras'}

**📜 Código-Fonte:**
\`\`\`${language}
${originalCode}
\`\`\`
`;

  if (task) {
    prompt += `\n**🌈 Sua Missão Criativa:**\n${task}`;
  }

  return prompt.trim();
};

const formatBase44Prompt = (analysis: AnalysisResult, originalCode: string, task: string): string => {
  const {
    languageFramework,
    mainObjective,
    technicalPurpose,
    keyFeatures,
    structureClasses,
    structureFunctions,
    dependencies,
  } = analysis;

  const language = languageFramework.split(' ')[0]?.toLowerCase() || 'text';

  let prompt = `@@BEGIN_PROMPT_TRANSMISSION
@@FORMAT: Base44 💖
@@RECIPIENT: CreativeAI_Companion
@@CONSTRAINTS: Mantenha a vibe positiva e amigável! Limite a resposta a +/- 50 linhas para leitura rápida.

@@CONTEXT_HEADER: ✨ Olá! Encontrei algo incrível para construirmos juntos! 🚀

@@OBJECTIVE: 🎯 **O que é isso?**
${mainObjective}

@@DEEP_DIVE: 🧠 **A Lógica Brilhante:**
${technicalPurpose}

@@CORE_TECH: 💻 **Feito com:** ${languageFramework}

@@SUPERPOWERS: 🌟 **Funcionalidades Mágicas:**
${keyFeatures.map(f => `✨ ${f}`).join('\n')}

@@BLUEPRINT: 🏗️ **A Estrutura & Peças:**
${structureClasses.length > 0 ? structureClasses.map(c => `🧩 ${c}`).join('\n') : ''}
${structureFunctions.length > 0 ? structureFunctions.map(f => `⚡ ${f}`).join('\n') : ''}
${structureClasses.length === 0 && structureFunctions.length === 0 ? '🧱 Estrutura simplificada' : ''}

@@SECRET_SAUCE: 🧂 **Ingredientes Especiais (Deps):**
${dependencies.length > 0 ? dependencies.map(d => `📦 ${d}`).join('\n') : '📦 Sem dependências extras'}

@@SOURCE_CODE: 📜 **O Pergaminho de Código:**
\`\`\`${language}
${originalCode}
\`\`\`
`;

  if (task) {
    prompt += `\n@@YOUR_MISSION: 🌈 **Sua Missão:**\nCom base em tudo isso, vamos criar mágica: **${task}**`;
  }

  prompt += `\n\n@@END_PROMPT_TRANSMISSION 🚀`;

  return prompt.trim();
};


const App: React.FC = () => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [additionalTask, setAdditionalTask] = useState<string>('');
  
  // Feature Flags
  const [useDeepThinking, setUseDeepThinking] = useState<boolean>(false);
  const [useSearchGrounding, setUseSearchGrounding] = useState<boolean>(false);
  
  // History and Context State
  const [history, setHistory] = useState<GenerationContext[]>([]);
  const [currentContext, setCurrentContext] = useState<GenerationContext | null>(null);
  
  const [promptStyle, setPromptStyle] = useState<PromptStyle>('technical');
  const [refinedPrompt, setRefinedPrompt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const combinedCode = useMemo(() => uploadedFiles
      .map(file => `// FILE: ${file.path}\n\n${file.content}`)
      .join('\n\n---\n\n'), [uploadedFiles]);

  useEffect(() => {
    setRefinedPrompt(null);
  }, [promptStyle, currentContext]);

  const displayedPrompt = useMemo(() => {
    if (refinedPrompt) return refinedPrompt;
    if (!currentContext) return '';
    
    const { analysis, code, task } = currentContext;
    
    const formatters: Record<PromptStyle, (analysis: AnalysisResult, originalCode: string, task: string) => string> = {
      technical: formatTechnicalPrompt,
      compact: formatCompactPrompt,
      concise: formatConcisePrompt,
      popular: formatPopularPrompt,
      friendly: formatFriendlyPrompt,
      descriptive: formatDescriptivePrompt,
      lovable: formatLovablePrompt,
      base44: formatBase44Prompt,
    };
    
    return formatters[promptStyle](analysis, code, task);

  }, [currentContext, promptStyle, refinedPrompt]);


  const handleGeneratePrompt = useCallback(async () => {
    if (uploadedFiles.length === 0) {
      setError('Por favor, faça o upload de um arquivo ou pasta com código para analisar.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setRefinedPrompt(null);

    try {
      // 1. Main Analysis (Normal or Thinking)
      const result = await analyzeCode(combinedCode, useDeepThinking);
      
      // 2. Optional Search Grounding
      if (useSearchGrounding && result.dependencies.length > 0) {
          const links = await researchContext(result.dependencies);
          result.groundingLinks = links;
      }

      const newContext: GenerationContext = {
        id: crypto.randomUUID(),
        analysis: result,
        code: combinedCode,
        task: additionalTask,
        timestamp: Date.now()
      };

      setCurrentContext(newContext);
      setHistory(prev => [newContext, ...prev]);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocorreu um erro desconhecido durante a análise.');
    } finally {
      setIsLoading(false);
    }
  }, [uploadedFiles, combinedCode, additionalTask, useDeepThinking, useSearchGrounding]);

  const handleRefinePrompt = async (instructions: string) => {
    if (!displayedPrompt || !instructions) return;
    
    setIsRefining(true);
    try {
        const refined = await refinePrompt(displayedPrompt, instructions);
        setRefinedPrompt(refined);
    } catch (err: any) {
        console.error(err);
        alert("Erro ao refinar prompt: " + err.message);
    } finally {
        setIsRefining(false);
    }
  };

  const handleRevertRefinement = () => {
    setRefinedPrompt(null);
  };

  const handleSelectHistory = (context: GenerationContext) => {
    setCurrentContext(context);
  };
  
  const updateContextWithMedia = (type: 'logo' | 'audio' | 'video', url: string) => {
     if (!currentContext) return;
     const updated = { ...currentContext };
     if (type === 'logo') updated.generatedLogoUrl = url;
     if (type === 'audio') updated.generatedAudioUrl = url;
     if (type === 'video') updated.generatedVideoUrl = url;
     
     setCurrentContext(updated);
     setHistory(prev => prev.map(h => h.id === updated.id ? updated : h));
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-400 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <Header />
        <main className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="flex flex-col space-y-6">
            <ErrorBoundary componentName="Code Input">
              <CodeInput
                uploadedFiles={uploadedFiles}
                setUploadedFiles={setUploadedFiles}
                additionalTask={additionalTask}
                setAdditionalTask={setAdditionalTask}
              />
            </ErrorBoundary>
            
            <div className="bg-gray-800 p-4 rounded-md border border-gray-700 space-y-3">
                <h3 className="text-sm font-medium text-gray-300 flex items-center">
                   Configurações Avançadas de IA
                </h3>
                <div className="flex flex-col space-y-2">
                    <label className="flex items-center space-x-3 cursor-pointer">
                        <div className="relative">
                            <input 
                                type="checkbox" 
                                checked={useDeepThinking}
                                onChange={(e) => setUseDeepThinking(e.target.checked)}
                                className="sr-only peer" 
                            />
                            <div className="w-10 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </div>
                        <span className="text-sm text-gray-400 flex items-center">
                            <BrainIcon className="w-4 h-4 mr-2 text-purple-400" />
                            Deep Thinking (Gemini 3 Pro)
                        </span>
                    </label>
                     <label className="flex items-center space-x-3 cursor-pointer">
                        <div className="relative">
                            <input 
                                type="checkbox" 
                                checked={useSearchGrounding}
                                onChange={(e) => setUseSearchGrounding(e.target.checked)}
                                className="sr-only peer" 
                            />
                            <div className="w-10 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </div>
                        <span className="text-sm text-gray-400 flex items-center">
                            <SearchIcon className="w-4 h-4 mr-2 text-blue-400" />
                             Pesquisar Dependências (Google Search)
                        </span>
                    </label>
                </div>
            </div>

            <button
              onClick={handleGeneratePrompt}
              disabled={isLoading || uploadedFiles.length === 0}
              className="w-full flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-500 hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader />
                  <span className="ml-2">
                    {useDeepThinking ? 'Pensando profundamente...' : 'Analisando código...'}
                  </span>
                </>
              ) : (
                'Gerar Prompt Fiel'
              )}
            </button>
          </div>
          
          <div className="bg-gray-800 rounded-lg shadow-lg p-1 min-h-[400px] lg:min-h-0 relative flex flex-col">
            <ErrorBoundary componentName="Prompt Output">
              {error ? (
                <div className="h-full flex items-center justify-center p-4 flex-grow">
                    <div className="text-center text-red-400">
                      <h3 className="font-bold text-lg">Ocorreu um erro</h3>
                      <p>{error}</p>
                    </div>
                </div>
              ) : isLoading ? (
                <div className="h-full flex items-center justify-center flex-grow">
                    <div className="text-center p-8">
                      <Loader size="lg"/>
                      <p className="mt-4 text-gray-300 text-lg font-medium">
                        {useDeepThinking ? 'O Gemini 3 Pro está raciocinando sobre a arquitetura...' : 'Engenharia reversa em andamento...'}
                      </p>
                      {useSearchGrounding && <p className="mt-2 text-sm text-blue-400">Consultando o Google Search...</p>}
                    </div>
                </div>
              ) : (
                <PromptOutput 
                  prompt={displayedPrompt} 
                  promptStyle={promptStyle}
                  setPromptStyle={setPromptStyle}
                  history={history}
                  onSelectHistory={handleSelectHistory}
                  currentContextId={currentContext?.id}
                  onRefine={handleRefinePrompt}
                  isRefining={isRefining}
                  isRefined={!!refinedPrompt}
                  onRevertRefinement={handleRevertRefinement}
                  currentContext={currentContext}
                  onUpdateContext={updateContextWithMedia}
                />
              )}
             </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
