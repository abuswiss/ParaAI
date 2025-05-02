"use client"; // If using Next.js App Router or similar client-side features

import React, { useState, useCallback, ChangeEvent, useEffect } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { activeCaseIdAtom, addTaskAtom, updateTaskAtom, removeTaskAtom, initialFilesForUploadAtom, activeEditorItemAtom } from '@/atoms/appAtoms';
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
  
  const activeCaseId = useAtomValue(activeCaseIdAtom);
  const [initialFiles, setInitialFiles] = useAtom(initialFilesForUploadAtom);
  const addTask = useSetAtom(addTaskAtom);
  const updateTask = useSetAtom(updateTaskAtom);
  const removeTask = useSetAtom(removeTaskAtom);
  const setActiveEditorItem = useSetAtom(activeEditorItemAtom);
  const { toast } = useToast();

  // Reset state and handle initial files when modal is opened
  useEffect(() => {
    if (isOpen) {
        // Reset local state first
        setFilesToUpload([]);
        setOverallError(null);
        setIsUploading(false);
        setDragActive(false);

        // Check for initial files from drag-and-drop
        if (initialFiles.length > 0) {
            console.log('Processing initial files from atom:', initialFiles);
            const newFileStatuses = initialFiles.map(file => ({
                file,
                status: 'pending'
            } as UploadFileStatus));
            setFilesToUpload(newFileStatuses);
            // Clear the atom immediately after processing
            setInitialFiles([]); 
        }
    } else {
        // Optionally clear local state when closing if not handled elsewhere
        setFilesToUpload([]);
        setOverallError(null);
        // Clear the atom on close as well, just in case
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
    const pendingFiles = filesToUpload.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) {
      setOverallError("No pending files selected for upload.");
      return;
    }
    setIsUploading(true);
    setOverallError(null);
    let refreshNeeded = false;
    let uploadErrors = 0;

    // --- Upload files sequentially --- 
    for (let i = 0; i < filesToUpload.length; i++) {
        const currentFileStatus = filesToUpload[i];
        // Find the index in the current state array in case it shifted
        const currentIndex = filesToUpload.findIndex(f => f.file === currentFileStatus.file && f.status === 'pending');
        if (currentIndex === -1) continue; // Skip if not pending anymore

        const taskId = uuidv4();
        addTask({ 
            id: taskId, 
            description: `Uploading ${currentFileStatus.file.name}...`, 
            status: 'running', // Use 'running' consistently
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
            updateTask({ id: taskId, progress: 10 }); // Update global task too

            const { data: uploadResult, error: uploadError } = await uploadAndProcessDocument(currentFileStatus.file, activeCaseId);
            
            if (uploadError || !uploadResult) {
                throw uploadError || new Error('Upload initiation failed.');
            }

            // Set the active editor item immediately after successful upload initiation
            setActiveEditorItem({ type: 'document', id: uploadResult.id });

            // Update task status upon successful initiation (backend handles rest)
            updateTask({ 
                id: taskId, 
                status: 'success', // Mark as success for frontend (backend processing continues)
                progress: 100, 
                description: `${currentFileStatus.file.name}: Processing started...`
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
                description: `Document "${currentFileStatus.file.name}" is processing. You can interact with it in chat shortly.`,
            });

            // Auto-remove task from status bar after a delay
            setTimeout(() => removeTask(taskId), 5000);

        } catch (error) {
            console.error(`Error uploading ${currentFileStatus.file.name}:`, error);
            uploadErrors++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
            
            if (taskId) {
                 updateTask({ id: taskId, status: 'error', description: `Error: ${errorMessage}` });
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
    if (uploadErrors === filesToUpload.length) {
        setOverallError(`All ${uploadErrors} file(s) failed to upload.`);
    } else if (uploadErrors > 0) {
        setOverallError(`${uploadErrors} file(s) failed to upload. Others initiated processing.`);
    } else if (refreshNeeded) {
        // Close modal automatically if all uploads initiated successfully (toast moved earlier)
        onClose(true); // Signal refresh needed
    } else {
        // Should not happen if logic is correct, but handle just in case
        onClose(false);
    }
  };

  // Controlled close from Dialog component
  const handleOpenChange = (open: boolean) => {
      if (!open && !isUploading) { // Only allow close if not uploading
          onClose(); // Call original onClose
      }
      // If trying to close while uploading, Dialog should prevent it if modal prop is true
  };

  const pendingFileCount = filesToUpload.filter(f => f.status === 'pending' && !isUploading).length;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange} modal={true}> {/* Use modal={true} to prevent closing via Esc/overlay click during upload */} 
      <DialogContent 
        className="sm:max-w-2xl" 
        onDragEnter={(e: React.DragEvent<HTMLDivElement>) => handleDrag(e, 'enter')} // Explicit type
        onDragLeave={(e: React.DragEvent<HTMLDivElement>) => handleDrag(e, 'leave')} // Explicit type
        onDragOver={(e: React.DragEvent<HTMLDivElement>) => handleDrag(e, 'over')}  // Explicit type
        onDrop={(e: React.DragEvent<HTMLDivElement>) => handleDrag(e, 'drop')}    // Explicit type
        aria-describedby={undefined} // Remove default aria-describedby if not using DialogDescription
      >
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
          <DialogDescription>
            {activeCaseId ? `Upload files to the active case.` : "Upload files. Select a case first to associate them."}
            Drag and drop files or click to browse.
          </DialogDescription>
        </DialogHeader>

        {overallError && (
            <Alert variant="destructive" className="mt-4">
                <AlertDescription>{overallError}</AlertDescription>
            </Alert>
        )}

        {/* Drag and Drop Area / File Input - Simplified with Label */}
        <Label 
          className={`relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${dragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/80 bg-background/50'}`}
        >
            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                <Icons.Upload className={`w-8 h-8 mb-2 transition-colors ${dragActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className={`mb-1 text-sm transition-colors ${dragActive ? 'text-primary' : 'text-muted-foreground'}`}>
                    <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-muted-foreground/80">PDF, DOCX, DOC, TXT, MD</p>
            </div>
            {/* Supported formats text */}
            <p className="text-xs text-muted-foreground/70 absolute bottom-2 left-1/2 transform -translate-x-1/2">
                Supported: PDF, DOCX, DOC, TXT, MD
            </p>
            <Input 
                id="file-upload-input" 
                type="file" 
                multiple 
                onChange={handleFileChange} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" // Visually hidden but takes space
                accept=".pdf,.doc,.docx,.txt,.md" 
                disabled={isUploading}
            />
        </Label>
        
        {/* File List */}
        {filesToUpload.length > 0 && (
            <div className="mt-4 space-y-3 max-h-60 overflow-y-auto pr-2">
                {filesToUpload.map((fileStatus, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded-md bg-muted/30">
                         <div className="flex items-center space-x-3 flex-grow min-w-0"> {/* Ensure text truncates */}
                            {/* Icon based on status */}
                            {fileStatus.status === 'pending' && <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />}
                            {fileStatus.status === 'uploading' && <Spinner size="sm" className="text-primary flex-shrink-0" />}
                            {fileStatus.status === 'processing_started' && <Clock className="h-5 w-5 text-blue-500 flex-shrink-0" />}
                            {fileStatus.status === 'complete' && <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />}
                            {fileStatus.status === 'error' && <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />}

                            {/* File Name & Size */}
                            <div className="flex flex-col min-w-0"> {/* Ensure text truncates */}
                                <span className="text-sm font-medium truncate" title={fileStatus.file.name}>
                                    {fileStatus.file.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {(fileStatus.file.size / (1024 * 1024)).toFixed(2)} MB
                                </span>
                            </div>
                         </div>

                        {/* Progress Bar & Status/Actions */}
                        <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                            {fileStatus.status === 'uploading' && fileStatus.progress !== undefined && (
                                <div className="w-24 flex flex-col items-end">
                                     <Progress value={fileStatus.progress} className="h-1.5 w-full" />
                                     <span className="text-xs text-muted-foreground mt-0.5">{fileStatus.progress}%</span>
                                </div>
                            )}
                            {fileStatus.status === 'processing_started' && (
                                <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-600 dark:text-blue-400">Processing</Badge>
                            )}
                            {fileStatus.status === 'complete' && (
                                <Badge variant="outline" className="text-xs border-green-500/50 text-green-600 dark:text-green-400">Complete</Badge>
                            )}
                             {fileStatus.status === 'error' && (
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Badge variant="destructive" className="text-xs cursor-help">Error</Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="max-w-xs">{fileStatus.error || 'Unknown error'}</p>
                                    </TooltipContent>
                                </Tooltip>
                             )}
                             {(fileStatus.status === 'pending' || fileStatus.status === 'error') && !isUploading && (
                                <Button
                                    variant="ghost"
                                    size="icon_xs"
                                    onClick={() => removeFile(index)}
                                    className="text-muted-foreground hover:text-destructive"
                                    aria-label="Remove file"
                                >
                                    <XCircle className="h-4 w-4" />
                                </Button>
                             )}
                        </div>
                    </div>
                ))}
            </div>
        )}

        <DialogFooter className="mt-6">
          <DialogClose asChild>
             {/* Disable close button during upload */} 
            <Button variant="outline" onClick={() => onClose()} disabled={isUploading}>Cancel</Button>
          </DialogClose>
          <Button 
            onClick={handleUpload} 
            disabled={pendingFileCount === 0 || isUploading}
          >
            {isUploading ? <><Spinner size="sm" className="mr-2" /> Uploading...</> : `Upload ${pendingFileCount} File(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UploadModal; 