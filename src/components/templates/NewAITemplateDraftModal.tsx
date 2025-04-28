"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
// Removed useAtomValue and activeCaseIdAtom - Templates are not case-specific
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Spinner } from '@/components/ui/Spinner';
import { Icons } from '@/components/ui/Icons';
import * as templateService from '@/services/templateService';
// Assuming a similar type structure for templates
// import { TemplateDraft } from '@/services/templateService'; 

interface NewAITemplateDraftModalProps { // Renamed interface
  isOpen: boolean;
  onClose: () => void;
  // onSuccess might not be needed if we just close, or could signal refresh needed
  // onSuccess?: (newTemplateDraftId: string) => void; 
}

// Renamed component
const NewAITemplateDraftModal: React.FC<NewAITemplateDraftModalProps> = ({ isOpen, onClose /*, onSuccess */ }) => {
  const [instructions, setInstructions] = useState('');
  const [templateName, setTemplateName] = useState(''); // Renamed state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Removed activeCaseId logic

  // Ref for the modal content area
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setInstructions('');
      setTemplateName(`AI Template - ${new Date().toLocaleTimeString()}`); // Default template name
      setIsLoading(false);
      setError(null);
    } else {
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
  }, [isOpen, isLoading, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instructions.trim()) {
      setError('Template drafting instructions are required.');
      return;
    }
    if (!templateName.trim()) {
      setError('Template name is required.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Generate template content using AI (New Service Call)
      console.log("Generating AI template draft content:", instructions);
      // TODO: Replace with actual template generation service call
      // const { data: generatedContent, error: generateError } = await templateService.generateTemplateDraftWithAI(instructions);
      // Placeholder until service function exists:
      const generatedContent = `Placeholder: AI generated content for template based on: ${instructions}`;
      const generateError = null; // Placeholder
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call

      if (generateError || !generatedContent) {
        throw generateError || new Error('AI failed to generate template draft content.');
      }
      console.log("AI template content generated successfully.");

      // Step 2: Create the template draft entry in DB (New Service Call)
      console.log("Saving AI generated content as template draft:", templateName);
       // TODO: Replace with actual template creation service call
      // const { data: newTemplateDraft, error: createError } = await templateService.createAITemplateDraft(
      //   templateName.trim(),
      //   generatedContent
      // );
      // Placeholder:
      const newTemplateDraft = { id: `template_${Date.now()}` }; // Placeholder ID
      const createError = null; // Placeholder
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate DB save

      if (createError || !newTemplateDraft) {
        throw createError || new Error('Failed to save the generated template draft.');
      }
      console.log("AI template draft saved successfully:", newTemplateDraft.id);

      // Step 3: Call success callback (if used) and close
      // if (onSuccess) {
      //   onSuccess(newTemplateDraft.id);
      // }
      onClose(); // Close modal on full success

    } catch (err) {
      console.error('Error during AI template draft creation:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during AI template draft creation.';
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
        {/* Header - Updated Title */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-text-primary">Create New AI Template Draft</h3>
          <Button variant="ghost" size="sm" onClick={handleClose} className="-mr-2" disabled={isLoading}>
            <Icons.Close className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="mb-4 text-sm text-red-500 bg-red-100 dark:bg-red-900/20 p-3 rounded-md border border-red-300 dark:border-red-600">
              {error}
            </div>
          )}

          {/* Updated Input */}
          <div>
            <Label htmlFor="templateName">Template Name</Label> {/* Added htmlFor */}
            <Input
              id="templateName"
              name="templateName"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Enter a name for this template draft"
              required
              disabled={isLoading}
            />
          </div>

          {/* Updated Textarea */}
          <div>
            <Label htmlFor="instructions">Template Drafting Instructions</Label> {/* Added htmlFor */}
            <Textarea
              id="instructions"
              name="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={6}
              placeholder="Describe the template you want the AI to draft (e.g., 'Draft a standard consulting agreement template...')"
              required
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-muted-foreground">Provide clear and specific instructions for the best results.</p>
          </div>

          {/* Removed Case Info */}

          {/* Footer - Updated Button Text */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-border mt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="min-w-[120px]">
              {isLoading ? <Spinner size="sm" className="mr-2" /> : <Icons.Sparkles className="mr-2 h-4 w-4" />}
              {isLoading ? 'Generating...' : 'Generate Template'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewAITemplateDraftModal; 