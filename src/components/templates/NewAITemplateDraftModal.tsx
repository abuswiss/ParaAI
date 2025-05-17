"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth'; // Import useAuth to get user ID
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Spinner } from '@/components/ui/Spinner';
import { Icons } from '@/components/ui/Icons';
import { supabase } from '@/lib/supabaseClient'; // Import supabase for invoke
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter, 
  DialogClose 
} from '@/components/ui/Dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'; // Import Select
import { useToast } from "@/hooks/use-toast"; // Changed import from react-hot-toast
import { Alert, AlertDescription } from '@/components/ui/Alert'; // Corrected casing & Import Alert
import { cn } from '@/lib/utils';
import { Check, Sparkles } from 'lucide-react';
import * as templateService from '@/services/templateService';
import { DocumentTemplate } from '@/services/templateService'; // For category type

// Define common legal template types/categories
const TEMPLATE_CATEGORIES = [
  'Contract', 'Motion', 'Pleading', 'Letter', 'Memorandum', 
  'Agreement', 'Affidavit', 'Discovery Request', 'Order', 'Other'
];

// Enum for tracking generation progress steps
enum GenerationStep {
  NotStarted = 0,
  ProcessingPrompt = 1,
  GeneratingTemplate = 2,
  ExtractingPlaceholders = 3,
  SavingTemplate = 4,
  Complete = 5
}

interface NewAITemplateDraftModalProps {
  isOpen: boolean;
  onClose: (refreshNeeded?: boolean) => void; 
  onSuccess?: (newTemplateId: string, newTemplateName?: string) => void;
}

const NewAITemplateDraftModal: React.FC<NewAITemplateDraftModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [suggestedName, setSuggestedName] = useState('');
  const [suggestedDescription, setSuggestedDescription] = useState('');
  const [category, setCategory] = useState<DocumentTemplate['category']>(TEMPLATE_CATEGORIES[0].toLowerCase() as DocumentTemplate['category']);
  const [instructions, setInstructions] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<GenerationStep>(GenerationStep.NotStarted);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setSuggestedName('');
      setSuggestedDescription('');
      setCategory(TEMPLATE_CATEGORIES[0].toLowerCase() as DocumentTemplate['category']);
      setInstructions('');
      setIsLoading(false);
      setError(null);
      setCurrentStep(GenerationStep.NotStarted);
    } else {
      setInstructions(''); 
      setSuggestedName('');
      setSuggestedDescription('');
    }
  }, [isOpen]);

  const updateProgress = (step: GenerationStep) => {
    setTimeout(() => {
      setCurrentStep(step);
    }, 400);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instructions.trim()) {
      setError('Template drafting instructions are required.');
      return;
    }
    if (!category) {
        setError('Please select a template category.');
        return;
    }

    setIsLoading(true);
    setError(null);
    setCurrentStep(GenerationStep.ProcessingPrompt);
    
    const toastId = toast({ 
        description: "Starting AI template generation...", 
    });

    try {
      updateProgress(GenerationStep.GeneratingTemplate);
      
      const { data, error: serviceError } = await templateService.generateAndSaveAITemplate(
        instructions.trim(),
        category,
        suggestedName.trim() || undefined,
        suggestedDescription.trim() || undefined
      );

      if (serviceError) throw serviceError;
      if (!data || !data.id) {
        throw new Error('AI template creation failed or did not return an ID.');
      }
      
      updateProgress(GenerationStep.SavingTemplate);

      setTimeout(() => {
        updateProgress(GenerationStep.Complete);
        
        const finalTemplateName = data.name || 'AI Generated Template';
        console.log(`AI template created and saved successfully: ID=${data.id}, Name=${finalTemplateName}`);
        
        toast({
            description: `Template "${finalTemplateName}" created successfully!`,
        });
        
        if (onSuccess) {
          onSuccess(data.id, finalTemplateName);
        }
        
        setTimeout(() => handleClose(true), 1000);
      }, 600);
      
    } catch (err) {
      console.error('Error during AI template creation:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
      setCurrentStep(GenerationStep.NotStarted);
      
      toast({
          title: "Error",
          description: errorMessage,
          variant: 'destructive',
      });
    } finally {
      if (currentStep !== GenerationStep.Complete && currentStep !== GenerationStep.SavingTemplate) {
         setIsLoading(false);
      }
    }
  };
  
  const handleClose = useCallback((refreshNeeded = false) => {
      if (isLoading && currentStep !== GenerationStep.Complete) return; 
      onClose(refreshNeeded);
  }, [isLoading, onClose, currentStep]);

  const ProgressSteps = () => {
    const steps = [
      { label: "Processing Prompt", step: GenerationStep.ProcessingPrompt },
      { label: "Generating Template", step: GenerationStep.GeneratingTemplate },
      { label: "Saving Template", step: GenerationStep.SavingTemplate },
    ];
    
    return (
      <div className="w-full py-4">
        <div className="flex justify-between mb-2">
          {steps.map((step, index) => (
            <div key={index} className="flex flex-col items-center w-1/3">
              <div 
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm border shrink-0",
                  currentStep >= step.step
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-text-tertiary dark:bg-muted dark:border-muted-foreground dark:text-muted-foreground"
                )}
              >
                {currentStep > step.step ? (
                  <Check className="h-4 w-4" />
                ) : currentStep === step.step ? (
                  <Spinner size="xs" />
                ) : (
                  index + 1
                )}
              </div>
              <span className={cn(
                "text-xs mt-1 text-center", 
                currentStep >= step.step ? "text-primary" : "text-text-tertiary dark:text-muted-foreground"
              )}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
        <div className={cn(
          "relative mt-2 h-1 rounded-full",
          currentStep >= GenerationStep.ProcessingPrompt ? "bg-primary/30 dark:bg-muted-foreground/30" : "bg-border dark:bg-muted-foreground/30"
        )}>
            <div className={cn("absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-500 ease-in-out")}
                 style={{ width: `${(currentStep / GenerationStep.SavingTemplate) * 100}%`}} />
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Sparkles className="h-5 w-5 mr-2 text-primary" />
            Create New AI Template
          </DialogTitle>
          <DialogDescription>
            Describe the template you need. The AI will generate a draft with common placeholders.
          </DialogDescription>
        </DialogHeader>

        {isLoading && currentStep > GenerationStep.NotStarted && currentStep < GenerationStep.Complete && (
            <ProgressSteps />
        )}

        {currentStep === GenerationStep.Complete ? (
             <div className="text-center py-8">
                <Check className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-medium text-foreground">Template Created!</p>
                <p className="text-sm text-text-tertiary dark:text-soft-purple">Your new AI-generated template is ready.</p>
            </div>
        ) : (
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div>
                <Label htmlFor="templateInstructions" className="text-foreground">Drafting Instructions*</Label>
                <Textarea
                  id="templateInstructions"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g., A client engagement letter for a new consulting project..."
                  rows={5}
                  className="mt-1 bg-background text-foreground border-border placeholder:text-text-tertiary dark:placeholder:text-neutral-500"
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="templateCategory" className="text-foreground">Category</Label>
                    <Select value={category} onValueChange={(value) => setCategory(value as DocumentTemplate['category'])} disabled={isLoading}>
                        <SelectTrigger id="templateCategory" className="mt-1 w-full bg-background text-foreground border-border">
                            <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover text-popover-foreground border-border">
                            {TEMPLATE_CATEGORIES.map((cat) => (
                                <SelectItem key={cat} value={cat.toLowerCase() as DocumentTemplate['category']}>{cat}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                 <div>
                    <Label htmlFor="templateName" className="text-foreground">Suggested Name (Optional)</Label>
                    <Input 
                        id="templateName" 
                        value={suggestedName} 
                        onChange={(e) => setSuggestedName(e.target.value)} 
                        placeholder="e.g., Standard NDA Template"
                        className="mt-1 bg-background text-foreground border-border placeholder:text-text-tertiary dark:placeholder:text-neutral-500"
                        disabled={isLoading}
                    />
                </div>
              </div>

              <div>
                <Label htmlFor="templateDescription" className="text-foreground">Suggested Description (Optional)</Label>
                <Textarea
                  id="templateDescription"
                  value={suggestedDescription}
                  onChange={(e) => setSuggestedDescription(e.target.value)}
                  placeholder="A concise description of this template's purpose and use case."
                  rows={3}
                  className="mt-1 bg-background text-foreground border-border placeholder:text-text-tertiary dark:placeholder:text-neutral-500"
                  disabled={isLoading}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <DialogFooter className="pt-2">
                <Button type="button" variant="ghost" onClick={() => handleClose()} disabled={isLoading && currentStep !== GenerationStep.Complete}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading || !instructions.trim() || !category}>
                  {isLoading ? <Spinner size="sm" className="mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />} 
                  {isLoading ? `Step ${currentStep}/${GenerationStep.SavingTemplate}...` : 'Generate Template'}
                </Button>
              </DialogFooter>
            </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NewAITemplateDraftModal; 