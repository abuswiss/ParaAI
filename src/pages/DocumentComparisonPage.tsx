import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { activeCaseIdAtom } from '@/atoms/appAtoms'; // Removed currentCaseDocumentsAtom as it's not used
import { Document } from '@/types/document';
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ArrowLeft, Columns, Info, FileText, RotateCcw } from 'lucide-react';
import DocumentComparisonView from '@/components/documents/DocumentComparisonView'; // Import the view component
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { AlertTriangle } from 'lucide-react';
import * as documentService from '@/services/documentService';

const DocumentComparisonPage: React.FC = () => {
  const { caseId } = useParams<{ caseId: string }>();
  // activeCaseIdAtom is read from Jotai but not directly used in this component's logic after useParams. Consider if needed.
  // const activeCaseAtomValue = useAtomValue(activeCaseIdAtom); 
  const [documents, setDocuments] = useState<documentService.DocumentMetadata[]>([]);
  const [doc1Id, setDoc1Id] = useState<string | null>(null);
  const [doc2Id, setDoc2Id] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (caseId) {
      setIsLoading(true);
      documentService.getUserDocuments(caseId)
        .then(({ data, error: fetchError }) => {
          if (fetchError) {
            throw new Error(fetchError.message || 'Failed to fetch documents');
          }
          setDocuments(data as documentService.DocumentMetadata[] || []);
          setError(null);
        })
        .catch((err) => {
          console.error("Error fetching documents:", err);
          setError(err.message);
          setDocuments([]);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
        setError("No Case ID provided in URL.");
        setIsLoading(false);
    }
  }, [caseId]);

  const handleReset = () => {
    setDoc1Id(null);
    setDoc2Id(null);
    setError(null); // Clear any existing errors as well
    // The DocumentComparisonView component will unmount or its internal state will reset via its own useEffects
  };

  const canCompare = doc1Id && doc2Id && doc1Id !== doc2Id;

  console.log('[DocumentComparisonPage] doc1Id:', doc1Id);
  console.log('[DocumentComparisonPage] doc2Id:', doc2Id);
  console.log('[DocumentComparisonPage] canCompare:', canCompare);
  console.log('[DocumentComparisonPage] caseId from params:', caseId);
  console.log('[DocumentComparisonPage] documents state:', documents);

  return (
    <div className="container mx-auto p-4 md:p-6 flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <Button variant="outline" size="sm" asChild>
            <Link to={caseId ? `/files?caseId=${caseId}` : '/files'}> {/* Ensure link back to case view works correctly, possibly /files?caseId=... */}
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Case / Files
            </Link>
        </Button>
        <h1 className="text-xl font-semibold flex items-center gap-2">
            <Columns className="h-5 w-5" />
            Compare Documents for Case: {caseId || "N/A"}
        </h1>
        <Button variant="outline" size="sm" onClick={handleReset} title="Reset selections and view">
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset View
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Documents to Compare</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <div className="text-center p-4"><Spinner /> <p>Loading documents...</p></div>}
          {error && (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error Loading Documents</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!isLoading && !error && documents.length === 0 && (
             <p className="text-muted-foreground text-center p-4">No documents found for this case, or case ID is missing.</p>
          )}
          {!isLoading && !error && documents.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div>
                <label htmlFor="doc1-select" className="block text-sm font-medium text-muted-foreground mb-1">Document 1</label>
                <Select onValueChange={(value) => setDoc1Id(value === '__none__' ? null : value)} value={doc1Id ?? '__none__'}>
                  <SelectTrigger id="doc1-select">
                    <SelectValue placeholder="Select document 1..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" disabled>Select document 1...</SelectItem>
                    {documents.map((doc) => (
                      <SelectItem key={`doc1-${doc.id}`} value={doc.id} disabled={doc.id === doc2Id}>
                        <div className="flex items-center">
                          <FileText className="h-4 w-4 mr-2 opacity-60 flex-shrink-0" />
                          <span className="truncate flex-grow">{doc.filename}</span>
                          {doc.fileType && <span className="text-xs text-muted-foreground ml-2 opacity-80">{doc.fileType.toUpperCase()}</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label htmlFor="doc2-select" className="block text-sm font-medium text-muted-foreground mb-1">Document 2</label>
                <Select onValueChange={(value) => setDoc2Id(value === '__none__' ? null : value)} value={doc2Id ?? '__none__'}>
                  <SelectTrigger id="doc2-select">
                    <SelectValue placeholder="Select document 2..." />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="__none__" disabled>Select document 2...</SelectItem>
                    {documents.map((doc) => (
                      <SelectItem key={`doc2-${doc.id}`} value={doc.id} disabled={doc.id === doc1Id}>
                        <div className="flex items-center">
                          <FileText className="h-4 w-4 mr-2 opacity-60 flex-shrink-0" />
                          <span className="truncate flex-grow">{doc.filename}</span>
                          {doc.fileType && <span className="text-xs text-muted-foreground ml-2 opacity-80">{doc.fileType.toUpperCase()}</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
           )}
        </CardContent>
      </Card>

      <div> 
        {canCompare && caseId ? (
          <DocumentComparisonView doc1Id={doc1Id!} doc2Id={doc2Id!} caseId={caseId} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full bg-muted/30 rounded-lg border border-dashed border-border p-6 text-center">
            <Info className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-lg font-semibold text-muted-foreground">Select Two Different Documents</p>
            <p className="text-sm text-muted-foreground/80">Please use the dropdowns above to select two distinct documents from the case to begin the comparison.</p>
            {!caseId && <p className="text-red-500 mt-2">Error: Case ID is missing from the URL.</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentComparisonPage; 