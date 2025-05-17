export interface Document {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  caseId?: string;
  storagePath: string;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  extractedText?: string;
}

export interface DocumentUploadProgress {
  filename: string;
  progress: number;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
}

export const getFileIcon = (contentType: string): string => {
  if (contentType.includes('pdf')) {
    return 'pdf';
  } else if (contentType.includes('word') || contentType.includes('docx') || contentType.includes('doc')) {
    return 'word';
  } else if (contentType.includes('spreadsheet') || contentType.includes('excel') || contentType.includes('xlsx') || contentType.includes('xls')) {
    return 'excel';
  } else if (contentType.includes('presentation') || contentType.includes('powerpoint') || contentType.includes('pptx') || contentType.includes('ppt')) {
    return 'powerpoint';
  } else if (contentType.includes('text')) {
    return 'text';
  } else if (contentType.includes('image')) {
    return 'image';
  } else {
    return 'generic';
  }
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Define the comprehensive processing status type
export type ProcessingStatus = 
  | 'uploaded'
  | 'text_extraction_pending'
  | 'text_extracted'
  | 'embedding_pending'
  | 'completed' // This corresponds to 'processed' in the selector
  | 'text_extraction_failed'
  | 'embedding_failed'
  | 'draft';

export interface DocumentMetadata {
  id: string;
  filename: string;
  title?: string;
  caseId: string | null; // Allow null, as per service
  userId: string; // Standardized from ownerId
  uploadDate: string; // Renamed from uploadedAt in service, kept from original type
  fileType: string | null; // Allow null, as per service and original type
  fileSize: number; // Standardized from size
  contentType: string; // Added from service
  processingStatus: ProcessingStatus;
  extractedText?: string | null;
  editedContent?: string | null; // HTML content from editor
  summary?: string | null;
  tags?: string[];
  vectorId?: string; // If using vector embeddings
  storagePath: string | null; // Added from service
  errorMessage?: string | null; // Added from service
  lastAccessedAt?: string | null; // Added from service
  version?: number; // Added from service
  isDeleted: boolean; // Added from service
  // [key: string]: any; // Consider removing if all known props are defined
}

export interface CaseDocument extends DocumentMetadata {
  // Case-specific document properties, if any, can extend DocumentMetadata
}

// You might have other document-related types here
