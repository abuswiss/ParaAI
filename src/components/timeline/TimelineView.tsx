import React from 'react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AlertTriangle, CalendarDays, RefreshCw, ServerCrash, Info } from 'lucide-react';
import { TimelineEvent } from '@/services/documentAnalysisService';

interface TimelineViewProps {
  timelineEvents: TimelineEvent[] | null;
  isLoading: boolean;
  error: string | null;
  onRegenerate?: () => void;
}

const TimelineView: React.FC<TimelineViewProps> = ({ 
  timelineEvents, 
  isLoading, 
  error,
  onRegenerate 
}) => {
  if (isLoading) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center text-center p-4">
        <Spinner size="md" />
        <p className="mt-2 text-sm text-muted-foreground">Loading timeline...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive" className="mb-4">
          <ServerCrash className="h-4 w-4" /> 
          <AlertTitle>Error Loading Timeline</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          {onRegenerate && (
              <Button variant="secondary" size="sm" onClick={onRegenerate} className="mt-3">
                  Retry
              </Button>
          )}
        </Alert>
      </div>
    );
  }
  
  if (!timelineEvents || timelineEvents.length === 0) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center text-center p-4">
        <Info className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">
          No timeline events extracted or analysis not run yet.
        </p>
         {onRegenerate && (
              <Button variant="secondary" size="sm" onClick={onRegenerate} className="mt-3">
                  Run Timeline Analysis
              </Button>
          )}
      </div>
    );
  }

  return (
    <div className="p-4 h-full flex flex-col">
       <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-foreground">Extracted Timeline</h3>
        {onRegenerate && (
          <Button 
             variant="ghost" 
             size="icon_xs" 
             onClick={onRegenerate} 
             disabled={isLoading}
             title="Regenerate Timeline"
             className="text-muted-foreground hover:text-foreground"
           >
             <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} /> 
           </Button>
        )}
       </div>

      <div className="flex-grow overflow-y-auto space-y-3 pr-2 -mr-2">
        {timelineEvents.map((event, index) => (
          <Card key={index} className="overflow-hidden bg-card/50">
            <CardContent className="p-3 flex items-start space-x-3">
               <div className="flex-shrink-0 mt-1.5">
                  <span className="block h-2.5 w-2.5 bg-blue-500 rounded-full ring-2 ring-blue-500/20"></span>
               </div>
               <div className="flex-grow min-w-0">
                 {event.date && (
                  <Badge variant="secondary" className="mb-1.5 text-xs font-normal">
                      <CalendarDays className="h-3 w-3 mr-1 text-muted-foreground" />
                      {event.date}
                  </Badge>
                 )}
                 <p className="text-sm text-foreground leading-snug">
                    {event.event}
                 </p>
               </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TimelineView;
