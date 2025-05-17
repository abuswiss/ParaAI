import React, { useEffect, useState, useMemo } from 'react';
import { useCopilot } from '@/context/CopilotContext';
import { useCase } from '@/context/CaseContext'; // Assuming this path is correct
import { DocumentMetadata } from '@/types/document'; // Assuming this path and export are correct
import * as documentService from '@/services/documentService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card"; // Corrected casing
import { Checkbox } from "@/components/ui/Checkbox"; // Corrected casing
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/Input"; // Corrected casing
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert"; // Corrected casing
import { FileText, Search, Loader2, Inbox } from 'lucide-react';

const MAX_SELECTED_DOCUMENTS = 3;

// Mock document service if real one is not ready
// const mockDocumentService = {
//   getUserDocuments: async (caseId: string): Promise<{ data: DocumentMetadata[], error: Error | null }> => { // Changed 'any' to 'Error | null'
//     console.log(`Mock fetching documents for caseId: ${caseId}`);
//     await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
//     const mockDocs: DocumentMetadata[] = [
//       {
//         id: 'doc1', filename: 'Interrogatories Set 1.docx', caseId, userId: 'user1', uploadDate: new Date().toISOString(),
//         fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fileSize: 12345, status: 'processed',
//         title: 'Interrogatories Set 1', extractedText: '<p>Content for doc 1</p>',
//       },
//       {
//         id: 'doc2', filename: 'Client Affidavit.pdf', caseId, userId: 'user1', uploadDate: new Date().toISOString(),
//         fileType: 'application/pdf', fileSize: 67890, status: 'processed',
//         title: 'Client Affidavit', extractedText: 'PDF text for doc 2',
//       },
//       {
//         id: 'doc3', filename: 'Exhibit A - Contract.docx', caseId, userId: 'user1', uploadDate: new Date().toISOString(),
//         fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fileSize: 101112, status: 'processed',
//         title: 'Exhibit A - Contract', editedContent: '<p>Edited HTML content for doc 3</p>',
//       },
//       {
//         id: 'doc4', filename: 'Meeting Notes.txt', caseId, userId: 'user1', uploadDate: new Date().toISOString(),
//         fileType: 'text/plain', fileSize: 500, status: 'processed',
//         title: 'Meeting Notes', extractedText: 'Plain text for doc 4',
//       },
//       {
//         id: 'doc5', filename: 'Important Scan.jpeg', caseId, userId: 'user1', uploadDate: new Date().toISOString(),
//         fileType: 'image/jpeg', fileSize: 202420, status: 'pending',
//         title: 'Important Scan',
//       },
//        {
//         id: 'doc6', filename: 'FinancialStatement.xlsx', caseId, userId: 'user1', uploadDate: new Date().toISOString(),
//         fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileSize: 303630, status: 'processed',
//         title: 'Financial Statement Q1',
//       },
//     ];
//     return { data: mockDocs, error: null };
//   }
// };

const MultiDocumentSelector: React.FC = () => {
  const { selectedDocumentIds, setSelectedDocumentIds } = useCopilot(); // Removed fetchAndSetSelectedDocumentsContent
  const { activeCase } = useCase();
  const [availableDocuments, setAvailableDocuments] = useState<DocumentMetadata[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(false);
  const [errorDocs, setErrorDocs] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setIsLoadingDocs(true);
    setErrorDocs(null);
    setAvailableDocuments([]);

    documentService.getUserDocuments(activeCase?.id)
      .then(({ data, error }) => {
        if (error) {
          setErrorDocs(error.message || 'Failed to fetch documents');
          setAvailableDocuments([]);
        } else {
          setAvailableDocuments(data || []);
        }
      })
      .catch(err => {
        console.error("Error fetching documents for selector:", err);
        setErrorDocs(err.message || 'An unexpected error occurred while fetching documents.');
        setAvailableDocuments([]);
      })
      .finally(() => {
        setIsLoadingDocs(false);
      });
  }, [activeCase?.id]);

  const handleCheckboxChange = (documentId: string) => {
    const currentIndex = selectedDocumentIds.indexOf(documentId);
    const newSelectedDocumentIds = [...selectedDocumentIds]; // Changed to const, will modify array content, not reassign itself

    if (currentIndex === -1) {
      if (newSelectedDocumentIds.length < MAX_SELECTED_DOCUMENTS) {
        newSelectedDocumentIds.push(documentId);
      }
    } else {
      newSelectedDocumentIds.splice(currentIndex, 1);
    }
    setSelectedDocumentIds(newSelectedDocumentIds);
  };

  const filteredDocuments = useMemo(() => {
    return availableDocuments.filter(doc =>
      doc.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.title && doc.title.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [availableDocuments, searchTerm]);

  return (
    <Card className="shadow-lg dark:bg-slate-800/70 border dark:border-slate-700/50">
      <CardHeader>
        <CardTitle className="flex items-center"><FileText className="mr-2 h-5 w-5 text-primary" />Select Documents (Up to {MAX_SELECTED_DOCUMENTS})</CardTitle>
        <CardDescription>Choose relevant documents for the AI to analyze. Processed documents with text content are available.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search documents by name or title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 w-full"
          />
        </div>

        {isLoadingDocs && (
          <div className="flex items-center justify-center p-6 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            <span>Loading documents...</span>
          </div>
        )}

        {errorDocs && (
          <Alert variant="destructive">
            <FileText className="h-4 w-4" />
            <AlertTitle>Error Loading Documents</AlertTitle>
            <AlertDescription>{errorDocs}</AlertDescription>
          </Alert>
        )}

        {!isLoadingDocs && !errorDocs && availableDocuments.length === 0 && (
            <Alert>
                <Inbox className="h-4 w-4"/>
                <AlertTitle>No Usable Documents Found</AlertTitle>
                <AlertDescription>
                    There are no processed documents with extractable text content available for the active case. 
                    Please upload and process documents first.
                </AlertDescription>
            </Alert>
        )}
        
        {!isLoadingDocs && !errorDocs && availableDocuments.length > 0 && filteredDocuments.length === 0 && (
             <Alert variant="default">
                <Search className="h-4 w-4"/>
                <AlertTitle>No Documents Match Your Search</AlertTitle>
                <AlertDescription>
                    Try a different search term or clear the search to see all available documents.
                </AlertDescription>
            </Alert>
        )}

        {!isLoadingDocs && !errorDocs && filteredDocuments.length > 0 && (
          <ScrollArea className="h-64 border dark:border-slate-700 rounded-md p-1">
            <div className="p-3 space-y-1">
            {filteredDocuments.map(doc => (
              <div
                key={doc.id}
                className={`flex items-center space-x-3 p-2.5 rounded-md hover:bg-muted/50 dark:hover:bg-slate-700/50 transition-colors 
                            ${selectedDocumentIds.includes(doc.id) ? 'bg-primary/10 dark:bg-primary/20' : 'bg-transparent'}`}
              >
                <Checkbox
                  id={`doc-${doc.id}`}
                  checked={selectedDocumentIds.includes(doc.id)}
                  onCheckedChange={() => handleCheckboxChange(doc.id)}
                  disabled={!selectedDocumentIds.includes(doc.id) && selectedDocumentIds.length >= MAX_SELECTED_DOCUMENTS}
                  aria-label={`Select document ${doc.filename}`}
                  className="transition-all transform active:scale-95"
                />
                <label
                  htmlFor={`doc-${doc.id}`}
                  className="flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer truncate"
                  title={doc.filename}
                >
                  {doc.filename}
                  <p className="text-xs text-muted-foreground dark:text-slate-400 truncate">
                    {doc.title || 'No title'} - {Math.round(doc.fileSize / 1024)} KB
                  </p>
                </label>
              </div>
            ))}
            </div>
          </ScrollArea>
        )}
        
        {selectedDocumentIds.length > 0 && (
            <div className="mt-3 pt-3 border-t dark:border-slate-700">
                <p className="text-sm font-medium text-muted-foreground dark:text-slate-300">
                    {selectedDocumentIds.length} of {MAX_SELECTED_DOCUMENTS} documents selected.
                </p>
            </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MultiDocumentSelector; 