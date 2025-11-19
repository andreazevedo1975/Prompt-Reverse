
import React, { useState, useEffect, useRef } from 'react';
// Fix: Added SearchIcon to imports
import { ClipboardIcon, CheckIcon, DownloadIcon, HistoryIcon, MagicWandIcon, RefreshIcon, ImageIcon, SpeakerIcon, VideoIcon, SearchIcon } from './icons';
import type { GenerationContext } from '../types';
import { Loader } from './Loader';
import { generateProjectLogo, generateAudioSummary, generateVideoPitch } from '../services/geminiService';

type PromptStyle = 'technical' | 'compact' | 'concise' | 'popular' | 'friendly' | 'lovable' | 'descriptive' | 'base44';

interface PromptOutputProps {
  prompt: string;
  promptStyle: PromptStyle;
  setPromptStyle: (style: PromptStyle) => void;
  history: GenerationContext[];
  onSelectHistory: (context: GenerationContext) => void;
  currentContextId?: string;
  onRefine: (instructions: string) => void;
  isRefining: boolean;
  isRefined: boolean;
  onRevertRefinement: () => void;
  currentContext: GenerationContext | null;
  onUpdateContext: (type: 'logo' | 'audio' | 'video', url: string) => void;
}

export const PromptOutput: React.FC<PromptOutputProps> = ({ 
  prompt, 
  promptStyle, 
  setPromptStyle,
  history,
  onSelectHistory,
  currentContextId,
  onRefine,
  isRefining,
  isRefined,
  onRevertRefinement,
  currentContext,
  onUpdateContext
}) => {
  const [copied, setCopied] = useState(false);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const [isHistoryMenuOpen, setIsHistoryMenuOpen] = useState(false);
  const [isRefineOpen, setIsRefineOpen] = useState(false);
  const [refineInput, setRefineInput] = useState('');
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  
  // Media Loading States
  const [loadingMedia, setLoadingMedia] = useState<{logo: boolean, audio: boolean, video: boolean}>({
      logo: false, audio: false, video: false
  });

  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const historyMenuRef = useRef<HTMLDivElement>(null);
  const refineContainerRef = useRef<HTMLDivElement>(null);

  const handleCopy = () => {
    if (prompt) {
      navigator.clipboard.writeText(prompt);
      setCopied(true);
    }
  };

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);
  
  useEffect(() => {
    setCopied(false);
    setIsDownloadMenuOpen(false);
    setIsRefineOpen(false);
    setRefineInput('');
  }, [prompt]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
        setIsDownloadMenuOpen(false);
      }
      if (historyMenuRef.current && !historyMenuRef.current.contains(event.target as Node)) {
        setIsHistoryMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleHistorySelect = (item: GenerationContext) => {
    onSelectHistory(item);
    setIsHistoryMenuOpen(false);
  };

  const handleRefineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (refineInput.trim()) {
        onRefine(refineInput);
    }
  };

  // Creative Tools Handlers
  const handleGenerateLogo = async () => {
      if (!currentContext) return;
      setLoadingMedia(prev => ({ ...prev, logo: true }));
      try {
          const description = `${currentContext.analysis.mainObjective} built with ${currentContext.analysis.languageFramework}`;
          const url = await generateProjectLogo(description);
          onUpdateContext('logo', url);
      } catch (e: any) {
          alert(e.message);
      } finally {
          setLoadingMedia(prev => ({ ...prev, logo: false }));
      }
  };

  const handleGenerateAudio = async () => {
      if (!currentContext) return;
      setLoadingMedia(prev => ({ ...prev, audio: true }));
      try {
          const summary = `${currentContext.analysis.mainObjective}. ${currentContext.analysis.technicalPurpose}`;
          const url = await generateAudioSummary(summary);
          onUpdateContext('audio', url);
      } catch (e: any) {
          alert(e.message);
      } finally {
          setLoadingMedia(prev => ({ ...prev, audio: false }));
      }
  };

  const handleGenerateVideo = async () => {
      if (!currentContext) return;
      setLoadingMedia(prev => ({ ...prev, video: true }));
      try {
          const description = currentContext.analysis.mainObjective;
          const url = await generateVideoPitch(description);
          onUpdateContext('video', url);
      } catch (e: any) {
          alert(e.message);
      } finally {
          setLoadingMedia(prev => ({ ...prev, video: false }));
      }
  };


  // Downloads
  const handleDownloadPdf = async () => {
    if (!prompt) return;
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const margin = 15;
      const pageWidth = doc.internal.pageSize.getWidth();
      const usableWidth = pageWidth - (margin * 2);
      const lines = doc.splitTextToSize(prompt, usableWidth);

      doc.setFont('Courier', 'normal');
      doc.setFontSize(10);
      doc.text(lines, margin, margin);
      doc.save('prompt.pdf');
      setIsDownloadMenuOpen(false);
    } catch (e) {
      console.error("Failed to generate PDF", e);
    }
  };

  const handleDownloadDocx = async () => {
    if (!prompt) return;
    setIsGeneratingDoc(true);
    try {
      const { Document, Packer, Paragraph, TextRun } = await import('docx');
      const { saveAs } = await import('file-saver');
      const doc = new Document({
        sections: [{
          properties: {},
          children: prompt.split(/\r?\n/).map(line => 
            new Paragraph({
              children: [
                new TextRun({
                  text: line,
                  font: "Courier New",
                  size: 22, 
                })
              ]
            })
          ),
        }],
      });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, 'prompt.docx');
      setIsDownloadMenuOpen(false);
    } catch (e) {
      console.error("Failed to generate DOCX", e);
      alert("Erro ao gerar o arquivo DOCX.");
    } finally {
      setIsGeneratingDoc(false);
    }
  };

  const handleDownloadTxt = async () => {
    if (!prompt) return;
    try {
      const { saveAs } = await import('file-saver');
      const blob = new Blob([prompt], { type: 'text/plain;charset=utf-8' });
      saveAs(blob, 'prompt.txt');
      setIsDownloadMenuOpen(false);
    } catch (e) {
      console.error("Failed to generate TXT", e);
    }
  };

  return (
    <div className="relative h-full flex flex-col">
      {prompt ? (
        <>
          <div className="flex flex-col bg-gray-800 rounded-t-lg z-20 border-b border-gray-700">
             <div className="flex flex-wrap items-center justify-between p-4 gap-2">
                <div className="inline-flex rounded-md shadow-sm overflow-x-auto max-w-[40vw] sm:max-w-none hide-scrollbar" role="group">
                  <button type="button" onClick={() => setPromptStyle('technical')} className={`px-3 py-2 text-xs font-medium ${promptStyle === 'technical' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'} rounded-l-lg border border-gray-600 transition-colors whitespace-nowrap`}>Técnico</button>
                  <button type="button" onClick={() => setPromptStyle('compact')} className={`-ml-px px-3 py-2 text-xs font-medium ${promptStyle === 'compact' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'} border border-gray-600 transition-colors whitespace-nowrap`}>Compacto</button>
                  <button type="button" onClick={() => setPromptStyle('concise')} className={`-ml-px px-3 py-2 text-xs font-medium ${promptStyle === 'concise' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'} border border-gray-600 transition-colors whitespace-nowrap`}>Conciso</button>
                  <button type="button" onClick={() => setPromptStyle('popular')} className={`-ml-px px-3 py-2 text-xs font-medium ${promptStyle === 'popular' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'} border border-gray-600 transition-colors whitespace-nowrap`}>Popular</button>
                  <button type="button" onClick={() => setPromptStyle('friendly')} className={`-ml-px px-3 py-2 text-xs font-medium ${promptStyle === 'friendly' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'} border border-gray-600 transition-colors whitespace-nowrap`}>Amigável</button>
                  <button type="button" onClick={() => setPromptStyle('descriptive')} className={`-ml-px px-3 py-2 text-xs font-medium ${promptStyle === 'descriptive' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'} border border-gray-600 transition-colors whitespace-nowrap`}>Não Técnico</button>
                  <button type="button" onClick={() => setPromptStyle('lovable')} className={`-ml-px px-3 py-2 text-xs font-medium ${promptStyle === 'lovable' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'} border border-gray-600 transition-colors whitespace-nowrap`}>Lovable</button>
                  <button type="button" onClick={() => setPromptStyle('base44')} className={`-ml-px px-3 py-2 text-xs font-medium ${promptStyle === 'base44' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'} rounded-r-md border border-gray-600 transition-colors whitespace-nowrap`}>Base 44</button>
                </div>

                <div className="flex items-center space-x-2 ml-auto">
                  {isRefined && (
                     <button onClick={onRevertRefinement} className="p-2 bg-gray-700 rounded-md hover:bg-gray-600 text-yellow-400 transition-all" title="Reverter refinamento"><RefreshIcon className="h-5 w-5" /></button>
                  )}
                  
                  <button onClick={() => setIsRefineOpen(!isRefineOpen)} className={`p-2 rounded-md hover:bg-gray-600 transition-all ${isRefineOpen || isRefined ? 'bg-purple-900/50 text-purple-300' : 'bg-gray-700 text-gray-400'}`} title="Refinar prompt com IA"><MagicWandIcon className="h-5 w-5" /></button>
                  
                  <div className="relative" ref={historyMenuRef}>
                    <button onClick={() => setIsHistoryMenuOpen(!isHistoryMenuOpen)} className="p-2 bg-gray-700 rounded-md hover:bg-gray-600 transition-all"><HistoryIcon className="h-5 w-5 text-gray-400" /></button>
                    {isHistoryMenuOpen && (
                      <div className="absolute right-0 mt-2 w-72 bg-gray-800 border border-gray-700 rounded-md shadow-xl z-30 overflow-hidden">
                         <div className="px-4 py-2 bg-gray-900 border-b border-gray-700">
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Histórico</h3>
                         </div>
                         <ul className="max-h-64 overflow-y-auto">
                            {history.length === 0 ? (
                               <li className="px-4 py-3 text-sm text-gray-500 text-center">Nenhum histórico</li>
                            ) : (
                               history.map((item) => (
                                 <li key={item.id}>
                                   <button onClick={() => handleHistorySelect(item)} className={`w-full text-left px-4 py-3 hover:bg-gray-700 border-b border-gray-700/50 last:border-0 transition-colors ${currentContextId === item.id ? 'bg-gray-700/50 border-l-2 border-l-blue-500' : ''}`}>
                                     <div className="flex justify-between items-baseline mb-1"><span className="text-xs text-blue-400 font-medium truncate max-w-[120px]">{item.analysis.languageFramework}</span></div>
                                     <p className="text-sm text-gray-300 line-clamp-1">{item.analysis.mainObjective}</p>
                                   </button>
                                 </li>
                               ))
                            )}
                         </ul>
                      </div>
                    )}
                  </div>
                  <button onClick={handleCopy} disabled={copied} className="inline-flex items-center px-3 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-75">{copied ? <CheckIcon className="h-4 w-4 mr-1.5 text-green-400" /> : <ClipboardIcon className="h-4 w-4 mr-1.5" />}{copied ? 'Copiado!' : 'Copiar'}</button>
                  <div className="relative" ref={downloadMenuRef}>
                    <button onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)} className="p-2 bg-gray-700 rounded-md hover:bg-gray-600 transition-all"><DownloadIcon className="h-5 w-5 text-gray-400" /></button>
                    {isDownloadMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-gray-700 border border-gray-600 rounded-md shadow-lg z-30">
                        <ul className="py-1">
                          <li><button onClick={handleDownloadTxt} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-600">TXT</button></li>
                          <li><button onClick={handleDownloadDocx} disabled={isGeneratingDoc} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 flex items-center justify-between"><span>DOCX</span>{isGeneratingDoc && <Loader size="sm" />}</button></li>
                          <li><button onClick={handleDownloadPdf} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-600">PDF</button></li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
             </div>
             
             {isRefineOpen && (
                <div className="p-4 bg-gray-900 border-t border-gray-700 border-b animate-fade-in-down" ref={refineContainerRef}>
                    <form onSubmit={handleRefineSubmit} className="flex items-start space-x-3">
                        <div className="flex-grow">
                            <input type="text" value={refineInput} onChange={(e) => setRefineInput(e.target.value)} placeholder="Feedback para refinar..." className="w-full p-2 text-sm bg-gray-800 border border-gray-600 rounded-md text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none" disabled={isRefining} />
                        </div>
                        <button type="submit" disabled={isRefining || !refineInput.trim()} className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-500 disabled:opacity-50 transition-colors flex items-center">{isRefining ? <Loader size="sm" /> : 'Refinar'}</button>
                    </form>
                </div>
             )}
          </div>

          <div className="flex-1 overflow-y-auto p-6 relative">
            {currentContext?.analysis.groundingLinks && currentContext.analysis.groundingLinks.length > 0 && (
                <div className="mb-6 p-4 bg-blue-900/20 border border-blue-700/30 rounded-md">
                    <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wide mb-2 flex items-center">
                        <SearchIcon className="w-3 h-3 mr-1"/> Fontes Verificadas (Google)
                    </h4>
                    <ul className="space-y-1">
                        {currentContext.analysis.groundingLinks.map((link, i) => (
                            <li key={i}>
                                <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-300 hover:underline hover:text-blue-200 truncate block">
                                    {link.title}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            
            {isRefined && <div className="absolute top-2 right-6"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 opacity-80">✨ Prompt Refinado</span></div>}
            
            <pre className="whitespace-pre-wrap text-sm text-gray-300 font-sans">{prompt}</pre>
          </div>

          {/* Creative Studio Section */}
          <div className="border-t border-gray-700 bg-gray-900/50 p-4">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Estúdio Criativo</h4>
            <div className="grid grid-cols-3 gap-4">
                 {/* Logo Generator */}
                 <div className="bg-gray-800 p-3 rounded-md border border-gray-700 flex flex-col items-center">
                     <div className="mb-2 h-20 w-full bg-gray-900 rounded flex items-center justify-center overflow-hidden">
                         {currentContext?.generatedLogoUrl ? (
                             <img src={currentContext.generatedLogoUrl} alt="Generated Logo" className="h-full w-full object-contain" />
                         ) : (
                             <ImageIcon className="h-8 w-8 text-gray-600" />
                         )}
                     </div>
                     <button 
                        onClick={handleGenerateLogo}
                        disabled={loadingMedia.logo || !!currentContext?.generatedLogoUrl}
                        className="w-full px-3 py-1.5 text-xs font-medium text-white bg-pink-600 hover:bg-pink-500 rounded transition-colors disabled:opacity-50 flex justify-center"
                     >
                         {loadingMedia.logo ? <Loader size="sm" /> : (currentContext?.generatedLogoUrl ? 'Logo Gerado' : 'Gerar Logo (Imagen)')}
                     </button>
                 </div>

                 {/* Audio Summary */}
                 <div className="bg-gray-800 p-3 rounded-md border border-gray-700 flex flex-col items-center">
                      <div className="mb-2 h-20 w-full bg-gray-900 rounded flex items-center justify-center">
                         {currentContext?.generatedAudioUrl ? (
                             <audio controls src={currentContext.generatedAudioUrl} className="w-full h-8" />
                         ) : (
                             <SpeakerIcon className="h-8 w-8 text-gray-600" />
                         )}
                     </div>
                     <button 
                        onClick={handleGenerateAudio}
                        disabled={loadingMedia.audio || !!currentContext?.generatedAudioUrl}
                        className="w-full px-3 py-1.5 text-xs font-medium text-white bg-teal-600 hover:bg-teal-500 rounded transition-colors disabled:opacity-50 flex justify-center"
                     >
                         {loadingMedia.audio ? <Loader size="sm" /> : (currentContext?.generatedAudioUrl ? 'Áudio Pronto' : 'Ouvir Resumo (TTS)')}
                     </button>
                 </div>
                 
                 {/* Video Pitch */}
                 <div className="bg-gray-800 p-3 rounded-md border border-gray-700 flex flex-col items-center">
                      <div className="mb-2 h-20 w-full bg-gray-900 rounded flex items-center justify-center overflow-hidden relative group">
                         {currentContext?.generatedVideoUrl ? (
                             <video controls src={currentContext.generatedVideoUrl} className="h-full w-full object-cover" />
                         ) : (
                             <VideoIcon className="h-8 w-8 text-gray-600" />
                         )}
                     </div>
                     <button 
                        onClick={handleGenerateVideo}
                        disabled={loadingMedia.video || !!currentContext?.generatedVideoUrl}
                        className="w-full px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded transition-colors disabled:opacity-50 flex justify-center"
                     >
                         {loadingMedia.video ? <Loader size="sm" /> : (currentContext?.generatedVideoUrl ? 'Vídeo Gerado' : 'Vídeo Conceito (Veo)')}
                     </button>
                 </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-full text-center text-gray-600 p-4">
          <div>
            <h3 className="text-lg font-medium text-gray-500">Aguardando análise...</h3>
            <p className="mt-1 text-sm">Use as opções avançadas para análises profundas.</p>
          </div>
        </div>
      )}
    </div>
  );
};
