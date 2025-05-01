import React, { useState, useEffect, useCallback } from 'react';
import { handleGenerateTimelineStream } from '@/services/chatService'; 
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AlertTriangle, CalendarDays, RefreshCw } from 'lucide-react';

// Define the event structure matching the backend function
interface TimelineEvent {
    date: string | null;
    description: string;
    context?: string;
    page?: number;
}

interface TimelineViewProps {
  documentId: string;
  caseId: string; // Pass caseId for the service call
}

const TimelineView: React.FC<TimelineViewProps> = ({ documentId, caseId }) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const generateTimeline = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setEvents([]);
    setStatusMessage('Generating timeline...');

    // Mock onChunk to capture status updates and final data
    let finalTimeline: TimelineEvent[] | null = null;
    const handleChunk = (chunk: string) => {
        try {
            const data = JSON.parse(chunk);
            if (data.status === 'GENERATING_TIMELINE' || data.status === 'ERROR') {
                setStatusMessage(data.message);
            }
            if (data.status === 'COMPLETE') {
                finalTimeline = data.timeline;
                setStatusMessage(null); // Clear status message on completion
            }
        } catch (e) {
            // Ignore non-JSON chunks if any occur
            console.warn("Received non-JSON chunk during timeline generation:", chunk);
        }
    };

    try {
      const result = await handleGenerateTimelineStream(documentId, handleChunk, caseId);
      
      if (!result.success || result.error) {
          throw result.error || new Error('Timeline generation failed.');
      }

      // Set the final timeline data received via the handleChunk callback
      setEvents(finalTimeline || []); 
      if (!finalTimeline || finalTimeline.length === 0) {
          setStatusMessage("No specific timeline events found in the document.");
      }

    } catch (err: any) {
      console.error("Error generating timeline:", err);
      setError(err.message || 'An unexpected error occurred while generating the timeline.');
      setStatusMessage(null);
    } finally {
      setIsLoading(false);
    }
  }, [documentId, caseId]);

  // Generate timeline on initial load
  useEffect(() => {
    if (documentId && caseId) {
      generateTimeline();
    }
  }, [documentId, caseId, generateTimeline]);

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-foreground">Document Timeline</h3>
        <Button variant="ghost" size="sm" onClick={generateTimeline} disabled={isLoading} title="Regenerate Timeline">
           <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {isLoading && !events.length && (
        <div className="flex-grow flex flex-col items-center justify-center text-center">
          <Spinner size="md" />
          {statusMessage && <p className="mt-2 text-sm text-muted-foreground">{statusMessage}</p>}
        </div>
      )}

      {!isLoading && error && (
         <Alert variant="destructive" className="mb-4">
           <AlertTriangle className="h-4 w-4" />
           <AlertTitle>Error</AlertTitle>
           <AlertDescription>{error}</AlertDescription>
         </Alert>
      )}
      
      {!isLoading && !error && statusMessage && events.length === 0 && (
           <div className="flex-grow flex flex-col items-center justify-center text-center p-4">
               <CalendarDays className="h-12 w-12 text-muted-foreground/50 mb-4" />
               <p className="text-sm text-muted-foreground">{statusMessage}</p>
            </div>
      )}

      {!isLoading && !error && events.length > 0 && (
        <div className="flex-grow overflow-y-auto space-y-3 pr-2">
          {events.map((event, index) => (
            <Card key={index} className="overflow-hidden">
              <CardContent className="p-3 flex items-start space-x-3">
                 <div className="flex-shrink-0 mt-1">
                    <span className="block h-2.5 w-2.5 bg-primary rounded-full"></span>
                 </div>
                 <div className="flex-grow">
                   {event.date && (
                    <Badge variant="outline" className="mb-1.5 text-xs font-medium">
                        <CalendarDays className="h-3 w-3 mr-1" />
                        {event.date}
                    </Badge>
                   )}
                   <p className="text-sm text-foreground leading-snug">
                      {event.description}
                   </p>
                 </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TimelineView;
