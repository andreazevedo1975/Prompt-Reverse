import React, { useState, useEffect, useRef } from 'react';
import { ClipboardIcon, CheckIcon, DownloadIcon } from './icons';

type PromptStyle = 'technical' | 'popular' | 'lovable';

interface PromptOutputProps {
  prompt: string;
  promptStyle: PromptStyle;
  setPromptStyle: (style: PromptStyle) => void;
}

export const PromptOutput: React.FC<PromptOutputProps> = ({ prompt, promptStyle, setPromptStyle }) => {
  const [copied, setCopied] = useState(false);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);


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
  }, [prompt]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
        setIsDownloadMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleDownloadPdf = async () => {
    if (!prompt) return;
    const { jsPDF } = await import('jspdf');
    
    const doc = new jsPDF();
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const usableWidth = pageWidth - (margin * 2);
    const lines = doc.splitTextToSize(prompt, usableWidth);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(lines, margin, margin);
    doc.save('prompt.pdf');
    setIsDownloadMenuOpen(false);
  };

  const handleDownloadDocx = async () => {
    if (!prompt) return;
    const { Document, Packer, Paragraph } = await import('docx');
    const { saveAs } = await import('file-saver');

    const doc = new Document({
      sections: [{
        children: prompt.split('\n').map(p => new Paragraph({ text: p })),
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, 'prompt.docx');
    setIsDownloadMenuOpen(false);
  };

  const handleDownloadTxt = async () => {
    if (!prompt) return;
    const { saveAs } = await import('file-saver');
    const blob = new Blob([prompt], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, 'prompt.txt');
    setIsDownloadMenuOpen(false);
  };

  return (
    <div className="relative h-full">
      {prompt ? (
        <>
          <div className="absolute top-4 left-6 z-10">
            <div className="inline-flex rounded-md shadow-sm" role="group">
              <button
                type="button"
                onClick={() => setPromptStyle('technical')}
                className={`px-3 py-2 text-xs font-medium ${promptStyle === 'technical' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'} rounded-l-lg border border-gray-600 focus:z-10 focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors`}
              >
                Técnico
              </button>
              <button
                type="button"
                onClick={() => setPromptStyle('lovable')}
                className={`-ml-px px-3 py-2 text-xs font-medium ${promptStyle === 'lovable' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'} border border-gray-600 focus:z-10 focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors`}
              >
                Lovable, Base44
              </button>
              <button
                type="button"
                onClick={() => setPromptStyle('popular')}
                className={`-ml-px px-3 py-2 text-xs font-medium ${promptStyle === 'popular' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'} rounded-r-md border border-gray-600 focus:z-10 focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors`}
              >
                Popular
              </button>
            </div>
          </div>

          <div className="absolute top-4 right-4 flex items-center space-x-2">
            <button
              onClick={handleCopy}
              disabled={copied}
              className="inline-flex items-center px-3 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors disabled:opacity-75 disabled:cursor-not-allowed"
              aria-label="Copiar prompt"
            >
              {copied ? (
                <>
                  <CheckIcon className="h-4 w-4 mr-1.5 text-green-400" />
                  Copiado!
                </>
              ) : (
                <>
                  <ClipboardIcon className="h-4 w-4 mr-1.5" />
                  Copiar
                </>
              )}
            </button>
            <div className="relative" ref={downloadMenuRef}>
              <button
                onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
                className="p-2 bg-gray-700 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-all"
                aria-label="Opções de download"
              >
                <DownloadIcon className="h-5 w-5 text-gray-400" />
              </button>
              {isDownloadMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-700 border border-gray-600 rounded-md shadow-lg z-10">
                  <ul className="py-1">
                    <li>
                      <button 
                        onClick={handleDownloadTxt}
                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-600"
                      >
                        Download como TXT
                      </button>
                    </li>
                    <li>
                      <button 
                        onClick={handleDownloadDocx}
                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-600"
                      >
                        Download como DOCX
                      </button>
                    </li>
                    <li>
                      <button 
                        onClick={handleDownloadPdf}
                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-600"
                      >
                        Download como PDF
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
          <div className="h-full overflow-y-auto p-6 pt-20">
            <pre className="whitespace-pre-wrap text-sm text-gray-300 font-sans">{prompt}</pre>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-full text-center text-gray-600 p-4">
          <div>
            <h3 className="text-lg font-medium text-gray-500">Aguardando análise...</h3>
            <p className="mt-1 text-sm">O prompt gerado pela IA aparecerá aqui.</p>
          </div>
        </div>
      )}
    </div>
  );
};