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
import { Modal } from '@/components/ui/Modal'; // Import Modal

// Define common legal template types
const LEGAL_TEMPLATE_TYPES = [
  'Contract', 'Motion', 'Pleading', 'Letter', 'Memorandum', 
  'Agreement', 'Affidavit', 'Discovery Request', 'Order', 'Other'
];

interface NewAITemplateDraftModalProps { // Renamed interface
  isOpen: boolean;
  onClose: (refreshNeeded?: boolean) => void; // Allow passing refresh indicator
  // Add onSuccess prop
  onSuccess?: (newTemplateDraftId: string) => void; 
}

// Renamed component
const NewAITemplateDraftModal: React.FC<NewAITemplateDraftModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [templateName, setTemplateName] = useState('');
  const [templateType, setTemplateType] = useState<string>(LEGAL_TEMPLATE_TYPES[0]); // Default to first type
  const [instructions, setInstructions] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Removed activeCaseId logic

  // Ref for the modal content area
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setTemplateName(`AI Template - ${new Date().toLocaleTimeString()}`);
      setTemplateType(LEGAL_TEMPLATE_TYPES[0]);
      setInstructions('');
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
    if (!templateType) {
        setError('Please select a template type.');
        return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Prepend the selected type to the instructions
      const finalInstructions = `Draft a ${templateType}: ${instructions.trim()}`;
      
      // Step 1: Generate template content using AI (New Service Call)
      console.log("Generating AI template draft content:", finalInstructions);
      // TODO: Replace with actual template generation service call
      const { data: generatedContent, error: generateError } = await templateService.generateTemplateDraftWithAI(finalInstructions);
      // Placeholder until service function exists:
      // const generatedContent = `Placeholder: AI generated content for template based on: ${finalInstructions}`;
      // const generateError = null; // Placeholder
      // await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call

      if (generateError || !generatedContent) {
        throw generateError || new Error('AI failed to generate template draft content.');
      }
      console.log("AI template content generated successfully.");

      // Step 2: Create the template draft entry in DB (New Service Call)
      console.log("Saving AI generated content as template draft:", templateName);
       // Pass the selected templateType as the category
      const { data: newTemplateDraft, error: createError } = await templateService.createAITemplateDraft(
        templateName.trim(),
        generatedContent,
        templateType as DocumentTemplate['category'] // <-- Pass templateType here
      );
      // Placeholder:
      // const newTemplateDraft = { id: `template_${Date.now()}` }; // Placeholder ID
      // const createError = null; // Placeholder
      // await new Promise(resolve => setTimeout(resolve, 500)); // Simulate DB save

      if (createError || !newTemplateDraft) {
        throw createError || new Error('Failed to save the generated template draft.');
      }
      console.log("AI template draft saved successfully:", newTemplateDraft.id);

      // Step 3: Call success callback (if used) and close
      if (onSuccess) {
        onSuccess(newTemplateDraft.id);
      }
      // onClose(true); // Indicate refresh needed when closing on success
      handleClose(true); // Use the handleClose wrapper, indicate refresh

    } catch (err) {
      console.error('Error during AI template draft creation:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during AI template draft creation.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Wrap handleClose in useCallback
  const handleClose = useCallback((refreshNeeded = false) => { // Accept refresh flag
      if (isLoading) return; 
      onClose(refreshNeeded); // Pass flag to parent onClose
  }, [isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={() => handleClose(false)} title="Create New AI Template Draft">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="templateName">Template Name</Label>
          <Input
            id="templateName"
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            required
            className="w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>

        {/* Template Type Dropdown */}
        <div>
          <Label htmlFor="templateType">Template Type</Label>
          {/* Basic HTML Select styled with Tailwind */}
          <select
            id="templateType"
            value={templateType}
            onChange={(e) => setTemplateType(e.target.value)}
            required
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            {LEGAL_TEMPLATE_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="instructions">Template Drafting Instructions</Label>
          <Textarea
            id="instructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Describe the template you want the AI to draft (e.g., 'Draft a standard consulting agreement template...')"
            required
            rows={5}
            className="w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Provide clear and specific instructions for the best results.
          </p>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="ghost" onClick={() => handleClose(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Spinner size="sm" className="mr-2" /> : <Icons.Sparkles className="mr-2 h-4 w-4" />}
            Generate Template
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default NewAITemplateDraftModal; 