
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

  // --- Repo Fetching Logic (GitHub, GitLab, Bitbucket) ---

  const isBlockedExtension = (path: string) => {
    const extension = path.split('.').pop()?.toLowerCase();
    return extension ? BLOCKED_EXTENSIONS.has(extension) : false;
  };

  const fetchGitHub = async (repoPath: string): Promise<UploadedFile[]> => {
    const RATE_LIMIT_ERROR_MESSAGE = "Limite de requisições da API do GitHub atingido. Aguarde ou tente mais tarde.";
    
    setRepoFetchState(prev => ({...prev, message: "Buscando informações do repositório GitHub..."}));
    const repoInfoResponse = await fetch(`https://api.github.com/repos/${repoPath}`);
    if (!repoInfoResponse.ok) {
        if (repoInfoResponse.status === 403) throw new Error(RATE_LIMIT_ERROR_MESSAGE);
        if (repoInfoResponse.status === 404) throw new Error("Repositório não encontrado. Verifique se é público.");
        throw new Error(`Erro GitHub API: ${repoInfoResponse.status}`);
    }
    const repoInfo = await repoInfoResponse.json();
    const defaultBranch = repoInfo.default_branch;

    setRepoFetchState(prev => ({...prev, message: "Mapeando arquivos..."}));
    const treeResponse = await fetch(`https://api.github.com/repos/${repoPath}/git/trees/${defaultBranch}?recursive=1`);
    if (!treeResponse.ok) throw new Error("Falha ao buscar árvore de arquivos.");
    const treeData = await treeResponse.json();

    if (treeData.truncated) console.warn("Árvore de arquivos muito grande (truncada).");

    const filesToFetch = treeData.tree
        .filter((node: any) => node.type === 'blob' && !isBlockedExtension(node.path))
        .filter((node: any) => !/(^|[\/\\])(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/i.test(node.path))
        .slice(0, 60); // Limit files

    const allFiles: UploadedFile[] = [];
    for (let i = 0; i < filesToFetch.length; i++) {
        const file = filesToFetch[i];
        setRepoFetchState(prev => ({...prev, message: `Baixando ${i + 1}/${filesToFetch.length}: ${file.path}` }));
        
        const fileResponse = await fetch(file.url);
        if (!fileResponse.ok) continue;
        const blob = await fileResponse.json();
        if(blob.size > MAX_FILE_SIZE_BYTES) continue;
        
        allFiles.push({ path: file.path, content: base64ToUtf8(blob.content) });
        await new Promise(r => setTimeout(r, 50)); // Throttle
    }
    return allFiles;
  };

  const fetchGitLab = async (repoPath: string): Promise<UploadedFile[]> => {
    // GitLab API requires URL encoded project path (namespace/project)
    const encodedPath = encodeURIComponent(repoPath);
    
    setRepoFetchState(prev => ({...prev, message: "Buscando informações do projeto GitLab..."}));
    
    // 1. Get Project Info for Default Branch
    const projectResponse = await fetch(`https://gitlab.com/api/v4/projects/${encodedPath}`);
    if (!projectResponse.ok) {
        if (projectResponse.status === 404) throw new Error("Projeto GitLab não encontrado ou privado.");
        throw new Error(`Erro GitLab API (Info): ${projectResponse.status}`);
    }
    const projectData = await projectResponse.json();
    const defaultBranch = projectData.default_branch || 'main';

    setRepoFetchState(prev => ({...prev, message: `Buscando árvore de arquivos (${defaultBranch})...`}));
    
    // 2. Get File Tree
    const treeResponse = await fetch(`https://gitlab.com/api/v4/projects/${encodedPath}/repository/tree?recursive=true&per_page=60&ref=${defaultBranch}`);
    if (!treeResponse.ok) {
       throw new Error(`Erro GitLab API (Tree): ${treeResponse.status}`);
    }
    const treeData = await treeResponse.json();
    
    const filesToFetch = treeData
      .filter((node: any) => node.type === 'blob' && !isBlockedExtension(node.path))
      .filter((node: any) => !/(^|[\/\\])(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/i.test(node.path))
      .slice(0, 60);

    const allFiles: UploadedFile[] = [];
    for (let i = 0; i < filesToFetch.length; i++) {
      const file = filesToFetch[i];
      setRepoFetchState(prev => ({...prev, message: `Baixando ${i + 1}/${filesToFetch.length}: ${file.path}` }));
      
      const encodedFilePath = encodeURIComponent(file.path);
      const fileResponse = await fetch(`https://gitlab.com/api/v4/projects/${encodedPath}/repository/files/${encodedFilePath}/raw?ref=${defaultBranch}`);
      
      if (!fileResponse.ok) continue;
      
      const text = await fileResponse.text();
      allFiles.push({ path: file.path, content: text });
      await new Promise(r => setTimeout(r, 50));
    }
    return allFiles;
  };

  const fetchBitbucket = async (repoPath: string): Promise<UploadedFile[]> => {
    // Bitbucket format: workspace/repo_slug
    setRepoFetchState(prev => ({...prev, message: "Conectando ao Bitbucket..."}));
    
    const baseUrl = `https://api.bitbucket.org/2.0/repositories/${repoPath}/src`;
    const allFiles: UploadedFile[] = [];
    
    // Recursive crawler for Bitbucket
    const crawl = async (url: string, depth: number = 0) => {
      if (depth > 4 || allFiles.length >= 40) return; // Safety limits
      
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      
      if (data.values) {
        for (const entry of data.values) {
           if (allFiles.length >= 40) break;
           
           if (entry.type === 'commit_file' && !isBlockedExtension(entry.path)) {
              setRepoFetchState(prev => ({...prev, message: `Baixando: ${entry.path}` }));
              // We use allorigins proxy to bypass potential CORS issues with raw content
              try {
                 const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(entry.links.self.href)}`;
                 const fileRes = await fetch(proxyUrl);
                 if (fileRes.ok) {
                   const content = await fileRes.text();
                   allFiles.push({ path: entry.path, content });
                 }
              } catch (e) { console.warn("Bitbucket file fetch failed", e); }
           } else if (entry.type === 'commit_directory') {
              await crawl(entry.links.self.href, depth + 1);
           }
        }
      }
    };

    // Start crawling from HEAD
    await crawl(`${baseUrl}/HEAD/`);
    if (allFiles.length === 0) throw new Error("Nenhum arquivo acessível encontrado ou erro de CORS no Bitbucket.");
    return allFiles;
  };

  const handleFetchFromRepo = async () => {
    setUploadWarning(null);

    if (!repoUrl) {
        setRepoFetchState({ loading: false, error: "Insira a URL do repositório.", success: false, message: null });
        return;
    }

    setRepoFetchState({ loading: true, error: null, success: null, message: "Identificando provedor..." });

    try {
      let urlObj: URL;
      try {
         urlObj = new URL(repoUrl.startsWith('http') ? repoUrl : `https://${repoUrl}`);
      } catch {
         throw new Error("URL inválida.");
      }
      
      const hostname = urlObj.hostname.toLowerCase();
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      
      if (pathParts.length < 2) throw new Error("URL deve conter usuário/repositório.");
      const repoPath = `${pathParts[0]}/${pathParts[1]}`.replace(/\.git$/, '');

      let fetchedFiles: UploadedFile[] = [];

      if (hostname.includes('github.com')) {
        fetchedFiles = await fetchGitHub(repoPath);
      } else if (hostname.includes('gitlab.com')) {
        fetchedFiles = await fetchGitLab(repoPath);
      } else if (hostname.includes('bitbucket.org')) {
        fetchedFiles = await fetchBitbucket(repoPath);
      } else {
        throw new Error("Provedor não suportado. Use GitHub, GitLab ou Bitbucket.");
      }

      if (fetchedFiles.length === 0) {
        throw new Error("Nenhum arquivo de código válido encontrado.");
      }

      setUploadedFiles(fetchedFiles);
      setRepoUrl('');
      setRepoFetchState({ loading: false, error: null, success: true, message: `${fetchedFiles.length} arquivo(s) importado(s)!` });
      
      setTimeout(() => {
        setRepoFetchState(prev => ({ ...prev, success: null, message: null }));
      }, 4000);

    } catch (error: any) {
        console.error("Repo Fetch Error:", error);
        setRepoFetchState({ loading: false, error: error.message || "Erro ao clonar repositório.", success: false, message: null });
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
            Carregar de Repositório (GitHub, GitLab, Bitbucket)
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
                placeholder="Ex: https://github.com/usuario/repo"
                className="flex-grow p-3 font-sans text-sm bg-gray-800 text-gray-300 border border-gray-700 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
            <button 
                onClick={handleFetchFromRepo}
                disabled={repoFetchState.loading}
                className="inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
            >
                {repoFetchState.loading ? <Loader size="sm" /> : 'Clonar'}
            </button>
        </div>
        <div className="mt-2 text-xs min-h-[16px] transition-all duration-300">
          {repoFetchState.loading && (
              <div className="flex items-center text-gray-500">
                  <Loader size="sm" />
                  <span className="ml-2 truncate">{repoFetchState.message || 'Processando...'}</span>
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
