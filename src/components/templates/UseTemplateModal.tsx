import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as templateService from '@/services/templateService';
import { DocumentTemplate } from '@/services/templateService';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter, 
  DialogClose 
} from '@/components/ui/dialog';
import TiptapEditor from '../editor/TiptapEditor';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { extractVariables } from '@/lib/utils';

interface UseTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: string | null;
}

const UseTemplateModal: React.FC<UseTemplateModalProps> = ({ isOpen, onClose, templateId }) => {
  const navigate = useNavigate();
  const [template, setTemplate] = useState<DocumentTemplate | null>(null);
  const [variables, setVariables] = useState<string[]>([]);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !templateId) {
        setTemplate(null);
        setVariables([]);
        setVariableValues({});
        setError(null);
        setIsLoading(false);
        return;
    }

    setIsLoading(true);
    setError(null);
    setTemplate(null);
    setVariables([]);
    setVariableValues({});

    templateService.getTemplateById(templateId)
      .then(({ data, error: fetchError }) => {
        if (fetchError) throw fetchError;
        if (data) {
          setTemplate(data);
          const extracted = extractVariables(data.content || '');
          setVariables(extracted);
          const initialValues: Record<string, string> = {};
          extracted.forEach(v => { initialValues[v] = '' });
          setVariableValues(initialValues);
        } else {
          throw new Error('Template not found.');
        }
      })
      .catch(err => {
        console.error("Error fetching template for use:", err);
        setError("Failed to load template details.");
      })
      .finally(() => setIsLoading(false));
      
  }, [isOpen, templateId]);

  const handleInputChange = (variableName: string, value: string) => {
    setVariableValues(prev => ({ ...prev, [variableName]: value }));
    if (error && !error.includes('load')) setError(null);
  };

  const handleCreateDraft = async () => {
    if (!template || !templateId) return;
    
    const unfilledVariables = variables.filter(v => !variableValues[v]?.trim());
    if (unfilledVariables.length > 0) {
        setError(`Please fill in all variables: ${unfilledVariables.join(', ')}`);
        return;
    }
    
    setIsCreatingDraft(true);
    setError(null);
    const draftName = `${template.name || 'Template'} Draft - ${new Date().toLocaleString()}`;

    try {
      const { data: newDraft, error: createError } = await templateService.createDraftFromTemplate(
        templateId,
        draftName,
        variableValues,
      );

      if (createError) throw createError;
      
      if (newDraft?.id) {
        console.log('Draft created:', newDraft.id);
        onClose(); 
        navigate(`/documents/${newDraft.id}`);
      } else {
          throw new Error('Failed to create draft: No ID returned.');
      }

    } catch (err) {
      console.error("Error creating draft from template:", err);
      setError(err instanceof Error ? err.message : "Failed to create draft.");
    } finally {
      setIsCreatingDraft(false);
    }
  };

  const renderVariableInput = (varName: string) => {
    const isLongInput = varName.toLowerCase().includes('address') || 
                        varName.toLowerCase().includes('description') || 
                        varName.toLowerCase().includes('notes') || 
                        varName.toLowerCase().includes('clause');
    
    return (
      <div key={varName} className="mb-3">
        <Label htmlFor={`var-${varName}`} className="capitalize mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {varName.replace(/_/g, ' ')}
        </Label>
        {isLongInput ? (
          <Textarea
            id={`var-${varName}`}
            value={variableValues[varName] || ''}
            onChange={(e) => handleInputChange(varName, e.target.value)}
            placeholder={`Enter value for ${varName}`}
            disabled={isCreatingDraft || isLoading}
            className="w-full mt-1"
            rows={3}
          />
        ) : (
          <Input
            id={`var-${varName}`}
            value={variableValues[varName] || ''}
            onChange={(e) => handleInputChange(varName, e.target.value)}
            placeholder={`Enter value for ${varName}`}
            disabled={isCreatingDraft || isLoading}
            className="w-full mt-1"
          />
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isCreatingDraft && onClose()}> 
      <DialogContent className="max-w-4xl"> 
        <DialogHeader>
          <DialogTitle>Use Template: {template?.name || 'Loading...'}</DialogTitle>
          {template?.description && <DialogDescription>{template.description}</DialogDescription>}
        </DialogHeader>
       
        <div className="grid md:grid-cols-2 gap-6 py-4 max-h-[70vh]"> 
            <div className="flex flex-col border rounded-lg overflow-hidden">
                <h3 className="text-sm font-medium p-3 border-b bg-muted/50 flex-shrink-0">Preview</h3>
                <ScrollArea className="flex-grow p-1 bg-background">
                    {isLoading && (
                        <div className="p-4 space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-5/6" />
                        </div>
                    )}
                    {!isLoading && template?.content && (
                        <TiptapEditor
                            content={template.content}
                            editable={false}
                            className="p-3 text-sm min-h-[200px]"
                            placeholder=""
                        />
                    )}
                    {!isLoading && !template?.content && (
                        <p className="p-4 text-center text-muted-foreground italic">No content found.</p>
                    )}
                     {isLoading && !templateId && (
                         <p className="p-4 text-center text-muted-foreground italic">Select a template.</p>
                     )}
                </ScrollArea>
            </div>

            <div className="flex flex-col border rounded-lg overflow-hidden">
                <h3 className="text-sm font-medium p-3 border-b bg-muted/50 flex-shrink-0">Fill Variables</h3>
                <ScrollArea className="flex-grow p-4">
                    {isLoading && (
                       <div className="space-y-4">
                           <div className="space-y-1">
                               <Skeleton className="h-3 w-1/4" />
                               <Skeleton className="h-8 w-full" />
                           </div>
                           <div className="space-y-1">
                               <Skeleton className="h-3 w-1/3" />
                               <Skeleton className="h-8 w-full" />
                           </div>
                       </div>
                    )}
                    {!isLoading && error && error.includes('load') && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Error Loading Template</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    {!isLoading && !error && template && (
                        <> 
                            {variables.length === 0 ? (
                                <p className="text-center text-muted-foreground py-4 italic">This template has no variables to fill.</p>
                            ) : (
                                variables.map(renderVariableInput)
                            )}
                            {error && !error.includes('load') && (
                                <Alert variant="destructive" className="mt-3">
                                     <AlertTriangle className="h-4 w-4" />
                                     <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}
                        </>
                    )}
                    {!isLoading && !template && !error && (
                        <p className="p-4 text-center text-muted-foreground italic">Template details not available.</p>
                    )}
                </ScrollArea>
            </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
             <Button variant="outline" onClick={onClose} disabled={isCreatingDraft}>Cancel</Button>
          </DialogClose>
          <Button 
            onClick={handleCreateDraft} 
            disabled={isLoading || isCreatingDraft || !template || (variables.length > 0 && variables.some(v => !variableValues[v]?.trim()))}
          >
            {isCreatingDraft ? <Spinner size="sm" className="mr-2" /> : null}
            {isCreatingDraft ? 'Creating Draft...' : 'Create Document Draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UseTemplateModal; 