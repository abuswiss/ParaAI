import React, { useState, useEffect, useMemo } from 'react';
import { useAtomValue, useSetAtom, useAtom } from 'jotai';
import { DocumentMetadata } from '@/services/documentService';
import * as documentService from '@/services/documentService';
import { 
    activeCaseIdAtom,
    chatDocumentContextIdsAtom
} from '@/atoms/appAtoms';
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
import { FileText, Search, X, Check, List } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { cn } from '@/lib/utils';

interface DocumentContextPickerProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

const DocumentContextPicker: React.FC<DocumentContextPickerProps> = ({ 
    isOpen,
    onOpenChange,
 }) => {
  const activeCaseId = useAtomValue(activeCaseIdAtom);
  const [selectedContextIds, setSelectedContextIds] = useAtom(chatDocumentContextIdsAtom);
  
  const [modalSelectedIds, setModalSelectedIds] = useState<string[]>([]);
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
             setModalSelectedIds(selectedContextIds);
        } catch (err: any) {
             console.error("Error fetching documents for context picker:", err);
             setError("Failed to load documents.");
             setCaseDocuments([]);
        } finally {
            setLoading(false);
        }
      };
      fetchCaseDocuments();
    } else if (!isOpen) {
        setSearchTerm('');
        setModalSelectedIds([]);
        setError(null);
    }
  }, [isOpen, activeCaseId, selectedContextIds]);

  const filteredDocuments = useMemo(() => {
    if (!caseDocuments) return [];
    return caseDocuments.filter(doc =>
      doc.filename.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [caseDocuments, searchTerm]);

  const handleCheckboxChange = (docId: string) => {
    setModalSelectedIds(prev => 
        prev.includes(docId) 
            ? prev.filter(id => id !== docId) 
            : [...prev, docId]
    );
  };

  const handleConfirmSelection = () => {
    setSelectedContextIds(modalSelectedIds);
    onOpenChange(false);
  };
  
  const handleClearAll = () => {
      setModalSelectedIds([]);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Select Document Context</DialogTitle>
          <DialogDescription>
            Choose one or more documents to provide context for your chat.
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
                    {filteredDocuments.map(doc => (
                         <div key={doc.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent cursor-pointer" onClick={() => handleCheckboxChange(doc.id)}>
                            <Checkbox 
                                id={`doc-${doc.id}`}
                                checked={modalSelectedIds.includes(doc.id)}
                                onCheckedChange={() => handleCheckboxChange(doc.id)}
                            />
                             <Label 
                                htmlFor={`doc-${doc.id}`}
                                className={cn(
                                    "flex items-center flex-grow cursor-pointer text-sm",
                                    modalSelectedIds.includes(doc.id) ? "text-accent-foreground font-medium" : "text-muted-foreground"
                                )}
                             >
                                <FileText className="h-4 w-4 mr-2 flex-shrink-0"/> 
                                <span className="truncate">{doc.filename}</span>
                             </Label>
                         </div>
                     ))}
                 </div>
             )}
           </div>
        </ScrollArea>
        <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleConfirmSelection}>
                <Check className="h-4 w-4 mr-2"/> Confirm ({modalSelectedIds.length} selected)
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentContextPicker;