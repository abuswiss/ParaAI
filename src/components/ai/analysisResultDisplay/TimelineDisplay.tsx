import React, { useState } from 'react';
import { TimelineResult, TimelineEvent } from '@/services/documentAnalysisService';
import { CalendarDays, Users, Copy, MessageSquarePlus, Landmark, FileText, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';

interface TimelineDisplayProps {
  result: TimelineResult;
  onCopyItem: (text: string, itemName?: string) => void;
  onAddItemToContext: (itemText: string, itemTypeLabel: string) => void;
  onItemHover: (item: TimelineEvent | null) => void;
  onItemClick: (item: TimelineEvent) => void;
}

// Function to get icon and marker color based on event keywords or type
const getEventStyling = (eventText: string) => {
  const text = eventText.toLowerCase();
  let icon = <CalendarDays className="h-3 w-3 text-white" />;
  // Using more theme-friendly and consistent colors
  let markerColorClass = 'bg-primary dark:bg-dark-primary'; // Default to primary
  let iconColorClass = 'text-primary-foreground dark:text-dark-primary-foreground';

  if (text.includes('filed') || text.includes('submission')) {
    icon = <FileText className="h-3 w-3 text-info-foreground dark:text-dark-info-foreground" />;
    markerColorClass = 'bg-info dark:bg-dark-info'; 
    iconColorClass = 'text-info-foreground dark:text-dark-info-foreground';
  }
  if (text.includes('court') || text.includes('hearing')) {
    icon = <Landmark className="h-3 w-3 text-primary-foreground dark:text-dark-primary-foreground" />;
    // Let's use a distinct color, perhaps a slightly different shade of primary or a secondary color
    // For now, sticking with a variant of primary but could be mapped to a specific theme color for "legal actions"
    markerColorClass = 'bg-primary/80 dark:bg-dark-primary/80'; 
    iconColorClass = 'text-primary-foreground dark:text-dark-primary-foreground';
  }
  if (text.includes('deadline') || text.includes('due')) {
    icon = <AlertCircle className="h-3 w-3 text-warning-foreground dark:text-dark-warning-foreground" />;
    markerColorClass = 'bg-warning dark:bg-dark-warning'; 
    iconColorClass = 'text-warning-foreground dark:text-dark-warning-foreground';
  }
  // Ensure icon color is always contrasting with its marker background
  // For example, if markerColorClass is light, iconColorClass should be dark, and vice-versa.
  // The current setup assumes marker backgrounds are dark enough for light text or are using semantic foregrounds.

  return { icon, markerColorClass, iconColorClass };
};

const TimelineDisplay: React.FC<TimelineDisplayProps> = ({ result, onCopyItem, onAddItemToContext, onItemHover, onItemClick }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  if (!result || !result.timeline || result.timeline.length === 0) {
    return (
        <div className="space-y-3">
            <div className="flex items-center text-base font-semibold text-foreground dark:text-dark-foreground">
                <CalendarDays className="h-5 w-5 mr-2 text-muted-foreground dark:text-dark-muted-foreground flex-shrink-0" />
                Timeline of Events
            </div>
            <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground p-2">No timeline events identified.</p>
        </div>
    );
  }

  const sortedEvents = result.timeline;

  return (
    <div className="space-y-3">
        <div className="flex items-center text-base font-semibold text-foreground dark:text-dark-foreground mb-2">
            <CalendarDays className="h-5 w-5 mr-2 text-muted-foreground dark:text-dark-muted-foreground flex-shrink-0" />
            Timeline of Events
        </div>
        <div className="flow-root">
        <ul className="-mb-8">
            {sortedEvents.map((event, index) => {
            const isLastEvent = index === sortedEvents.length - 1;
            const eventDateStr = event.date ? new Date(event.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Date N/A';
            const eventTitle = event.event || `Event ${index + 1}`;
            const eventTextForActions = `${eventDateStr}: ${event.event}${event.parties ? ` (Parties: ${event.parties.join(", ")})` : ""}`;
            
            const { icon: IconComponent, markerColorClass, iconColorClass: currentIconColorClass } = getEventStyling(eventTitle);

            return (
                <li key={index}>
                <div className="relative pb-8 group">
                    {!isLastEvent ? (
                    <span className="absolute left-3 top-1 -ml-px h-full w-0.5 bg-border dark:bg-dark-border" aria-hidden="true"></span>
                    ) : null}
                    <div 
                    className="relative flex items-start space-x-3 cursor-pointer p-1 hover:bg-accent/50 dark:hover:bg-dark-accent/50 rounded-md transition-colors duration-150"
                    onMouseEnter={() => onItemHover(event)}
                    onMouseLeave={() => onItemHover(null)}
                    onClick={() => onItemClick(event)}
                    >
                    <div className="relative px-1">
                        <div className={cn(
                            "h-6 w-6 rounded-full flex items-center justify-center ring-4 ring-background dark:ring-dark-background transition-all",
                            markerColorClass
                            )} >
                        {React.cloneElement(IconComponent, { className: cn(IconComponent.props.className, currentIconColorClass) })}
                        </div>
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex justify-between items-center">
                        <p className="text-xs font-semibold text-muted-foreground dark:text-dark-muted-foreground">
                            {eventDateStr}
                        </p>
                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <Button 
                                variant="ghost" 
                                size="xs-icon" 
                                className="h-6 w-6 p-1 text-muted-foreground dark:text-dark-muted-foreground hover:text-foreground dark:hover:text-dark-foreground"
                                onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(eventTextForActions).then(() => { setCopiedIndex(index); toast.success('Copied!'); setTimeout(() => setCopiedIndex(null), 1200); }); }}
                                title="Copy Event Details"
                            >
                                {copiedIndex === index ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                            {copiedIndex === index && <span className="ml-1 text-xs text-green-600">Copied!</span>}
                            <Button 
                                variant="ghost" 
                                size="xs-icon" 
                                className="h-6 w-6 p-1 text-muted-foreground dark:text-dark-muted-foreground hover:text-foreground dark:hover:text-dark-foreground"
                                onClick={(e) => { e.stopPropagation(); onAddItemToContext(eventTextForActions, `Timeline Event - ${eventDateStr}`); }}
                                title="Add Event to Chat Context"
                            >
                                <MessageSquarePlus className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                        </div>
                        <p className="text-sm font-medium text-foreground dark:text-dark-foreground mt-0.5 mb-1">{eventTitle}</p>
                        {event.parties && event.parties.length > 0 && (
                        <div className="flex items-center text-xs text-muted-foreground dark:text-dark-muted-foreground mt-1">
                            <Users className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                            <span className="truncate">{event.parties.join(', ')}</span>
                        </div>
                        )}
                    </div>
                    </div>
                </div>
                </li>
            );
            })}
        </ul>
        </div>
    </div>
  );
};

export default TimelineDisplay; 