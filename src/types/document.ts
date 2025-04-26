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
