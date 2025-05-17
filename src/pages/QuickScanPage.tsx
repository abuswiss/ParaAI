import React, { useState, useEffect, useCallback } from 'react';
import { useAtomValue, useAtom } from 'jotai';
import { activeCaseIdAtom, uploadModalOpenAtom, activeEditorItemAtom } from '@/atoms/appAtoms';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { useAuth } from '@/hooks/useAuth';
import * as documentService from '@/services/documentService';
import { type DocumentMetadata } from '@/services/documentService';
import UploadModal from '@/components/documents/UploadModal';
import { FileText, RotateCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ScanResult {
  overview: string;
  documentType: string;
  keyEntities: string[];
  mainTopics: string[];
}

// Skeleton Card for loading state
const SkeletonCard: React.FC = () => (
  <Card className="shadow-sm animate-pulse bg-background dark:bg-neutral-800">
    <CardHeader>
      <CardTitle className="text-base h-6 bg-neutral-300 dark:bg-neutral-700 rounded w-3/4"></CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="h-4 bg-neutral-300 dark:bg-neutral-700 rounded w-full"></div>
      <div className="h-4 bg-neutral-300 dark:bg-neutral-700 rounded w-5/6"></div>
      <div className="h-4 bg-neutral-300 dark:bg-neutral-700 rounded w-full"></div>
      <div className="h-4 bg-neutral-300 dark:bg-neutral-700 rounded w-4/5"></div>
    </CardContent>
  </Card>
);

// Component for individual result card with expandability
interface ResultCardProps {
  title: string;
  items?: string[] | string; // Can be a single string (overview, doc type) or array (entities, topics)
  initiallyExpanded?: boolean;
}

const ResultCard: React.FC<ResultCardProps> = ({ title, items, initiallyExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  const displayItems = Array.isArray(items) ? items : (items ? [items] : []);
  const canExpand = Array.isArray(items) && items.length > 3;
  const itemsToShow = canExpand && !isExpanded ? displayItems.slice(0, 3) : displayItems;

  if (!items || (Array.isArray(items) && items.length === 0 && title !== "Key Entities" && title !== "Main Topics")) {
    // Don't render card if no items, unless it's entities/topics which show a message
    if (title === "Quick Overview" || title === "Detected Document Type") return null;
  }

  return (
    <Card className="shadow-sm flex flex-col"> {/* Added flex flex-col for equal height */}
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm flex-grow"> {/* Added flex-grow */}
        {typeof items === 'string' && <p>{items}</p>}
        {Array.isArray(items) && items.length > 0 && (
          <ul className="list-disc pl-5 space-y-1">
            {itemsToShow.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        )}
        {Array.isArray(items) && items.length === 0 && (title === "Key Entities" || title === "Main Topics") && (
          <p className="text-muted-foreground italic">
            {title === "Key Entities" ? "No key entities detected." : "No main topics detected."}
          </p>
        )}
        {canExpand && (
          <Button variant="link" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="mt-2 px-0">
            {isExpanded ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
            {isExpanded ? 'Show Less' : `Show More (${items.length - 3} more)`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

const QuickScanPage: React.FC = () => {
  const activeCaseId = useAtomValue(activeCaseIdAtom);
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [documentIdToScan, setDocumentIdToScan] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [caseDocuments, setCaseDocuments] = useState<DocumentMetadata[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useAtom(uploadModalOpenAtom);
  const activeEditorItem = useAtomValue(activeEditorItemAtom);

  const fetchCaseDocuments = useCallback(async () => {
    if (activeCaseId) {
      setIsLoadingDocuments(true);
      setError(null);
      try {
        const { data, error: fetchError } = await documentService.getUserDocuments(activeCaseId);
        if (fetchError) throw fetchError;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setCaseDocuments(data as any || []); // TEMP: any cast to suppress linter error due to type mismatch
      } catch (err) {
        console.error("Error fetching case documents:", err);
        setError(err instanceof Error ? err.message : "Failed to load documents for case.");
        setCaseDocuments([]);
      } finally {
        setIsLoadingDocuments(false);
      }
    } else {
      setCaseDocuments([]);
    }
  }, [activeCaseId]);

  useEffect(() => {
    fetchCaseDocuments();
  }, [fetchCaseDocuments]);

  useEffect(() => {
    if (activeEditorItem?.type === 'document' && activeEditorItem.id) {
      // (No-op for now, or add logic here if needed)
    }
  }, [activeEditorItem, caseDocuments]);

  const handleUploadModalClose = useCallback((refreshNeeded?: boolean) => {
    setIsUploadModalOpen(false);
    if (refreshNeeded) {
      fetchCaseDocuments();
    }
  }, [setIsUploadModalOpen, fetchCaseDocuments]);

  const handlePerformScan = async () => {
    if (!activeCaseId) {
      setError("No active case selected.");
      return;
    }
    if (!documentIdToScan) {
      setError("Please select a document to scan.");
      return;
    }
    if (!session?.access_token) {
      setError("Authentication required. Please ensure you are logged in.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setScanResult(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const requestBody = { documentId: documentIdToScan, caseId: activeCaseId };
      console.log(`Scanning existing document ID: ${documentIdToScan}`);

      let response: Response;
      try {
        response = await fetch(`${supabaseUrl}/functions/v1/quick-scan-document`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(requestBody),
        });
      } catch (networkErr) {
        console.error('Network error while performing quick scan:', networkErr);
        setError('Network error. Please check your connection and try again.');
        return;
      }

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (parseErr) {
          console.error('Failed to parse error response:', parseErr);
        }
        throw new Error(errorMessage);
      }

      let result: ScanResult;
      try {
        result = await response.json();
      } catch (parseErr) {
        console.error('Failed to parse scan result:', parseErr);
        setError('Received malformed response from the service.');
        return;
      }
      setScanResult(result);

    } catch (err) {
      console.error("Error performing quick scan:", err);
      setError(err instanceof Error ? err.message : "An unknown service error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const canScan = !!activeCaseId && !!documentIdToScan && !isLoading && !authLoading;

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Quick Document Scan</h1>
        <Button variant="outline" onClick={fetchCaseDocuments} disabled={isLoadingDocuments || !activeCaseId}>
            <RotateCw className={`mr-2 h-4 w-4 ${isLoadingDocuments ? 'animate-spin' : ''}`} />
            Refresh List
        </Button>
      </div>
      
      {!activeCaseId && !authLoading && (
        <Alert variant="default" className="bg-amber-50 border-amber-200 text-amber-700">
          <AlertDescription>No active case selected. Please select a case from the dashboard or sidebar to use the Quick Scan feature.</AlertDescription>
        </Alert>
      )}
      {authLoading && (
         <div className="flex items-center justify-center p-4">
            <Spinner /> <span className="ml-2">Loading authentication...</span>
         </div>
      )}

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Select Document for Scanning</CardTitle>
          <p className="text-sm text-muted-foreground">
            Choose an existing document from the current case.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Select Existing Document</Label>
            {isLoadingDocuments ? (
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Spinner size="xs" /> <span>Loading documents...</span>
              </div>
            ) : caseDocuments.length > 0 ? (
              <div id="existing-doc-list" className="max-h-60 overflow-y-auto border rounded-md divide-y divide-border bg-background">
                {caseDocuments.map(doc => (
                  <button
                    key={doc.id}
                    type="button"
                    className={`w-full flex items-center px-4 py-2 text-left hover:bg-muted focus:bg-primary/10 transition-colors ${documentIdToScan === doc.id ? 'bg-primary/10 font-semibold text-primary' : ''}`}
                    onClick={() => setDocumentIdToScan(doc.id)}
                    disabled={isLoading || authLoading}
                  >
                    <FileText className="h-4 w-4 mr-2 opacity-70 flex-shrink-0" />
                    <span className="truncate flex-1">{doc.filename}</span>
                    <span className="text-xs text-muted-foreground ml-2">{doc.fileType ? doc.fileType.toUpperCase() : 'Unknown'}</span>
                    {documentIdToScan === doc.id && <span className="ml-2 text-xs text-primary font-bold">Selected</span>}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                {activeCaseId ? "No documents found in this case." : "Select a case to see documents."}
              </p>
            )}
          </div>
          <Button onClick={handlePerformScan} disabled={!canScan} className="w-full mt-6 py-3">
            {isLoading ? <Spinner size="sm" className="mr-2" /> : null}
            Scan Selected Document
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading && !scanResult && (
        <div className="mt-8 p-6 border border-dashed border-border dark:border-neutral-700 rounded-lg bg-muted/20 dark:bg-neutral-800/30">
          <div className="flex flex-col items-center justify-center mb-6">
            <Spinner size="lg" className="text-primary mb-3" />
            <h2 className="text-2xl font-semibold text-foreground text-center">Scanning Document...</h2>
            <p className="text-muted-foreground text-center mt-1">Please wait, this may take a few moments.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      )}

      {scanResult && (
        <div className="space-y-6 mt-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-foreground">Scan Results</h2>
            {activeCaseId && documentIdToScan && (
              <Button 
                variant="default" 
                onClick={() => navigate(`/review/document/${documentIdToScan}`)}
                title="Open document in reviewer"
              >
                <FileText className="mr-2 h-4 w-4" /> Open in Document Reviewer
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ResultCard title="Quick Overview" items={scanResult.overview} />
            <ResultCard title="Detected Document Type" items={scanResult.documentType} />
            <ResultCard title="Key Entities" items={scanResult.keyEntities} />
            <ResultCard title="Main Topics" items={scanResult.mainTopics} />
          </div>
        </div>
      )}
      {isUploadModalOpen && <UploadModal isOpen={isUploadModalOpen} onClose={handleUploadModalClose} />}
    </div>
  );
};

export default QuickScanPage;  