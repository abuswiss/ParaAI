"use client"; // If using Next.js App Router or similar client-side features

import React, { useState, useCallback, ChangeEvent } from 'react';
import { useAtomValue } from 'jotai';
import { activeCaseIdAtom } from '@/atoms/appAtoms';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Spinner } from '@/components/ui/Spinner';
import { Icons } from '@/components/ui/Icons';
import { uploadAndProcessDocument } from '@/services/documentService'; // Import the service function
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/Dialog'; // Assuming Dialog exists

interface UploadModalProps {
  isOpen: boolean;
  onClose: (refreshNeeded?: boolean) => void;
}

interface UploadFileStatus {
    file: File;
    status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
    progress?: number; // 0-100 for uploading
    error?: string;
}

const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose }) => {
  const [filesToUpload, setFilesToUpload] = useState<UploadFileStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [overallError, setOverallError] = useState<string | null>(null);
  
  // Get active case ID to pre-select or associate
  const activeCaseId = useAtomValue(activeCaseIdAtom);
  // TODO: Add state/select input if user needs to choose a different case

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files).map(file => ({
          file,
          status: 'pending'
      } as UploadFileStatus));
      setFilesToUpload(prev => [...prev, ...newFiles]);
      setOverallError(null); // Clear previous errors on new selection
    }
  };

  // Placeholder for drag and drop
  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.files) {
        const newFiles = Array.from(event.dataTransfer.files).map(file => ({
            file,
            status: 'pending'
        } as UploadFileStatus));
         setFilesToUpload(prev => [...prev, ...newFiles]);
         setOverallError(null);
    }
    // TODO: Add visual feedback for drag over
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const removeFile = (index: number) => {
    setFilesToUpload(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    const pendingFiles = filesToUpload.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) {
      setOverallError("No pending files selected for upload.");
      return;
    }
    
    setIsUploading(true);
    setOverallError(null);
    let refreshNeeded = false;
    let uploadErrors = 0;

    // Process each pending file
    for (let i = 0; i < filesToUpload.length; i++) {
        const currentFileStatus = filesToUpload[i];
        if (currentFileStatus.status !== 'pending') continue; // Skip already processed or processing files

        try {
            // Update status in UI immediately
            setFilesToUpload(prev => 
                prev.map((f, idx) => idx === i ? { ...f, status: 'uploading' } : f)
            );

            // Call the actual service function
            // Note: Progress reporting is not implemented in the service yet
            const { data: uploadResult, error: uploadError } = await uploadAndProcessDocument(
                currentFileStatus.file, 
                activeCaseId // Pass active case ID
            );

            if (uploadError || !uploadResult) {
                throw uploadError || new Error('Upload failed to return document info.');
            }

            // Update status to 'processing' (as processing is triggered in background)
            setFilesToUpload(prev => 
                prev.map((f, idx) => idx === i ? { ...f, status: 'processing' } : f)
            );
            refreshNeeded = true; // Indicate that the document list might need refresh

        } catch (error) {
            console.error(`Error uploading ${currentFileStatus.file.name}:`, error);
            uploadErrors++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
            // Update status to 'error' in UI
             setFilesToUpload(prev => 
                prev.map((f, idx) => idx === i ? { ...f, status: 'error', error: errorMessage } : f)
            );
        }
    }

    setIsUploading(false);

    if (uploadErrors > 0) {
         setOverallError(`${uploadErrors} file(s) failed to upload. Please check individual file statuses.`);
    } else {
        // Optionally close modal automatically on full success after a short delay
        // alert("All files uploaded successfully! Processing started.");
        // setTimeout(() => onClose(refreshNeeded), 1000);
        // For now, keep it open to show status:
         alert("Uploads initiated! Files are now processing.");
    }
    // Note: We don't set status to 'completed' here, as processing is background.
    // The UI might need a polling mechanism or websocket connection to get final status updates,
    // or the user refreshes the document list later.
  };

  const handleClose = () => {
      if (isUploading) return; // Prevent closing during upload
      // Reset state on close
      setFilesToUpload([]);
      setOverallError(null);
      setIsUploading(false);
      onClose(); // Call parent close handler
  }

  if (!isOpen) return null;

  // Basic Modal Structure - Replace with actual Dialog if available
  const pendingFileCount = filesToUpload.filter(f => f.status === 'pending').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="relative z-50 w-full max-w-2xl bg-surface rounded-lg shadow-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-text-primary">Upload Documents</h3>
          <Button variant="ghost" size="sm" onClick={handleClose} className="-mr-2" disabled={isUploading}>
            <Icons.Close className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        {overallError && (
            <div className="mb-4 text-sm text-red-500 bg-red-100 dark:bg-red-900/20 p-3 rounded-md border border-red-300 dark:border-red-600">
                {overallError}
            </div>
        )}

        {/* Drag and Drop Area / File Input */}
        <div 
          className="mb-4 p-6 border-2 border-dashed border-border rounded-lg text-center cursor-pointer hover:border-primary transition-colors bg-background/50"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => document.getElementById('file-upload-input')?.click()} // Trigger hidden input
        >
           <input 
              id="file-upload-input" 
              type="file" 
              multiple 
              onChange={handleFileChange} 
              className="hidden" 
              accept=".pdf,.doc,.docx,.txt,.md" // Specify acceptable file types
              disabled={isUploading}
            />
            <Icons.Upload className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Drag & drop files here, or click to select files
            </p>
             <p className="text-xs text-muted-foreground/80 mt-1">
                (PDF, DOC, DOCX, TXT, MD supported)
             </p>
        </div>

        {/* File List */} 
        <div className="mb-4 max-h-60 overflow-y-auto space-y-2 pr-2">
            {filesToUpload.map((fileStatus, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <div className="flex items-center space-x-2 overflow-hidden">
                         <Icons.FileTextIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground"/>
                        <span className="text-sm text-text-primary truncate" title={fileStatus.file.name}>
                            {fileStatus.file.name}
                        </span>
                         <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                            ({(fileStatus.file.size / 1024).toFixed(1)} KB)
                         </span>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                         {/* Status Indicator */} 
                         {fileStatus.status === 'pending' && <span className="text-xs text-muted-foreground italic">Pending</span>}
                         {fileStatus.status === 'uploading' && <Spinner size="xs" />}
                         {fileStatus.status === 'processing' && <span className="text-xs text-blue-500">Processing...</span>}
                         {fileStatus.status === 'completed' && <Icons.Check className="h-4 w-4 text-green-500"/>}
                         {fileStatus.status === 'error' && <Icons.Alert className="h-4 w-4 text-red-500" title={fileStatus.error}/>}

                        <Button variant="ghost" size="icon_sm" onClick={() => removeFile(index)} disabled={isUploading} className="text-muted-foreground hover:text-destructive">
                            <Icons.Close className="h-3 w-3" />
                            <span className="sr-only">Remove</span>
                        </Button>
                    </div>
                </div>
            ))}
        </div>

        {/* TODO: Add Case Selection Dropdown if needed */} 
        {activeCaseId && (
             <p className="text-xs text-muted-foreground mb-4">Uploading to case: {activeCaseId}</p>
         )}
         {!activeCaseId && (
             <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-4">Warning: No active case selected. Documents will be uploaded without case association.</p>
         )}

        {/* Footer Actions */} 
        <div className="flex justify-end space-x-3 pt-4 border-t border-border mt-2">
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>Cancel</Button>
          <Button 
            onClick={handleUpload} 
            disabled={isUploading || pendingFileCount === 0} // Disable if uploading or no pending files
            >
            {isUploading ? <Spinner size="sm" className="mr-2" /> : <Icons.Upload className="mr-2 h-4 w-4" />}
            {isUploading ? 'Uploading...' : `Upload ${pendingFileCount} File(s)`}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UploadModal; 