import React from 'react';
import { DocumentMetadata, ProcessingStatus } from '@/services/documentService'; // Import metadata type and status
import { getFileIcon } from '@/types/document';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"; // Import Card components
import { Badge } from "@/components/ui/Badge";
import { Icons } from '@/components/ui/Icons';
import { Spinner } from '@/components/ui/Spinner';
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton

interface DocumentCardProps {
  document: DocumentMetadata; // Use DocumentMetadata
  isSelected: boolean;
  onSelect: (docId: string) => void;
}

// Re-use or adapt status indicator from DocumentList
const getStatusIndicator = (status: ProcessingStatus | undefined) => {
    switch (status) {
        case 'uploaded':
        case 'text_extraction_pending': return <Badge>Pending</Badge>;
        case 'text_extracted':
        case 'embedding_pending': return <Badge><Spinner size="xs" className="mr-1"/>Processing</Badge>;
        case 'completed': return <Icons.Check className="h-4 w-4 text-green-500" />;
        case 'text_extraction_failed':
        case 'embedding_failed': return <Icons.Alert className="h-4 w-4 text-destructive" />;
        default: return <Icons.Info className="h-4 w-4 text-muted-foreground" />;
    }
};

const DocumentCard: React.FC<DocumentCardProps> = ({ document, isSelected, onSelect }) => {
  const IconComponent = getFileIcon(document.filename || 'unknown');

  return (
    <Card 
      className={cn(
        'group relative w-full h-32 overflow-hidden transition-all duration-150 ease-in-out cursor-pointer', // Base card style
        'hover:shadow-md hover:border-primary/50', // Hover state
        isSelected 
          ? 'border-primary ring-1 ring-primary shadow-md' // Selected state
          : 'border-border',
      )}
      onClick={() => onSelect(document.id)} // Make card clickable
    >
      <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0"> {/* Adjust padding */} 
        {/* Icon */}
        <span className={cn(
            "inline-block h-6 w-6",
            isSelected ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
          )} >
          <IconComponent />
        </span>
        {/* Status Indicator */}
         <div className="flex-shrink-0">
           {getStatusIndicator(document.processingStatus)}
         </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 flex flex-col justify-end flex-grow min-h-0"> {/* Adjust padding */} 
        <CardTitle 
          className={cn(
            "text-sm font-medium leading-none truncate", // Use CardTitle style
            isSelected ? "text-primary" : "text-foreground group-hover:text-foreground"
          )}
          title={document.filename || 'Untitled Document'}
        >
          {document.filename || 'Untitled Document'}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {document.uploadedAt 
            ? `Uploaded: ${new Date(document.uploadedAt).toLocaleDateString()}` 
            : 'Date unknown'}
           {/* Optionally add size: ` -(${(document.size / 1024).toFixed(1)} KB)` */}
        </p>
      </CardContent>
    </Card>
  );
};

// Skeleton version of the card
export const DocumentCardSkeleton: React.FC = () => {
  return (
    <Card className="relative w-full h-32 overflow-hidden">
      <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
        <Skeleton className="h-6 w-6 rounded-md" />
        <Skeleton className="h-4 w-12 rounded-full" /> 
      </CardHeader>
      <CardContent className="p-3 pt-0 flex flex-col justify-end flex-grow min-h-0">
        <Skeleton className="h-4 w-3/4 rounded mb-1" /> 
        <Skeleton className="h-3 w-1/2 rounded" /> 
      </CardContent>
    </Card>
  );
}


export default DocumentCard; 