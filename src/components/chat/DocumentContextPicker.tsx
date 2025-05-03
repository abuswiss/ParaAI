import React, { useState, useEffect, useMemo } from 'react';
import { useAtomValue, useAtom } from 'jotai';
import { DocumentMetadata } from '@/services/documentService';
import * as documentService from '@/services/documentService';
import {
    activeCaseIdAtom,
    chatDocumentContextIdsAtom
} from '@/atoms/appAtoms';
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { FileText, Search, Check } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { cn } from '@/lib/utils';

interface DocumentContextPickerProps {
    onClose: () => void;
}

const DocumentContextPicker: React.FC<DocumentContextPickerProps> = ({ 
    onClose,
 }) => {
  const activeCaseId = useAtomValue(activeCaseIdAtom);
  const [selectedContextIds, setSelectedContextIds] = useAtom(chatDocumentContextIdsAtom);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caseDocuments, setCaseDocuments] = useState<DocumentMetadata[]>([]);
  
  useEffect(() => {
    if (activeCaseId) {
      const fetchCaseDocuments = async () => {
        setLoading(true);
        setError(null);
        try {
             const { data, error: fetchError } = await documentService.getUserDocuments(activeCaseId); 
             if (fetchError) throw fetchError;
             setCaseDocuments(data || []);
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
        setError("No case selected.");
        setCaseDocuments([]);
    }
  }, [activeCaseId]);

  const filteredDocuments = useMemo(() => {
    if (!caseDocuments) return [];
    return caseDocuments.filter(doc =>
      doc.filename.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [caseDocuments, searchTerm]);

  const handleCheckboxChange = (docId: string) => {
    setSelectedContextIds(prev => 
        prev.includes(docId) 
            ? prev.filter(id => id !== docId) 
            : [...prev, docId]
    );
  };

  return (
    <div className="flex flex-col space-y-4 pt-2">
      <div className="px-6 pb-2">
        <h3 className="text-lg font-semibold text-foreground">Select Document Context</h3>
        <p className="text-sm text-muted-foreground">
          Choose one or more documents to provide context for your chat.
        </p>
      </div>
      <div className="relative px-6">
          <Search className="absolute left-8 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
              placeholder="Search documents in this case..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
          />
      </div>
      <ScrollArea className="h-[300px] border rounded-md mx-6">
         <div className="p-4">
           {loading ? (
               <div className="flex justify-center items-center h-full">
                   <Spinner />
               </div>
           ) : error ? (
               <Alert variant="destructive" className="m-4">
                   <AlertDescription>{error}</AlertDescription>
               </Alert>
           ) : filteredDocuments.length === 0 ? (
               <p className="text-sm text-muted-foreground text-center py-4">
                   No documents found {searchTerm ? 'matching search' : (activeCaseId ? 'in this case' : ' - Please select a case first')}.
               </p>
           ) : (
               <div className="space-y-1">
                  {filteredDocuments.map(doc => (
                       <div key={doc.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent cursor-pointer">
                         <Label 
                            className={cn(
                                "flex items-center flex-grow cursor-pointer text-sm space-x-2",
                                selectedContextIds.includes(doc.id) ? "text-accent-foreground font-medium" : "text-muted-foreground"
                            )}
                         >
                            <Checkbox 
                                id={`doc-${doc.id}`}
                                checked={selectedContextIds.includes(doc.id)}
                                onCheckedChange={() => handleCheckboxChange(doc.id)}
                            />
                            <FileText className="h-4 w-4 flex-shrink-0"/> 
                            <span className="truncate flex-1">{doc.filename}</span>
                         </Label>
                       </div>
                   ))}
               </div>
           )}
         </div>
      </ScrollArea>
      <div className="flex justify-end space-x-2 pt-2 px-6 pb-4">
          <Button variant="outline" onClick={onClose}>Close</Button> 
      </div>
    </div>
  );
};

export default DocumentContextPicker;