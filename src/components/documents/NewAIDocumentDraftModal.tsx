"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Spinner } from '@/components/ui/Spinner';
import { Icons } from '@/components/ui/Icons';
import { supabase } from '@/lib/supabaseClient';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter, 
  DialogClose 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import * as agentService from '@/services/agentService';
import * as documentService from '@/services/documentService';
import { useSetAtom } from 'jotai';
import { chatDocumentContextIdsAtom } from '@/atoms/appAtoms';

// Define common legal document types (can be expanded)
const DOCUMENT_TYPES = [
  'Motion', 'Pleading', 'Letter', 'Memorandum', 'Contract', 
  'Agreement', 'Affidavit', 'Discovery Request', 'Order', 'Other'
];

interface NewAIDocumentDraftModalProps {
  isOpen: boolean;
  onClose: (refreshNeeded?: boolean) => void;
  activeCaseId: string | null; // Case ID is required
  onSuccess?: (newDocumentId: string) => void; 
}

const NewAIDocumentDraftModal: React.FC<NewAIDocumentDraftModalProps> = ({ isOpen, onClose, activeCaseId, onSuccess }) => {
  const [documentType, setDocumentType] = useState<string>(DOCUMENT_TYPES[0]);
  const [instructions, setInstructions] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const setChatDocumentContextIds = useSetAtom(chatDocumentContextIdsAtom);

  // Reset state when modal opens or case changes
  useEffect(() => {
    if (isOpen) {
      setDocumentType(DOCUMENT_TYPES[0]);
      setInstructions('');
      setAdditionalContext('');
      setIsLoading(false);
      setError(null);
    } else {
      // Clear potentially sensitive data when closing
      setInstructions(''); 
      setAdditionalContext('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCaseId) {
        setError('No active case selected. Please select a case first.');
        return;
    }
    if (!instructions.trim()) {
      setError('Drafting instructions are required.');
      return;
    }
    if (!documentType) {
        setError('Please select a document type.');
        return;
    }
     if (!user) {
        setError('User not authenticated. Please log in.');
        return;
    }

    setIsLoading(true);
    setError(null);
    const toastId = toast({ 
        description: "Generating AI document draft...",
    });

    try {
      console.log("Calling agentService.handleAgentDraftStream...");

      // 1. Call the agent service to get the draft content
      const agentResult = await agentService.handleAgentDraftStream(
          instructions.trim(),
          activeCaseId, // Should be validated by now
          undefined, // documentContext (pass if available/needed)
          additionalContext.trim() || undefined // Pass additionalContext as analysisContext
          // Optional task tracking args can be added here
      );

      if (!agentResult.success || !agentResult.draftContent) {
          throw agentResult.error || new Error('AI generation failed or returned empty content.');
      }
      
      console.log("AI draft content received, saving document...");
      // Update toast
      toast({
          description: "AI draft generated, saving document...",
      });

      // 2. Save the generated content as a new document
      const filename = `${documentType} Draft - ${new Date().toLocaleDateString()}`;

      // Log the user ID being sent
      console.log(`NewAIDocumentDraftModal: handleSubmit - User ID being passed to createDocument: ${user.id}`);
      console.log(`NewAIDocumentDraftModal: handleSubmit - Active Case ID: ${activeCaseId}`);

      const { data: newDoc, error: createError } = await documentService.createDocument({
          userId: user.id, 
          caseId: activeCaseId, 
          content: agentResult.draftContent, 
          filename: filename,
          // Add template_id if applicable, maybe based on documentType?
          // contentType: 'text/html', // Explicitly set if createDocument doesn't default it correctly for this case
          // initialProcessingStatus: 'text_extracted' // Can also be set here if needed
      });

      if (createError) throw createError;
      if (!newDoc?.id) throw new Error('Document saved, but ID was not returned.');

      console.log("Document saved successfully:", newDoc.id);
      toast({
          description: "AI document draft generated and saved successfully!",
      });

      // --- Add new document ID to chat context --- 
      console.log(`Adding newly generated document ${newDoc.id} to chat context.`);
      setChatDocumentContextIds(prev => [...new Set([...prev, newDoc.id])]);
      // -------------------------------------------

      if (onSuccess) {
        onSuccess(newDoc.id);
      }
      handleClose(true); // Close and indicate refresh needed

    } catch (err) {
      console.error('Error during AI document generation/saving:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
      toast({
          title: "Error",
          description: errorMessage,
          variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleClose = useCallback((refreshNeeded = false) => {
      if (isLoading) return; 
      onClose(refreshNeeded);
  }, [isLoading, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}> 
      <DialogContent className="sm:max-w-xl bg-card dark:bg-dark-card text-card-foreground dark:text-dark-card-foreground backdrop-blur-md border border-card-border dark:border-dark-card-border">
        <DialogHeader>
          <DialogTitle>Generate AI Document Draft</DialogTitle>
          <DialogDescription>
            Provide instructions and context for the document you need. The AI will generate a draft within the selected case.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          {isLoading ? (
            // Loading State
            <div className="flex items-center justify-center min-h-[250px] py-4">
              <div className="text-center">
                <Spinner size="lg" className="mx-auto mb-4" />
                <p className="text-muted-foreground dark:text-dark-muted-foreground">Generating AI document draft...</p>
                <p className="text-xs text-muted-foreground dark:text-dark-muted-foreground mt-2">(This may take a moment)</p>
              </div>
            </div>
          ) : (
            // Form Content when not loading
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="docType" className="text-right text-card-foreground dark:text-dark-card-foreground">
                  Document Type
                </Label>
                <Select 
                  value={documentType}
                  onValueChange={setDocumentType} 
                  disabled={isLoading}
                >
                  <SelectTrigger id="docType" className="col-span-3 bg-input dark:bg-dark-input text-foreground dark:text-dark-foreground border-input dark:border-dark-input focus:ring-ring dark:focus:ring-dark-ring">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover dark:bg-dark-popover text-popover-foreground dark:text-dark-popover-foreground border-popover-border dark:border-dark-popover-border">
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="instructions-doc" className="text-right pt-2 text-card-foreground dark:text-dark-card-foreground">
                  Instructions*
                </Label>
                <Textarea
                  id="instructions-doc"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g., Draft a motion to compel discovery, requesting specific documents related to..."
                  required
                  rows={5}
                  className="col-span-3 bg-input dark:bg-dark-input text-foreground dark:text-dark-foreground border-input dark:border-dark-input focus-visible:ring-ring dark:focus-visible:ring-dark-ring placeholder:text-muted-foreground dark:placeholder:text-dark-muted-foreground"
                  disabled={isLoading}
                />
              </div>
              
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="context-doc" className="text-right pt-2 text-card-foreground dark:text-dark-card-foreground">
                  Additional Context
                </Label>
                <Textarea
                  id="context-doc"
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  placeholder="(Optional) Provide key facts, dates, party names, relevant case law citations, or specific clauses to include..."
                  rows={4}
                  className="col-span-3 bg-input dark:bg-dark-input text-foreground dark:text-dark-foreground border-input dark:border-dark-input focus-visible:ring-ring dark:focus-visible:ring-dark-ring placeholder:text-muted-foreground dark:placeholder:text-dark-muted-foreground"
                  disabled={isLoading}
                />
              </div>

              {error && (
                  <Alert variant="destructive">
                      <Icons.Alert className="h-4 w-4" /> 
                      <AlertDescription>{error}</AlertDescription>
                  </Alert>
              )}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
                 <Button type="button" variant="outline" disabled={isLoading}>
                     Cancel
                 </Button>
            </DialogClose>
            <Button variant="primary" type="submit" disabled={isLoading || !activeCaseId}>
              {isLoading ? <Spinner size="sm" className="mr-2" /> : <Icons.Sparkles className="mr-2 h-4 w-4 text-primary-foreground" />}
              {isLoading ? 'Generating...' : 'Generate Document'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NewAIDocumentDraftModal; 