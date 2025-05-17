import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAtom } from 'jotai';
import { chatDocumentContextIdsAtom } from '@/atoms/appAtoms';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { searchDocumentsByName } from '@/services/documentService';
import { type DocumentMetadata } from '@/types/document';
import { Loader2 } from 'lucide-react';
import { debounce } from 'lodash';

interface DocumentContextPickerProps {
  onClose?: () => void;
  caseId: string;
}

export function DocumentContextPicker({
  onClose,
  caseId,
}: DocumentContextPickerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<DocumentMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useAtom(
    chatDocumentContextIdsAtom
  );
  const { toast } = useToast();

  const debouncedSearch = useMemo(
    () =>
      debounce(async (term: string) => {
        if (term.length < 2) {
          setSearchResults([]);
          setIsLoading(false);
          return;
        }
        setIsLoading(true);
        try {
          const { data: results, error } = await searchDocumentsByName(term, caseId);
          if (error) throw error;
          setSearchResults(results || []);
        } catch (error) {
          console.error('Error searching documents:', error);
          toast({
            title: 'Error Searching Documents',
            description:
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (error as any)?.message || 'An unknown error occurred.',
            variant: 'destructive',
          });
          setSearchResults([]);
        } finally {
          setIsLoading(false);
        }
      }, 300),
    [caseId, toast]
  );

  useEffect(() => {
    debouncedSearch(searchTerm);
    // Cleanup function to cancel debounced call if component unmounts or searchTerm changes quickly
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchTerm, debouncedSearch]);

  const handleCheckboxChange = useCallback(
    (checked: boolean | 'indeterminate', document: DocumentMetadata) => {
      setSelectedDocuments((prev) => {
        const newSet = new Set(prev);
        if (checked === true) {
          newSet.add(document);
        } else {
          newSet.delete(document);
        }
        return newSet;
      });
    },
    [setSelectedDocuments]
  );

  return (
    <div className="flex flex-col space-y-4 p-4 bg-background border rounded-md shadow-lg max-w-md mx-auto">
      <h3 className="text-lg font-semibold text-foreground">
        Select Context Documents
      </h3>
      <Input
        placeholder="Search documents..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="text-foreground bg-input border-border"
      />
      <ScrollArea className="h-60 border border-border rounded-md">
        <div className="p-4 space-y-2">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : searchResults.length > 0 ? (
            searchResults.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md"
              >
                <Checkbox
                  id={`doc-${doc.id}`}
                  checked={selectedDocuments.has(doc)}
                  onCheckedChange={(checked) =>
                    handleCheckboxChange(checked, doc)
                  }
                  className="border-border"
                />
                <Label
                  htmlFor={`doc-${doc.id}`} // Corrected prop name
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer text-foreground"
                >
                  {doc.title || doc.fileName || 'Untitled Document'}
                </Label>
              </div>
            ))
          ) : searchTerm.length > 1 ? (
            <p className="text-sm text-muted-foreground text-center">
              No documents found for "{searchTerm}".
            </p>
          ) : (
            <p className="text-sm text-muted-foreground text-center">
              Enter at least 2 characters to search.
            </p>
          )}
        </div>
      </ScrollArea>
      <div className="flex justify-end space-x-2 pt-2">
        <Button
          variant="ghost"
          onClick={onClose}
          className="text-foreground hover:bg-muted"
        >
          Close
        </Button>
      </div>
    </div>
  );
} 