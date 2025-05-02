"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/Spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { getAvailableTemplates, TemplateMetadata } from '@/services/templateService'; // Changed import
import { FileText, Search, AlertCircle } from 'lucide-react';

interface TemplateSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplateSelect: (templateId: string) => void;
}

const TemplateSelectorModal: React.FC<TemplateSelectorModalProps> = ({
  isOpen,
  onClose,
  onTemplateSelect,
}) => {
  const [templates, setTemplates] = useState<TemplateMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      // Reset state when modal opens
      setSearchTerm('');
      setSelectedTemplateId(null);
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await getAvailableTemplates(); // Use the correct function
      if (fetchError) throw fetchError;
      setTemplates(data || []);
    } catch (err) {
      console.error("Error fetching templates:", err);
      setError(err instanceof Error ? err.message : "Failed to load templates.");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTemplates = useMemo(() => {
    if (!searchTerm) {
      return templates;
    }
    const lowerCaseSearch = searchTerm.toLowerCase();
    return templates.filter(
      (template) =>
        template.name.toLowerCase().includes(lowerCaseSearch) ||
        (template.description && template.description.toLowerCase().includes(lowerCaseSearch))
    );
  }, [templates, searchTerm]);

  const handleSelect = () => {
    if (selectedTemplateId) {
      onTemplateSelect(selectedTemplateId);
      onClose(); // Close modal after selection
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select a Template</DialogTitle>
          <DialogDescription>
            Choose a template to start drafting your document.
          </DialogDescription>
        </DialogHeader>
        <div className="relative mb-4">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search templates by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 w-full"
          />
        </div>
        <div className="flex-grow overflow-hidden border rounded-md">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-1">
              {isLoading && (
                <div className="flex justify-center items-center h-40">
                  <Spinner />
                </div>
              )}
              {error && (
                <Alert variant="destructive" className="m-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error Loading Templates</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {!isLoading && !error && filteredTemplates.length === 0 && (
                <div className="text-center text-muted-foreground p-4">
                  No templates found{searchTerm ? " matching your search" : ""}.
                </div>
              )}
              {!isLoading && !error && filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className={`flex items-center p-2 rounded-md cursor-pointer transition-colors ${
                    selectedTemplateId === template.id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedTemplateId(template.id)}
                  onDoubleClick={handleSelect} // Allow double click to select
                >
                  <FileText className="h-4 w-4 mr-3 flex-shrink-0" />
                  <div className="flex-grow overflow-hidden">
                    <p className="text-sm font-medium truncate">{template.name}</p>
                    {template.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {template.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSelect} disabled={!selectedTemplateId || isLoading}>
            Use Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TemplateSelectorModal; 