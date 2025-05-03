import React, { useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import { chatDocumentContextIdsAtom } from '@/atoms/appAtoms';
import { getDocumentById } from '@/services/documentService'; // Assuming a function to get doc details by ID
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { X, FileText, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/Tooltip";

interface DocumentInfo {
    id: string;
    filename: string;
}

interface DocumentContextDisplayProps {
    // We'll read directly from the atom for simplicity here,
    // but passing as prop might be cleaner depending on structure
    isLoading?: boolean; // Pass down loading state from parent if needed
}

const DocumentContextDisplay: React.FC<DocumentContextDisplayProps> = ({ isLoading }) => {
    const [selectedContextIds, setSelectedContextIds] = useAtom(chatDocumentContextIdsAtom);
    const [documentsInfo, setDocumentsInfo] = useState<DocumentInfo[]>([]);
    const [isFetchingNames, setIsFetchingNames] = useState(false);

    useEffect(() => {
        if (selectedContextIds.length > 0) {
            setIsFetchingNames(true);
            const fetchNames = async () => {
                const fetchedDocs: DocumentInfo[] = [];
                // Fetch details for only the IDs not already in documentsInfo to avoid refetching
                const idsToFetch = selectedContextIds.filter(id => !documentsInfo.some(doc => doc.id === id));
                
                if (idsToFetch.length > 0) {
                    try {
                        const results = await Promise.all(
                            idsToFetch.map(async (id) => {
                                const { data, error } = await getDocumentById(id);
                                if (!error && data) {
                                    return { id: data.id, filename: data.filename };
                                }
                                console.warn(`Could not fetch details for doc ID: ${id}`, error);
                                return { id, filename: `ID: ${id}` }; // Fallback to ID
                            })
                        );
                         // Combine newly fetched with existing ones that are still selected
                         const currentDocs = documentsInfo.filter(doc => selectedContextIds.includes(doc.id));
                         setDocumentsInfo([...currentDocs, ...results]);
                    } catch (error) { 
                        console.error("Error fetching document names for context display:", error);
                         // Set info with IDs as fallback on error
                         setDocumentsInfo(selectedContextIds.map(id => ({ id, filename: `ID: ${id}` })));
                    } finally {
                         setIsFetchingNames(false);
                    }
                } else {
                    // Prune documentsInfo if IDs were removed from selectedContextIds
                     setDocumentsInfo(prev => prev.filter(doc => selectedContextIds.includes(doc.id)));
                    setIsFetchingNames(false); // No new IDs to fetch
                }
            };
            fetchNames();
        } else {
            setDocumentsInfo([]); // Clear info if no IDs are selected
        }
    }, [selectedContextIds]); // Rerun when selected IDs change

    const handleRemoveDocument = (docIdToRemove: string) => {
        setSelectedContextIds(prev => prev.filter(id => id !== docIdToRemove));
    };

    if (selectedContextIds.length === 0) {
        return null; // Don't render anything if no documents are selected
    }

    return (
        <TooltipProvider delayDuration={0}>
            <div className="mb-2 p-2 border rounded-md bg-muted/50 max-h-24 overflow-y-auto scrollbar-thin">
                <div className="flex items-center mb-1">
                    <FileText className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs font-medium text-muted-foreground mr-2">Context:</span>
                    {isFetchingNames && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {documentsInfo.map((doc) => (
                        <Tooltip key={doc.id}>
                            <TooltipTrigger asChild>
                                <Badge 
                                    variant="secondary" 
                                    className="pl-2 pr-1 py-0.5 text-xs font-normal cursor-default truncate max-w-[150px] sm:max-w-[200px]"
                                >
                                    <span className="truncate" title={doc.filename}>{doc.filename}</span>
                                    <Button
                                        variant="ghost"
                                        size="xs-icon" // Custom size? Or use padding/size classes
                                        onClick={() => handleRemoveDocument(doc.id)}
                                        disabled={isLoading} // Disable if parent is loading
                                        className="ml-1 h-4 w-4 p-0 rounded-full hover:bg-destructive/20 hover:text-destructive"
                                        aria-label={`Remove ${doc.filename} from context`}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{doc.filename}</p>
                            </TooltipContent>
                        </Tooltip>
                    ))}
                </div>
            </div>
        </TooltipProvider>
    );
};

export default DocumentContextDisplay; 