import React, { useState, useEffect } from 'react';
import { DocumentTemplate, getTemplateById } from '@/services/templateService';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { AlertTriangle, Edit2 } from 'lucide-react';
import TiptapEditor from '../editor/TiptapEditor';
import { cn } from "@/lib/utils";

interface TemplatePreviewProps {
  templateId: string | null;
  onEdit: (templateId: string) => void;
}

const TemplatePreview: React.FC<TemplatePreviewProps> = ({ templateId, onEdit }) => {
  const [template, setTemplate] = useState<DocumentTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (templateId) {
      setIsLoading(true);
      setError(null);
      setTemplate(null);

      getTemplateById(templateId)
        .then(({ data, error: fetchError }) => {
          if (fetchError) throw fetchError;
          if (data) {
            setTemplate(data);
          } else {
            throw new Error('Template not found.');
          }
        })
        .catch(err => {
          console.error("Error fetching template for preview:", err);
          setError("Failed to load template preview.");
        })
        .finally(() => setIsLoading(false));
    } else {
        setTemplate(null);
        setError(null);
        setIsLoading(false);
    }
  }, [templateId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full p-4">
        <Spinner size="md" />
        <span className="ml-2 text-muted-foreground">Loading Preview...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Preview</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!template) {
    return <div className="p-4 text-center text-muted-foreground italic">Select a template to preview.</div>;
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex justify-between items-center p-4 border-b border-border flex-shrink-0">
        <h2 className="text-lg font-semibold text-foreground truncate mr-4" title={template.name}>
          {template.name}
        </h2>
        <Button variant="outline" size="sm" onClick={() => onEdit(template.id)}>
          <Edit2 className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>
      
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        <div className="space-y-3">
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase">Category</span>
            <p className="text-sm text-foreground capitalize">{template.category}</p>
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase">Description</span>
            <p className="text-sm text-foreground">
              {template.description || <span className="italic text-muted-foreground">No description provided.</span>}
            </p>
          </div>
          {template.tags && template.tags.length > 0 && (
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase">Tags</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {template.tags.map(tag => (
                   <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
         <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground uppercase block">Content Preview</span>
          <div className="rounded-md border border-border bg-muted/30 overflow-hidden">
             <TiptapEditor
                  content={template.content || '<p class="text-muted-foreground italic p-4">No content</p>'}
                  editable={false}
                  className="bg-transparent border-0 shadow-none"
                  placeholder="Loading template content..."
             />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplatePreview; 