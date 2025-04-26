import React, { useState, useRef } from 'react';
import { uploadDocument } from '../../services/documentService';
import { DocumentUploadProgress } from '../../types/document';
import { useAuth } from '../../context/AuthContext';

interface DocumentUploadProps {
  caseId?: string;
  onUploadComplete?: (success: boolean) => void;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({ 
  caseId,
  onUploadComplete 
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<DocumentUploadProgress[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (files: FileList) => {
    const newUploadingFiles: DocumentUploadProgress[] = Array.from(files).map(file => ({
      filename: file.name,
      progress: 0,
      status: 'uploading'
    }));
    
    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);
    
    Array.from(files).forEach((file, index) => {
      uploadFile(file, newUploadingFiles.length > 1 ? index : 0);
    });
  };

  const uploadFile = async (file: File, index: number) => {
    try {
      // Make sure we have a user
      if (!user || !user.id) {
        throw new Error('You must be logged in to upload documents');
      }

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadingFiles(prev => {
          const newState = [...prev];
          if (newState[index] && newState[index].progress < 90) {
            newState[index] = {
              ...newState[index],
              progress: newState[index].progress + 10
            };
          }
          return newState;
        });
      }, 300);

      // Upload the file with the correct parameters: file, userId, caseId
      try {
        await uploadDocument(file, user.id, caseId);
        clearInterval(progressInterval);
      } catch (error) {
        clearInterval(progressInterval);
        console.error('Error uploading file:', error);
        throw error;
      }
      
      // Update with success
      setUploadingFiles(prev => {
        const newState = [...prev];
        newState[index] = {
          ...newState[index],
          progress: 100,
          status: 'complete'
        };
        return newState;
      });
      
      if (onUploadComplete) {
        onUploadComplete(true);
      }
      
      // Clear the upload list after a delay
      setTimeout(() => {
        setUploadingFiles(prev => prev.filter((_, i) => i !== index));
      }, 2000);
      
    } catch (err) {
      console.error('Error uploading file:', err);
      
      // Update with error
      setUploadingFiles(prev => {
        const newState = [...prev];
        newState[index] = {
          ...newState[index],
          progress: 0,
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed to upload file'
        };
        return newState;
      });
      
      if (onUploadComplete) {
        onUploadComplete(false);
      }
    }
  };

  const openFileSelector = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="w-full">
      <div 
        className={`
          border-2 border-dashed rounded-lg p-8 text-center
          ${dragActive 
            ? 'border-primary bg-primary/10' 
            : 'border-gray-700 hover:border-gray-600'
          }
          transition-colors duration-200
        `}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          className="hidden" 
          multiple 
          onChange={handleChange}
        />
        
        <div className="flex flex-col items-center justify-center">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={`h-12 w-12 mb-4 ${dragActive ? 'text-primary' : 'text-gray-500'}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
            />
          </svg>
          
          <p className="mb-2 text-text-primary font-medium">
            {dragActive 
              ? 'Drop your files here' 
              : 'Drag & drop your files here'
            }
          </p>
          
          <p className="mb-4 text-sm text-text-secondary">
            or <button 
                 type="button" 
                 className="text-primary hover:underline" 
                 onClick={openFileSelector}
               >
                 browse files
               </button>
          </p>
          
          <p className="text-xs text-text-secondary">
            Supported formats: PDF, DOCX, TXT, RTF
          </p>
        </div>
      </div>
      
      {/* Upload progress */}
      {uploadingFiles.length > 0 && (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-text-primary mb-2">
            {uploadingFiles.some(f => f.status === 'uploading') 
              ? 'Uploading files...' 
              : 'Upload complete'
            }
          </p>
          
          {uploadingFiles.map((file, index) => (
            <div key={index} className="bg-gray-800 rounded-md p-3">
              <div className="flex justify-between items-center mb-1">
                <p className="text-sm text-text-primary truncate">{file.filename}</p>
                <span className="text-xs text-text-secondary">
                  {file.status === 'complete' 
                    ? 'Complete' 
                    : file.status === 'error' 
                      ? 'Error' 
                      : `${file.progress}%`
                  }
                </span>
              </div>
              
              <div className="w-full bg-gray-700 rounded-full h-1.5">
                <div 
                  className={`h-1.5 rounded-full ${
                    file.status === 'error' 
                      ? 'bg-red-500' 
                      : 'bg-primary'
                  }`}
                  style={{ width: `${file.progress}%` }}
                />
              </div>
              
              {file.status === 'error' && (
                <p className="mt-1 text-xs text-red-400">{file.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;
