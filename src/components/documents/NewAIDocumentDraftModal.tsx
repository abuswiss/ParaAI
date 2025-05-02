"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
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
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from '@/components/ui/alert';

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
      console.log("Invoking agent-draft function...");
      
      // TODO: Verify the exact function name and body structure required by the backend.
      // Assuming 'agent-draft' and a body structure like this:
      const { data, error: invokeError } = await supabase.functions.invoke(
          'agent-draft', // Assuming this is the correct function name
          {
              body: { 
                  instructions: instructions.trim(), 
                  documentType, 
                  additionalContext: additionalContext.trim(),
                  caseId: activeCaseId, 
                  userId: user.id 
              },
          }
      );

      if (invokeError) throw invokeError;
      
      // TODO: Adjust response parsing based on actual backend function response
      const result = data as { success: boolean, documentId?: string, error?: string }; 

      if (!result || !result.success) {
          throw new Error(result?.error || 'AI document generation failed.');
      }
      
      if (!result.documentId) {
          throw new Error('Document generated, but ID was not returned.');
      }

      console.log("AI document generated successfully:", result.documentId);
      toast({
          description: "AI document generated successfully!",
          variant: 'success',
          id: toastId.id,
      });

      if (onSuccess) {
        onSuccess(result.documentId);
      }
      handleClose(true); // Close and indicate refresh needed

    } catch (err) {
      console.error('Error during AI document generation:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
      toast({
          title: "Error",
          description: errorMessage,
          variant: 'destructive',
          id: toastId.id,
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
      <DialogContent className="sm:max-w-xl bg-card text-card-foreground border dark:bg-card dark:text-card-foreground"> 
        <DialogHeader>
          <DialogTitle>Generate AI Document Draft</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Provide instructions and context for the document you need. The AI will generate a draft within the selected case.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="docType" className="text-right text-card-foreground">
                Document Type
              </Label>
              <Select 
                value={documentType}
                onValueChange={setDocumentType} 
                disabled={isLoading}
              >
                <SelectTrigger id="docType" className="col-span-3 bg-background text-foreground border-border">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border-border">
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="instructions-doc" className="text-right pt-2 text-card-foreground">
                Instructions*
              </Label>
              <Textarea
                id="instructions-doc"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g., Draft a motion to compel discovery, requesting specific documents related to..."
                required
                rows={5}
                className="col-span-3 bg-background text-foreground border-border focus-visible:ring-primary"
                disabled={isLoading}
              />
            </div>
            
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="context-doc" className="text-right pt-2 text-card-foreground">
                Additional Context
              </Label>
              <Textarea
                id="context-doc"
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="(Optional) Provide key facts, dates, party names, relevant case law citations, or specific clauses to include..."
                rows={4}
                className="col-span-3 bg-background text-foreground border-border focus-visible:ring-primary"
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
          <DialogFooter>
            <DialogClose asChild>
                 <Button type="button" variant="outline" disabled={isLoading}>
                     Cancel
                 </Button>
            </DialogClose>
            <Button type="submit" disabled={isLoading || !activeCaseId}>
              {isLoading ? <Spinner size="sm" className="mr-2" /> : <Icons.Sparkles className="mr-2 h-4 w-4" />}
              Generate Document
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NewAIDocumentDraftModal; 