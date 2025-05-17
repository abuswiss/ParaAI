import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '../../ui/dialog';
import { Textarea } from '../../ui/textarea';
import { Button } from '../../ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { generateAndSaveAITemplate, DocumentTemplate } from '../../../services/templateService';

// Simplified data passed back when a template is created and saved by the service
interface GeneratedTemplateInfo {
  id: string;
  name: string;
}

// Define common legal template types/categories
const TEMPLATE_CATEGORIES: DocumentTemplate['category'][] = [
  'Contract', 'Letter', 'Pleading', 'Memorandum', 'Agreement', 'Other'
];

interface NewAITemplateGenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplateGenerated: (templateInfo: GeneratedTemplateInfo) => void; 
}

const NewAITemplateGenModal: React.FC<NewAITemplateGenModalProps> = ({
  isOpen,
  onClose,
  onTemplateGenerated,
}) => {
  const [prompt, setPrompt] = useState<string>('');
  const [category, setCategory] = useState<DocumentTemplate['category'] | '' >('');
  const [suggestedName, setSuggestedName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt for the template.');
      return;
    }
    if (!category) {
      toast.error('Please select a template category.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: generatedInfo, error: serviceError } = await generateAndSaveAITemplate(
        prompt,
        category,
        suggestedName || undefined,
        undefined
      );

      if (serviceError) {
        throw serviceError;
      }

      if (generatedInfo && generatedInfo.id) {
        onTemplateGenerated(generatedInfo);
        toast.success(`Template "${generatedInfo.name}" generated and saved successfully!`);
        onClose(); 
        setPrompt('');
        setCategory('');
        setSuggestedName('');
      } else {
        throw new Error('AI template generation failed or did not return an ID.');
      }

    } catch (err: any) {
      console.error('Failed to generate AI template:', err);
      const message = err.message || 'An error occurred during template generation.';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Sparkles className="h-5 w-5 mr-2 text-purple-500" />
            Generate New AI Template
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <p className="text-sm text-muted-foreground">
            Describe the type of legal template you want the AI to create. 
            The AI will also attempt to name the template and identify placeholders based on your description.
          </p>
          
          <div>
            <label htmlFor="template-category" className="text-sm font-medium">Category</label>
            <Select value={category} onValueChange={(value) => setCategory(value as DocumentTemplate['category'])}>
              <SelectTrigger id="template-category" className="mt-1">
                <SelectValue placeholder="Select a category..." />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="template-prompt" className="text-sm font-medium">Template Description / Prompt</label>
            <Textarea
              id="template-prompt"
              placeholder="e.g., A simple non-disclosure agreement with fields for Disclosing Party, Receiving Party, and Effective Date..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              disabled={isLoading}
              className="mt-1"
            />
          </div>

          <div>
             <label htmlFor="template-name" className="text-sm font-medium">Suggested Name (Optional)</label>
             <input 
                type="text"
                id="template-name"
                value={suggestedName}
                onChange={(e) => setSuggestedName(e.target.value)}
                placeholder="e.g., Client Engagement Letter"
                disabled={isLoading}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
             />
          </div>

          {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
          </DialogClose>
          <Button onClick={handleGenerate} disabled={isLoading || !prompt.trim() || !category}>
            {isLoading ? (
              <>
                <Sparkles className="animate-spin h-4 w-4 mr-2" />
                Generating...
              </>
            ) : (
              'Generate & Save Template'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewAITemplateGenModal; 