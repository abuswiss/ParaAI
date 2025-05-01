"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAtomValue } from 'jotai';
import { activeCaseIdAtom } from '@/atoms/appAtoms';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Spinner } from '@/components/ui/Spinner';
import { Icons } from '@/components/ui/Icons';
import * as templateService from '@/services/templateService';
import { DocumentDraft } from '@/services/templateService'; // Import type
import { toast } from 'react-hot-toast';

interface NewAIDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newDraftId: string) => void; // Callback with new draft ID
}

const NewAIDraftModal: React.FC<NewAIDraftModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [instructions, setInstructions] = useState('');
  const [draftName, setDraftName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const activeCaseId = useAtomValue(activeCaseIdAtom);

  // Ref for the modal content area
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setInstructions('');
      setDraftName(`AI Draft - ${new Date().toLocaleTimeString()}`); // Default name
      setIsLoading(false);
      setError(null);
    } else {
        // Clear potentially sensitive data when closed
        setInstructions(''); 
    }
  }, [isOpen]);

  // Close modal on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && modalRef.current && !modalRef.current.contains(event.target as Node) && !isLoading) {
        handleClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, isLoading, onClose]); // Dependencies for the effect

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instructions.trim()) {
      setError('Drafting instructions are required.');
      return;
    }
    if (!draftName.trim()) {
      setError('Draft name is required.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Generate content using AI
      console.log("Generating AI draft content with instructions:", instructions);
      const { data: generatedContent, error: generateError } = await templateService.generateDraftWithAI(instructions);
      
      if (generateError || !generatedContent) {
        throw generateError || new Error('AI failed to generate draft content.');
      }
      console.log("AI content generated successfully.");

      // Step 2: Create the draft document entry in DB
      console.log("Saving AI generated content as draft:", draftName);
      const { data: newDraft, error: createError } = await templateService.createAIDraft(
        draftName.trim(),
        generatedContent,
        activeCaseId || undefined // Pass caseId if available
      );

      if (createError || !newDraft) {
        throw createError || new Error('Failed to save the generated draft.');
      }
      console.log("AI draft saved successfully:", newDraft.id);

      // Step 3: Call success callback and close
      toast.success(`AI draft "${draftName}" saved!`);
      onSuccess(newDraft.id);
      onClose(); // Close modal on full success

    } catch (err) {
      console.error('Error during AI draft creation:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during AI draft creation.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Wrap handleClose in useCallback
  const handleClose = useCallback(() => {
      if (isLoading) return; 
      onClose();
  }, [isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      {/* Attach ref to the modal content */}
      <div 
        ref={modalRef} 
        className="relative z-50 w-full max-w-2xl bg-surface rounded-lg shadow-xl p-6"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-text-primary">Create New AI Draft</h3>
          <Button variant="ghost" size="sm" onClick={handleClose} className="-mr-2" disabled={isLoading}>
            <Icons.Close className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="mb-4 text-sm text-red-500 bg-red-100 dark:bg-red-900/20 p-3 rounded-md border border-red-300 dark:border-red-600">
              {error}
            </div>
          )}

          <div>
            <Label>Draft Name</Label>
            <Input
              id="draftName"
              name="draftName"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Enter a name for this draft"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <Label>Drafting Instructions</Label>
            <Textarea
              id="instructions"
              name="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={6} // Adjust rows as needed
              placeholder="Describe the document you want the AI to draft (e.g., 'Draft a simple non-disclosure agreement between Company A and Company B regarding project X...')"
              required
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-muted-foreground">Provide clear and specific instructions for the best results.</p>
          </div>

          {activeCaseId && (
             <p className="text-xs text-muted-foreground">Draft will be associated with case: {activeCaseId}</p>
           )}
           {!activeCaseId && (
             <p className="text-xs text-muted-foreground">No active case selected. Draft will not be associated with a case.</p>
           )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-border mt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="min-w-[120px]">
              {isLoading ? <Spinner size="sm" className="mr-2" /> : <Icons.Sparkles className="mr-2 h-4 w-4" />}
              {isLoading ? 'Generating...' : 'Generate Draft'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewAIDraftModal; 