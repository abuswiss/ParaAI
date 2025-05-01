import React, { useState, useEffect, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { DocumentMetadata } from '@/services/documentService';
import * as documentService from '@/services/documentService';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter, 
    DialogTrigger, 
    DialogClose 
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Folder, FileText, Paperclip, Search, X } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { cn } from '@/lib/utils';

interface DocumentContextPickerProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSelectContext: (contextId: string | null) => void;
    activeCaseId: string | null;
    currentContextId: string | null;
}

const DocumentContextPicker: React.FC<DocumentContextPickerProps> = ({ 
    isOpen,
    onOpenChange,
    onSelectContext,
    activeCaseId, 
    currentContextId
 }) => {
  const [selectedContextId, setSelectedContextId] = useState<string | null>(currentContextId);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caseDocuments, setCaseDocuments] = useState<DocumentMetadata[]>([]);
  
  useEffect(() => {
    if (isOpen && activeCaseId) {
      const fetchCaseDocuments = async () => {
        setLoading(true);
        setError(null);
        try {
             const { data, error: fetchError } = await documentService.getUserDocuments(activeCaseId); 
             if (fetchError) throw fetchError;
             setCaseDocuments(data || []);
             setSelectedContextId(currentContextId);
        } catch (err: any) {
             console.error("Error fetching documents for context picker:", err);
             setError("Failed to load documents.");
             setCaseDocuments([]);
        } finally {
            setLoading(false);
        }
      };
      fetchCaseDocuments();
    } else {
        setSearchTerm('');
        setCaseDocuments([]);
        setSelectedContextId(null);
    }
  }, [isOpen, activeCaseId, currentContextId]);

  const filteredDocuments = useMemo(() => {
    if (!caseDocuments) return [];
    return caseDocuments.filter(doc =>
      doc.filename.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [caseDocuments, searchTerm]);

  const handleSelection = (docId: string) => {
    setSelectedContextId(docId);
    onSelectContext(docId);
    onOpenChange(false);
  };

  const handleClearSelection = () => {
    setSelectedContextId(null);
    onSelectContext(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Select Document Context</DialogTitle>
          <DialogDescription>
            Choose a single document to provide context for your chat.
          </DialogDescription>
        </DialogHeader>
        <div className="relative my-4">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Search documents in this case..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
            />
        </div>
        <ScrollArea className="h-[300px] border rounded-md">
           <div className="p-4">
             {loading ? (
                 <div className="flex justify-center items-center h-full">
                     <Spinner />
                 </div>
             ) : error ? (
                 <Alert variant="destructive">
                     <AlertDescription>{error}</AlertDescription>
                 </Alert>
             ) : filteredDocuments.length === 0 ? (
                 <p className="text-sm text-muted-foreground text-center py-4">
                     No documents found {searchTerm ? 'matching search' : (activeCaseId ? 'in this case' : ' - Please select a case first')}.
                 </p>
             ) : (
                 <div className="space-y-1">
                     <Button 
                        variant="ghost"
                        onClick={handleClearSelection}
                        className={cn(
                            "w-full justify-start px-2 py-1.5 text-sm",
                            !selectedContextId ? "text-primary font-medium" : "text-muted-foreground"
                        )}
                     >
                        <X className="h-4 w-4 mr-2"/> No Context
                     </Button>
                     {filteredDocuments.map(doc => (
                         <Button 
                            key={doc.id}
                            variant="ghost"
                            onClick={() => handleSelection(doc.id)}
                            className={cn(
                                "w-full justify-start px-2 py-1.5 text-sm",
                                selectedContextId === doc.id ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground"
                             )}
                         >
                             <FileText className="h-4 w-4 mr-2 flex-shrink-0"/> 
                             <span className="truncate">{doc.filename}</span>
                         </Button>
                     ))}
                 </div>
             )}
           </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentContextPicker;