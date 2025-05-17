"use client"; // If using Next.js App Router or similar client-side features

import React, { useState, useCallback, ChangeEvent, useEffect, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { activeCaseIdAtom, addTaskAtom, updateTaskAtom, removeTaskAtom, initialFilesForUploadAtom, activeEditorItemAtom, chatDocumentContextIdsAtom } from '@/atoms/appAtoms';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Spinner } from '@/components/ui/Spinner';
import { Icons } from '@/components/ui/Icons';
import { uploadAndProcessDocument } from '@/services/documentService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogTrigger, // Keep trigger if needed outside modal, but here controlled by isOpen prop
  DialogDescription // Optional for adding more text
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/Badge'; // For status display
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { useToast } from "@/hooks/use-toast";
import { Clock, FileText, XCircle, CheckCircle, AlertTriangle } from 'lucide-react'; // Added for processing icon
import { Progress } from '@/components/ui/progress'; // Import Progress
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';

interface UploadModalProps {
  isOpen: boolean;
  onClose: (refreshNeeded?: boolean) => void;
}

interface UploadFileStatus {
    file: File;
    status: 'pending' | 'uploading' | 'processing_started' | 'error' | 'complete';
    taskId?: string;
    error?: string;
    progress?: number; // Add progress field
}

const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose }) => {
  const [filesToUpload, setFilesToUpload] = useState<UploadFileStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [overallError, setOverallError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [modalPhase, setModalPhase] = useState<'idle' | 'uploading' | 'success'>('idle');
  const activeChannelsRef = useRef<any[]>([]);
  
  const activeCaseId = useAtomValue(activeCaseIdAtom);
  const [initialFiles, setInitialFiles] = useAtom(initialFilesForUploadAtom);
  const addTask = useSetAtom(addTaskAtom);
  const updateTask = useSetAtom(updateTaskAtom);
  const removeTask = useSetAtom(removeTaskAtom);
  const setActiveEditorItem = useSetAtom(activeEditorItemAtom);
  const setChatDocumentContextIds = useSetAtom(chatDocumentContextIdsAtom);
  const { toast } = useToast();

  // Reset state and handle initial files when modal is opened
  useEffect(() => {
    if (isOpen) {
        setFilesToUpload([]);
        setOverallError(null);
        setIsUploading(false);
        setDragActive(false);
        setModalPhase('idle');
        if (initialFiles.length > 0) {
            const newFileStatuses = initialFiles.map(file => ({ file, status: 'pending' } as UploadFileStatus));
            setFilesToUpload(newFileStatuses);
            setInitialFiles([]); 
        }
    } else {
        setFilesToUpload([]);
        setOverallError(null);
        if (initialFiles.length > 0) {
             setInitialFiles([]);
        }
    }
  }, [isOpen, initialFiles, setInitialFiles]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files).map(file => ({
          file,
          status: 'pending'
      } as UploadFileStatus));
      setFilesToUpload(prev => [...prev, ...newFiles]);
      setOverallError(null); // Clear previous errors on new selection
      event.target.value = ''; // Allow selecting the same file again
    }
  };

  // Drag and Drop Handlers
  const handleDrag = useCallback((event: React.DragEvent<HTMLDivElement | HTMLFormElement>, type: 'enter' | 'leave' | 'over' | 'drop') => {
    event.preventDefault();
    event.stopPropagation();
    if (type === 'enter' || type === 'over') {
        setDragActive(true);
    } else if (type === 'leave') {
        setDragActive(false);
    } else if (type === 'drop') {
        setDragActive(false);
        if (event.dataTransfer.files) {
            const newFiles = Array.from(event.dataTransfer.files).map(file => ({
                file,
                status: 'pending'
            } as UploadFileStatus));
            setFilesToUpload(prev => [...prev, ...newFiles]);
            setOverallError(null);
        }
    }
  }, []);

  const removeFile = (index: number) => {
    setFilesToUpload(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    setModalPhase('uploading');
    const pendingFiles = filesToUpload.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) {
      setOverallError("No pending files selected for upload.");
      return;
    }
    if (!activeCaseId) {
        setOverallError("Cannot upload: No case is currently active.");
        return;
    }
    setIsUploading(true);
    setOverallError(null);
    let refreshNeeded = false;
    let uploadErrors = 0;
    let firstSuccessfulUploadId: string | null = null;

    // --- Upload files sequentially --- 
    for (let i = 0; i < filesToUpload.length; i++) {
        const currentFileStatus = filesToUpload[i];
        // Find the index in the current state array in case it shifted
        const currentIndex = filesToUpload.findIndex(f => f.file === currentFileStatus.file && f.status === 'pending');
        if (currentIndex === -1) continue; // Skip if not pending anymore

        const taskId = uuidv4();
        addTask({ 
            id: taskId, 
            name: `Uploading ${currentFileStatus.file.name}...`, // Use name field
            status: 'processing', // Use processing consistently?
            progress: 0
        });

        // Update state immutably for the specific file being processed
        setFilesToUpload(prev => 
            prev.map((f, idx) => 
                idx === currentIndex ? { ...f, status: 'uploading', taskId: taskId, progress: 0 } : f
            )
        );

        try {
            // Simulate initial progress update
            setFilesToUpload(prev =>
                prev.map((f, idx) =>
                    idx === currentIndex ? { ...f, progress: 10 } : f
                )
            );
            updateTask({ id: taskId, delta: { progress: 10 } }); // Update global task too

            const { data: uploadResult, error: uploadError } = await uploadAndProcessDocument(currentFileStatus.file, activeCaseId);
            
            if (uploadError || !uploadResult?.id) { // Check for uploadResult.id
                throw uploadError || new Error('Upload initiation failed or did not return an ID.');
            }
            
            // *** Set active context for the FIRST successfully initiated upload ***
            if (!firstSuccessfulUploadId) {
                firstSuccessfulUploadId = uploadResult.id;
                setActiveEditorItem({ type: 'document', id: uploadResult.id });
                console.log(`UploadModal: Set active editor item to first uploaded doc: ${uploadResult.id}`);
            }

            // Add uploaded document to chat context (if not already present)
            setChatDocumentContextIds(prev => prev.includes(uploadResult.id) ? prev : [...prev, uploadResult.id]);

            // Update task status upon successful initiation (backend handles rest)
            updateTask({ 
                id: taskId, 
                delta: {
                    status: 'completed', // Mark task complete once backend accepts it
                    progress: 100, 
                    name: `${currentFileStatus.file.name}: Processing started...`
                }
            });
            setFilesToUpload(prev => 
                prev.map((f, idx) => 
                    idx === currentIndex ? { ...f, status: 'processing_started', progress: 100 } : f
                )
            );
            refreshNeeded = true;

            // Updated toast message
            toast({
                title: "Upload Successful",
                description: `Document "${currentFileStatus.file.name}" is processing.`,
            });

            // Auto-remove task from status bar after a delay
            setTimeout(() => removeTask(taskId), 5000);

        } catch (error) {
            console.error(`Error uploading ${currentFileStatus.file.name}:`, error);
            uploadErrors++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
            
            if (taskId) {
                 updateTask({ 
                     id: taskId, 
                     delta: { 
                         status: 'failed', 
                         name: `Error: ${currentFileStatus.file.name}`, 
                         error: errorMessage 
                    }
                });
                 // Keep error task visible longer
                 setTimeout(() => removeTask(taskId), 20000); 
            }

            setFilesToUpload(prev => 
                prev.map((f, idx) => 
                    idx === currentIndex ? { ...f, status: 'error', error: errorMessage, progress: undefined } : f // Clear progress on error
                )
            );
        }
    } // End of sequential loop

    setIsUploading(false);
    if (uploadErrors === filesToUpload.filter(f => f.status !== 'processing_started').length && filesToUpload.length > 0) { // Check against non-processed files
        setOverallError(`All ${uploadErrors} file(s) failed to upload.`);
    } else if (uploadErrors > 0) {
        setOverallError(`${uploadErrors} file(s) failed to upload. Others initiated processing.`);
        // Don't close automatically if some failed
    } else if (refreshNeeded) {
        // Close modal automatically if all uploads initiated successfully
        onClose(true); // Signal refresh needed
    } else {
        // Handle case where no files were actually processed (e.g., all skipped)
        onClose(false);
    }
  };

  // Controlled close from Dialog component
  const handleOpenChange = (open: boolean) => {
      if (!open && !isUploading) { // Only allow close if not uploading
          onClose(); // Call original onClose
          setFilesToUpload([]); // Explicitly clear files when closing via X/overlay
          setOverallError(null);
      }
      // If trying to close while uploading, Dialog should prevent it if modal prop is true
  };

  const pendingFileCount = filesToUpload.filter(f => f.status === 'pending' && !isUploading).length;

  useEffect(() => {
    if (!isOpen || !isUploading) return;
    const activelyProcessingFiles = filesToUpload.filter(f => f.status === 'uploading' || f.status === 'processing_started').length;
    if (activelyProcessingFiles === 0) {
        setIsUploading(false);
        const attemptedFiles = filesToUpload.filter(f => f.documentId || f.status === 'error');
        const erroredInAttempt = attemptedFiles.some(f => f.status === 'error');
        const allAttemptedSuccessfullyCompleted = attemptedFiles.length > 0 && attemptedFiles.every(f => f.status === 'complete');
        if (allAttemptedSuccessfullyCompleted) {
            setModalPhase('success');
        } else if (erroredInAttempt) {
            if (!overallError) {
                 const errorCount = attemptedFiles.filter(f => f.status === 'error').length;
                 if (errorCount === attemptedFiles.length && attemptedFiles.length > 0) {
                    setOverallError("All documents failed during processing or upload.");
                 } else {
                    setOverallError("Some documents encountered errors during processing.");
                 }
            }
        } else if (attemptedFiles.length > 0 && !allAttemptedSuccessfullyCompleted && !erroredInAttempt) {
             if (!overallError) setOverallError("Processing finished with an undetermined state for some files.");
        } else if (filesToUpload.length === 0) {
             onClose(false);
        }
    }
  }, [filesToUpload, isUploading, isOpen, onClose, overallError, setOverallError]);

  // Success UI handler
  const handleUploadMore = () => {
    setFilesToUpload([]);
    setOverallError(null);
    setIsUploading(false);
    setModalPhase('idle');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange} modal={true}> 
      <DialogContent 
        className="sm:max-w-2xl" 
        onDragEnter={(e: React.DragEvent<HTMLDivElement>) => handleDrag(e, 'enter')} 
        onDragLeave={(e: React.DragEvent<HTMLDivElement>) => handleDrag(e, 'leave')} 
        onDragOver={(e: React.DragEvent<HTMLDivElement>) => handleDrag(e, 'over')} 
        onDrop={(e: React.DragEvent<HTMLDivElement>) => handleDrag(e, 'drop')}
        onEscapeKeyDown={(e) => { if (isUploading) e.preventDefault(); }}
        onPointerDownOutside={(e) => { if (isUploading) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
          <DialogDescription>
            {activeCaseId ? "Select or drop files to upload to the current case." : "Please select a case before uploading."}
          </DialogDescription>
        </DialogHeader>

        {/* Success State */}
        {modalPhase === 'success' && (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <div className="text-lg font-semibold mb-2">Upload Successful!</div>
            <div className="text-muted-foreground mb-6">Your document(s) have been uploaded and processed.</div>
            <div className="flex gap-4">
              <Button onClick={() => onClose(true)} variant="default">Close</Button>
              <Button onClick={handleUploadMore} variant="outline">Upload More</Button>
            </div>
          </div>
        )}

        {/* Main Upload UI (idle or uploading) */}
        {modalPhase !== 'success' && <>
        {/* Drop Zone and File Input */}
        <div 
            className={`mt-4 p-6 border-2 border-dashed rounded-lg text-center transition-colors ${dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50'}`}
        >
            <input 
                type="file"
                id="file-upload"
                multiple 
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.md,.json"
                disabled={isUploading || !activeCaseId}
            />
            <Label 
                htmlFor="file-upload"
                className={`cursor-pointer flex flex-col items-center ${!activeCaseId ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                 <Icons.Upload className="h-12 w-12 text-muted-foreground mb-2" />
                 <span className="font-semibold text-primary">Click to select files</span>
                 <span className="text-muted-foreground mt-1">or drag and drop</span>
                 <p className="text-xs text-muted-foreground mt-2">Supported: PDF, DOCX, TXT, MD, JSON</p>
            </Label>
        </div>

        {/* File List */}
        {filesToUpload.length > 0 && (
            <div className="mt-4 max-h-60 overflow-y-auto pr-2 space-y-2">
                {filesToUpload.map((fileStatus, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded-md bg-background shadow-sm">
                        <div className="flex items-center space-x-2 overflow-hidden">
                             <span className="text-2xl">
                                {fileStatus.status === 'pending' && <Clock className="h-5 w-5 text-muted-foreground" />}
                                {fileStatus.status === 'uploading' && <Spinner size="xs" />}
                                {fileStatus.status === 'processing_started' && <CheckCircle className="h-5 w-5 text-green-500" />}
                                {fileStatus.status === 'error' && <XCircle className="h-5 w-5 text-destructive" />}
                                {fileStatus.status === 'complete' && <CheckCircle className="h-5 w-5 text-green-500" />}
                             </span>
                             <div className="flex flex-col overflow-hidden">
                                <span className="text-sm font-medium truncate" title={fileStatus.file.name}>{fileStatus.file.name}</span>
                                <span className="text-xs text-muted-foreground">
                                    {fileStatus.status === 'error' ? (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="text-destructive cursor-help">Upload Failed</span>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom"><p>{fileStatus.error || 'Unknown error'}</p></TooltipContent>
                                        </Tooltip>
                                    ) : fileStatus.status === 'uploading' ? (
                                        `Uploading... ${fileStatus.progress !== undefined ? fileStatus.progress + '%' : ''}`
                                    ) : fileStatus.status === 'processing_started' ? (
                                        `Processing...`
                                    ) : fileStatus.status === 'complete' ? (
                                         `Complete`
                                    ) : (
                                        `Pending`
                                    )}
                                </span>
                             </div>
                        </div>
                         <Button 
                             variant="ghost" 
                             size="icon" 
                             className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-50"
                             onClick={() => removeFile(index)}
                             disabled={isUploading && (fileStatus.status === 'uploading' || fileStatus.status === 'processing_started')}
                             aria-label="Remove file"
                         >
                             <XCircle className="h-4 w-4" />
                         </Button>
                     </div>
                 ))}
             </div>
         )}

        {overallError && (
            <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{overallError}</AlertDescription>
            </Alert>
        )}

        <DialogFooter className="mt-6">
          <Button 
            variant="outline" 
            onClick={() => handleOpenChange(false)} 
            disabled={isUploading}
           >
               Cancel
           </Button>
          <Button 
            onClick={handleUpload} 
            disabled={pendingFileCount === 0 || isUploading || !activeCaseId}
           >
            {isUploading ? <Spinner size="xs" className="mr-2" /> : <Icons.Upload className="mr-2 h-4 w-4" />}
            Upload {pendingFileCount > 0 ? `(${pendingFileCount})` : ''}
          </Button>
        </DialogFooter>
        </>}
      </DialogContent>
    </Dialog>
  );
};

export default UploadModal; 