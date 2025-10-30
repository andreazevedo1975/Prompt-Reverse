export interface AnalysisResult {
  role: string;
  languageFramework: string;
  mainObjective: string;
  technicalPurpose: string;
  keyFeatures: string[];
  structureClasses: string[];
  structureFunctions: string[];
  dependencies: string[];
}

export interface UploadedFile {
  path: string;
  content: string;
}
