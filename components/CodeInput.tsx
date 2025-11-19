import React, { useRef, useState } from 'react';
import { FolderUploadIcon, TrashIcon, FileUploadIcon, LinkIcon, GitBranchIcon, CheckIcon, WarningIcon } from './icons';
import { Loader } from './Loader';
import type { UploadedFile } from '../types';

interface CodeInputProps {
  uploadedFiles: UploadedFile[];
  setUploadedFiles: (files: UploadedFile[]) => void;
  additionalTask: string;
  setAdditionalTask: (task: string) => void;
}

interface RepoFetchState {
  loading: boolean;
  error: string | null;
  success: boolean | null;
  message: string | null;
}

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const BLOCKED_EXTENSIONS = new Set([
  // Images
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tif', 'tiff',
  // Documents
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp',
  // Archives
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz',
  // Audio
  'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a',
  // Video
  'mp4', 'avi', 'mov', 'wmv', 'mkv', 'flv', 'webm',
  // Executables & binaries
  'exe', 'dll', 'so', 'dmg', 'bin', 'o', 'a',
  // Fonts
  'woff', 'woff2', 'ttf', 'eot', 'otf',
  // Other
  'lock', 'log', 'DS_Store',
]);


export const CodeInput: React.FC<CodeInputProps> = ({ uploadedFiles, setUploadedFiles, additionalTask, setAdditionalTask }) => {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const singleFileInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  const [urlFetchState, setUrlFetchState] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  const [repoUrl, setRepoUrl] = useState('');
  const [repoFetchState, setRepoFetchState] = useState<RepoFetchState>({ loading: false, error: null, success: null, message: null });
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);

  const base64ToUtf8 = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }
    setUploadWarning(null);

    const validFiles: File[] = [];
    const skippedFiles: { name: string, reason: string }[] = [];

    // FIX: Add explicit type `File` to the `file` parameter to resolve type inference issues.
    Array.from(files).forEach((file: File) => {
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      if (BLOCKED_EXTENSIONS.has(extension)) {
        skippedFiles.push({ name: file.name, reason: 'tipo de arquivo binário' });
      } else if (file.size > MAX_FILE_SIZE_BYTES) {
        skippedFiles.push({ name: file.name, reason: `tamanho excede ${MAX_FILE_SIZE_MB}MB` });
      } else {
        validFiles.push(file);
      }
    });

    if (skippedFiles.length > 0) {
        const skippedFileNames = skippedFiles.map(f => `"${f.name}" (${f.reason})`).join(', ');
        setUploadWarning(`Arquivos ignorados: ${skippedFileNames}. Apenas arquivos de código-fonte baseados em texto e com menos de ${MAX_FILE_SIZE_MB}MB são suportados.`);
    }

    if (validFiles.length === 0) {
        if (event.target) event.target.value = '';
        return;
    }

    const filePromises = validFiles.map((file: File) => {
      return new Promise<UploadedFile>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result;
          if (typeof text === 'string') {
            resolve({ path: (file as any).webkitRelativePath || file.name, content: text });
          } else {
            reject(new Error('Falha ao ler o arquivo como texto.'));
          }
        };
        reader.onerror = () => {
          reject(new Error(`Erro ao ler o arquivo: ${file.name}`));
        };
        reader.readAsText(file);
      });
    });

    try {
      const allFiles = await Promise.all(filePromises);
      setUploadedFiles(allFiles);
    } catch (error) {
      console.error("Erro ao processar arquivos:", error);
      setUploadWarning(error instanceof Error ? error.message : "Ocorreu um erro desconhecido ao processar os arquivos.");
    }

    if (event.target) {
      event.target.value = '';
    }
  };
  
  const handleFetchFromUrl = async () => {
    const urlsToFetch = url.split('\n').map(u => u.trim()).filter(Boolean);
    setUploadWarning(null);

    if (urlsToFetch.length === 0) {
      setUrlFetchState({ loading: false, error: "Por favor, insira uma ou mais URLs." });
      return;
    }
    
    setUrlFetchState({ loading: true, error: null });

    const transformGithubUrl = (originalUrl: string): string => {
        if (originalUrl.includes('github.com') && originalUrl.includes('/blob/')) {
            return originalUrl
                .replace('github.com', 'raw.githubusercontent.com')
                .replace('/blob/', '/');
        }
        return originalUrl;
    };

    const fetchPromises = urlsToFetch.map(async (individualUrl) => {
      try {
        const finalUrl = transformGithubUrl(individualUrl);
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(finalUrl)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) {
          throw new Error(`Status ${response.status}`);
        }
        const text = await response.text();
        return { path: individualUrl, content: text };
      } catch (error: any) {
        throw new Error(`Falha ao buscar ${individualUrl.substring(0, 50)}...: ${error.message}`);
      }
    });

    const results = await Promise.allSettled(fetchPromises);
    
    const successfulFiles: UploadedFile[] = [];
    const errorMessages: string[] = [];

    results.forEach(result => {
        if (result.status === 'fulfilled') {
            successfulFiles.push(result.value);
        } else {
            errorMessages.push(result.reason.message);
        }
    });

    if (successfulFiles.length > 0) {
      setUploadedFiles(successfulFiles);
      setUrl('');
    }

    setUrlFetchState({ 
        loading: false, 
        error: errorMessages.length > 0 ? `Ocorreram erros: ${errorMessages.join('. ')}` : null 
    });
  };

  const handleFetchFromRepo = async () => {
    setUploadWarning(null);
    const RATE_LIMIT_ERROR_MESSAGE = "Limite de requisições da API do GitHub atingido. Para evitar sobrecarga, o GitHub limita o número de solicitações anônimas. Por favor, aguarde um pouco (o bloqueio pode durar até uma hora) antes de tentar novamente. Isso não é um erro do aplicativo.";

    if (!repoUrl) {
        setRepoFetchState({ loading: false, error: "Por favor, insira a URL de um repositório GitHub.", success: false, message: null });
        return;
    }

    setRepoFetchState({ loading: true, error: null, success: null, message: "Analisando a URL do repositório..." });

    let repoPath: string;
    try {
      const urlToParse = repoUrl.startsWith('http') ? repoUrl : `https://${repoUrl}`;
      const url = new URL(urlToParse);
      
      if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') {
         throw new Error("Apenas repositórios do github.com são suportados.");
      }
      
      const pathParts = url.pathname.split('/').filter(p => p);
      if (pathParts.length < 2) {
        throw new Error("Não foi possível extrair o 'usuário/repositório' da URL.");
      }
      
      repoPath = `${pathParts[0]}/${pathParts[1]}`.replace(/\.git$/, '');
    } catch (e: any) {
      setRepoFetchState({ loading: false, error: `URL inválida. ${e.message}. Por favor, use o formato https://github.com/usuario/repositorio.`, success: false, message: null });
      return;
    }

    try {
        setRepoFetchState(prev => ({...prev, message: "Buscando informações do repositório..."}));
        const repoInfoResponse = await fetch(`https://api.github.com/repos/${repoPath}`);
        if (!repoInfoResponse.ok) {
            if (repoInfoResponse.status === 403) {
              throw new Error(RATE_LIMIT_ERROR_MESSAGE);
            }
            if (repoInfoResponse.status === 404) {
                 throw new Error("Repositório não encontrado (erro 404). Verifique se a URL está correta e se o repositório é público.");
            }
            throw new Error(`Não foi possível carregar informações do repositório. Status: ${repoInfoResponse.status}`);
        }
        const repoInfo = await repoInfoResponse.json();
        const defaultBranch = repoInfo.default_branch;

        setRepoFetchState(prev => ({...prev, message: "Buscando lista de arquivos..."}));
        const treeResponse = await fetch(`https://api.github.com/repos/${repoPath}/git/trees/${defaultBranch}?recursive=1`);
        if (!treeResponse.ok) {
            if (treeResponse.status === 403) {
              throw new Error(RATE_LIMIT_ERROR_MESSAGE);
            }
            throw new Error(`Não foi possível carregar a árvore de arquivos. Status: ${treeResponse.status}`);
        }
        const treeData = await treeResponse.json();

        if (treeData.truncated) {
            console.warn("A árvore de arquivos do repositório é muito grande e foi truncada. Apenas uma parte dos arquivos será analisada.");
        }
        
        const isBlockedExtension = (path: string) => {
          const extension = path.split('.').pop()?.toLowerCase();
          return extension ? BLOCKED_EXTENSIONS.has(extension) : false;
        };

        const filesToFetch = treeData.tree
            .filter((node: any) => node.type === 'blob' && !isBlockedExtension(node.path))
            .filter((node: any) => !/(^|[\/\\])(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/i.test(node.path))
            .slice(0, 100); // Increased limit slightly

        const allFiles: UploadedFile[] = [];
        for (let i = 0; i < filesToFetch.length; i++) {
            const file = filesToFetch[i];
            const progressMessage = `Baixando arquivo ${i + 1} de ${filesToFetch.length}: ${file.path}`;
            setRepoFetchState(prev => ({...prev, message: progressMessage }));

            const fileResponse = await fetch(file.url);
            
            if (fileResponse.status === 403) {
                 throw new Error(RATE_LIMIT_ERROR_MESSAGE);
            }

            if (!fileResponse.ok) {
                console.warn(`Não foi possível buscar o arquivo ${file.path}. Status: ${fileResponse.status}. Pulando.`);
                continue;
            }

            const blob = await fileResponse.json();
            if(blob.size > MAX_FILE_SIZE_BYTES) {
                 console.warn(`Arquivo ${file.path} excedeu o limite de tamanho e foi ignorado.`);
                 continue;
            }

            const content = base64ToUtf8(blob.content);
            allFiles.push({ path: file.path, content });
            
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        if (allFiles.length === 0) {
             throw new Error("Nenhum arquivo de código-fonte compatível foi encontrado no repositório, ou os arquivos não puderam ser buscados.");
        }

        setUploadedFiles(allFiles);
        setRepoUrl('');
        setRepoFetchState({ loading: false, error: null, success: true, message: `${allFiles.length} arquivo(s) carregado(s) com sucesso!` });
        
        setTimeout(() => {
          setRepoFetchState(prev => ({ ...prev, success: null, message: null }));
        }, 4000);

    } catch (error: any) {
        console.error("Erro ao buscar do repositório:", error);
        setRepoFetchState({ loading: false, error: `Falha ao carregar o repositório. ${error.message}`, success: false, message: null });
    }
  };


  const handleFolderUploadClick = () => {
    folderInputRef.current?.click();
  };

  const handleSingleFileUploadClick = () => {
    singleFileInputRef.current?.click();
  };
  
  const handleClearFiles = () => {
    setUploadedFiles([]);
    setUploadWarning(null);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUploadWarning(null);
    const newContent = e.target.value;
    if (uploadedFiles.length <= 1) {
        const path = uploadedFiles[0]?.path || 'pasted_code.txt';
        setUploadedFiles([{ path, content: newContent }]);
    }
  };

  let displayContent: string;
  if (uploadedFiles.length > 1) {
    displayContent = `${uploadedFiles.length} arquivo(s) carregado(s):\n\n` + uploadedFiles.map(f => `- ${f.path}`).join('\n');
  } else if (uploadedFiles.length === 1) {
    displayContent = uploadedFiles[0].content;
  } else {
    displayContent = '';
  }


  return (
    <div className="flex flex-col space-y-4">
      <div>
        <div className="flex justify-between items-center mb-2">
          <label htmlFor="code-input" className="block text-sm font-medium text-gray-400">
            Código-Fonte para Análise
          </label>
          <div className="flex items-center space-x-2">
            {uploadedFiles.length > 0 && (
                 <button
                 type="button"
                 onClick={handleClearFiles}
                 className="inline-flex items-center px-3 py-1.5 border border-gray-600 text-xs font-medium rounded-md text-gray-400 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-red-500 transition-colors"
               >
                 <TrashIcon className="h-4 w-4 mr-2" />
                 Limpar
               </button>
            )}
            <button
              type="button"
              onClick={handleSingleFileUploadClick}
              className="inline-flex items-center px-3 py-1.5 border border-gray-600 text-xs font-medium rounded-md text-gray-400 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 transition-colors"
            >
              <FileUploadIcon className="h-4 w-4 mr-2" />
              Upload de Arquivo
            </button>
            <button
              type="button"
              onClick={handleFolderUploadClick}
              className="inline-flex items-center px-3 py-1.5 border border-gray-600 text-xs font-medium rounded-md text-gray-400 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 transition-colors"
            >
              <FolderUploadIcon className="h-4 w-4 mr-2" />
              Upload de Pasta
            </button>
          </div>
          <input
            type="file"
            ref={singleFileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <input
            type="file"
            ref={folderInputRef}
            onChange={handleFileChange}
            className="hidden"
            // @ts-ignore
            webkitdirectory="true"
            directory="true"
            multiple
          />
        </div>
        <textarea
          id="code-input"
          value={displayContent}
          readOnly={uploadedFiles.length > 1}
          onChange={handleTextChange}
          placeholder="Faça upload, cole um trecho de código ou carregue de uma URL..."
          className="w-full h-80 p-4 font-mono text-sm bg-gray-800 text-gray-300 border border-gray-700 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 resize-y"
        />
        {uploadWarning && (
          <div className="mt-2 p-3 text-xs text-yellow-300 bg-yellow-900/50 border border-yellow-700/50 rounded-md flex items-start">
            <WarningIcon className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
            <span>{uploadWarning}</span>
          </div>
        )}
      </div>
       <div>
        <label htmlFor="url-input" className="flex items-center text-sm font-medium text-gray-400 mb-2">
          <LinkIcon className="h-4 w-4 mr-2" />
          Carregar de URL(s)
        </label>
        <div className="flex items-start space-x-2">
            <textarea
              id="url-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Cole uma ou mais URLs de arquivos brutos, uma por linha..."
              rows={4}
              className="flex-grow p-3 font-sans text-sm bg-gray-800 text-gray-300 border border-gray-700 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 resize-y"
            />
            <button 
                onClick={handleFetchFromUrl}
                disabled={urlFetchState.loading}
                className="inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
            >
                {urlFetchState.loading ? <Loader size="sm" /> : 'Carregar'}
            </button>
        </div>
        {urlFetchState.error && <p className="mt-2 text-xs text-red-400">{urlFetchState.error}</p>}
      </div>
      <div>
        <label htmlFor="repo-url-input" className="flex items-center text-sm font-medium text-gray-400 mb-2">
            <GitBranchIcon className="h-4 w-4 mr-2" />
            Carregar de repositório Git (GitHub)
        </label>
        <div className="flex items-center space-x-2">
            <input
                type="url"
                id="repo-url-input"
                value={repoUrl}
                onChange={(e) => {
                  setRepoUrl(e.target.value);
                  if (repoFetchState.error || repoFetchState.success) {
                    setRepoFetchState({ loading: false, error: null, success: null, message: null });
                  }
                }}
                placeholder="Ex: https://github.com/usuario/repositorio"
                className="flex-grow p-3 font-sans text-sm bg-gray-800 text-gray-300 border border-gray-700 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
            <button 
                onClick={handleFetchFromRepo}
                disabled={repoFetchState.loading}
                className="inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
            >
                {repoFetchState.loading ? <Loader size="sm" /> : 'Analisar'}
            </button>
        </div>
        <div className="mt-2 text-xs min-h-[16px] transition-all duration-300">
          {repoFetchState.loading && (
              <div className="flex items-center text-gray-500">
                  <Loader size="sm" />
                  <span className="ml-2 truncate">{repoFetchState.message || 'Analisando...'}</span>
              </div>
          )}
          {repoFetchState.error && (
              <p className="text-red-400">{repoFetchState.error}</p>
          )}
          {repoFetchState.success === true && repoFetchState.message && (
              <div className="flex items-center text-green-400">
                  <CheckIcon className="h-4 w-4 mr-1.5" />
                  <span>{repoFetchState.message}</span>
              </div>
          )}
        </div>
      </div>
      <div>
        <label htmlFor="task-input" className="block text-sm font-medium text-gray-400 mb-2">
          Tarefa Adicional (Opcional)
        </label>
        <input
          type="text"
          id="task-input"
          value={additionalTask}
          onChange={(e) => setAdditionalTask(e.target.value)}
          placeholder="Ex: Gere a documentação para este projeto..."
          className="w-full p-3 font-sans text-sm bg-gray-800 text-gray-300 border border-gray-700 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    </div>
  );
};
