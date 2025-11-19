
export interface AnalysisResult {
  role: string;
  languageFramework: string;
  mainObjective: string;
  technicalPurpose: string;
  keyFeatures: string[];
  structureClasses: string[];
  structureFunctions: string[];
  dependencies: string[];
  groundingLinks?: { title: string; url: string }[];
}

export interface UploadedFile {
  path: string;
  content: string;
}

export interface GenerationContext {
  id: string;
  analysis: AnalysisResult;
  code: string;
  task: string;
  timestamp: number;
  generatedLogoUrl?: string;
  generatedAudioUrl?: string;
  generatedVideoUrl?: string;
}
