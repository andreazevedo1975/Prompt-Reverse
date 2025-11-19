import React, { useState, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { CodeInput } from './components/CodeInput';
import { PromptOutput } from './components/PromptOutput';
import { Loader } from './components/Loader';
import { analyzeCode } from './services/geminiService';
import type { AnalysisResult, UploadedFile } from './types';

type PromptStyle = 'technical' | 'popular' | 'lovable';

const formatTechnicalPrompt = (analysis: AnalysisResult, originalCode: string, task: string): string => {
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

  if (task) {
    prompt += `\n**Tarefa Solicitada:**\nCom base na análise e no código fornecido, execute a seguinte tarefa: **${task}**`;
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

const formatLovableBase44Prompt = (analysis: AnalysisResult, originalCode: string, task: string): string => {
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
@@FORMAT: Lovable/Base44
@@RECIPIENT: CreativeAI_Companion

@@CONTEXT_HEADER: Olá! Aqui está um resumo de um código bem legal!

@@OBJECTIVE: ${mainObjective}

@@DEEP_DIVE_PURPOSE: Tecnicamente falando, o foco é ${technicalPurpose}.

@@CORE_TECH: Esta pequena maravilha foi construída com ${languageFramework}.

@@SUPERPOWERS:
${keyFeatures.map(f => `# ${f}`).join('\n')}

@@BLUEPRINT:
## Componentes Principais (os grandes blocos de construção):
${structureClasses.length > 0 ? structureClasses.map(c => `- ${c}`).join('\n') : '- Nenhum identificado'}

## Funções Principais (os feitiços mágicos):
${structureFunctions.length > 0 ? structureFunctions.map(f => `- ${f}`).join('\n') : '- Nenhuma identificada'}

## Ingredientes Secretos (dependências):
${dependencies.length > 0 ? dependencies.map(d => `- ${d}`).join('\n') : '- Nenhuma identificada'}

@@SOURCE_CODE_REFERENCE: A receita completa está aqui!
\`\`\`${language}
${originalCode}
\`\`\`
`;

  if (task) {
    prompt += `\n@@YOUR_MISSION:\nCom base no que você entendeu, execute esta missão: **${task}**`;
  }

  prompt += `\n\n@@END_PROMPT_TRANSMISSION`;

  return prompt.trim();
};


const App: React.FC = () => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [additionalTask, setAdditionalTask] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [promptStyle, setPromptStyle] = useState<PromptStyle>('technical');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const combinedCode = useMemo(() => uploadedFiles
      .map(file => `// FILE: ${file.path}\n\n${file.content}`)
      .join('\n\n---\n\n'), [uploadedFiles]);

  const displayedPrompt = useMemo(() => {
    if (!analysisResult) return '';
    
    const formatters: Record<PromptStyle, (analysis: AnalysisResult, originalCode: string, task: string) => string> = {
      technical: formatTechnicalPrompt,
      popular: formatPopularPrompt,
      lovable: formatLovableBase44Prompt,
    };
    
    return formatters[promptStyle](analysisResult, combinedCode, additionalTask);

  }, [analysisResult, promptStyle, additionalTask, combinedCode]);


  const handleGeneratePrompt = useCallback(async () => {
    if (uploadedFiles.length === 0) {
      setError('Por favor, faça o upload de um arquivo ou pasta com código para analisar.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const result = await analyzeCode(combinedCode);
      setAnalysisResult(result);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocorreu um erro desconhecido durante a análise.');
    } finally {
      setIsLoading(false);
    }
  }, [uploadedFiles, combinedCode]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-400 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <Header />
        <main className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="flex flex-col space-y-6">
            <CodeInput
              uploadedFiles={uploadedFiles}
              setUploadedFiles={setUploadedFiles}
              additionalTask={additionalTask}
              setAdditionalTask={setAdditionalTask}
            />
            <button
              onClick={handleGeneratePrompt}
              disabled={isLoading || uploadedFiles.length === 0}
              className="w-full flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-500 hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader />
                  <span className="ml-2">Analisando...</span>
                </>
              ) : (
                'Gerar Prompt Fiel'
              )}
            </button>
          </div>
          <div className="bg-gray-800 rounded-lg shadow-lg p-1 min-h-[400px] lg:min-h-0">
             {error && (
              <div className="h-full flex items-center justify-center p-4">
                  <div className="text-center text-red-400">
                    <h3 className="font-bold text-lg">Ocorreu um erro</h3>
                    <p>{error}</p>
                  </div>
              </div>
            )}
            {!error && (isLoading ? (
              <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Loader size="lg"/>
                    <p className="mt-4 text-gray-500">A IA está realizando a engenharia reversa do seu código...</p>
                  </div>
              </div>
            ) : (
              <PromptOutput 
                prompt={displayedPrompt} 
                promptStyle={promptStyle}
                setPromptStyle={setPromptStyle}
              />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;