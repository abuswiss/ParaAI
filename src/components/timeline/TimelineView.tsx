import React, { useState, useEffect } from 'react';
import { Document } from '../../types/document';

export interface TimelineEvent {
  id?: string;
  date: string;
  description: string;
  parties?: string[];
  sources?: string[];
  metadata?: Record<string, unknown>;
}

interface TimelineViewProps {
  events: TimelineEvent[];
  document?: Document;
  isLoading?: boolean;
  onEventClick?: (event: TimelineEvent) => void;
  showHeader?: boolean;
  maxHeight?: string;
  allowFiltering?: boolean;
}

const TimelineView: React.FC<TimelineViewProps> = ({
  events,
  document,
  isLoading = false,
  onEventClick,
  showHeader = true,
  maxHeight = '70vh',
  allowFiltering = true
}) => {
  const [filteredEvents, setFilteredEvents] = useState<TimelineEvent[]>(events);
  const [filterText, setFilterText] = useState('');
  const [dateRange, setDateRange] = useState<{start: string | null, end: string | null}>({start: null, end: null});
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  // Update filtered events when events or filters change
  useEffect(() => {
    let result = [...events];
    
    // Apply text filter if present
    if (filterText) {
      const lowerFilter = filterText.toLowerCase();
      result = result.filter(event => 
        event.description.toLowerCase().includes(lowerFilter) ||
        (event.parties?.some(party => party.toLowerCase().includes(lowerFilter)) ?? false)
      );
    }
    
    // Apply date range filter if present
    if (dateRange.start || dateRange.end) {
      const startDate = dateRange.start ? new Date(dateRange.start).getTime() : 0;
      const endDate = dateRange.end ? new Date(dateRange.end).getTime() : Infinity;
      
      result = result.filter(event => {
        try {
          const eventDate = new Date(event.date).getTime();
          return eventDate >= startDate && eventDate <= endDate;
        } catch {
          return true; // Keep events with unparseable dates
        }
      });
    }
    
    setFilteredEvents(result);
  }, [events, filterText, dateRange]);

  // Sort events by date if possible
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    // Try to parse dates, but if not parseable, maintain original order
    try {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    } catch {
      return 0;
    }
  });

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
      // If we can't parse the date, return the original string
      return dateString;
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="flex space-x-2 mb-4">
          <div className="w-3 h-3 bg-primary rounded-full animate-bounce"></div>
          <div className="w-3 h-3 bg-primary rounded-full animate-bounce delay-150"></div>
          <div className="w-3 h-3 bg-primary rounded-full animate-bounce delay-300"></div>
        </div>
        <p className="text-text-primary">Generating timeline...</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mb-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
        </svg>
        <p className="text-text-secondary mb-4">No timeline events found</p>
      </div>
    );
  }

  // Helper to extract the earliest and latest dates for the date filter
  const getDateBounds = (): { earliest: Date | null, latest: Date | null } => {
    if (events.length === 0) return { earliest: null, latest: null };
    
    let earliest: Date | null = null;
    let latest: Date | null = null;
    
    events.forEach(event => {
      try {
        const date = new Date(event.date);
        if (!isNaN(date.getTime())) {
          if (!earliest || date < earliest) earliest = date;
          if (!latest || date > latest) latest = date;
        }
      } catch {
        // Intentionally empty: skip events with invalid dates
      }
    });
    
    return { earliest, latest };
  };
  
  const { earliest, latest } = getDateBounds();

  return (
    <div className="bg-gray-900 rounded-lg">
      {showHeader && (
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-medium text-text-primary">
            Timeline {document && `for ${document.filename}`}
          </h2>
          <p className="text-sm text-text-secondary">
            {sortedEvents.length} events {sortedEvents.length > 0 && `from ${formatDate(sortedEvents[0].date)} to ${formatDate(sortedEvents[sortedEvents.length - 1].date)}`}
          </p>
          
          {/* Filtering controls */}
          {allowFiltering && (
            <div className="mt-4 space-y-3">
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Filter by text..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-text-primary w-full focus:outline-none focus:border-primary"
                />
                {filterText && (
                  <button 
                    onClick={() => setFilterText('')}
                    className="bg-gray-800 hover:bg-gray-700 rounded px-2 py-1 text-sm text-gray-400"
                  >
                    Clear
                  </button>
                )}
              </div>
              
              <div className="flex flex-wrap space-x-2 items-center text-sm">
                <span className="text-text-secondary">Date Range:</span>
                <input
                  type="date"
                  value={dateRange.start || ''}
                  onChange={(e) => setDateRange({...dateRange, start: e.target.value || null})}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-primary"
                  min={earliest !== null ? earliest.toISOString().substring(0, 10) : undefined}
                  max={latest !== null ? latest.toISOString().substring(0, 10) : undefined}
                />
                <span className="text-text-secondary">to</span>
                <input
                  type="date"
                  value={dateRange.end || ''}
                  onChange={(e) => setDateRange({...dateRange, end: e.target.value || null})}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-primary"
                  min={dateRange.start || (earliest !== null ? earliest.toISOString().substring(0, 10) : undefined)}
                  max={latest !== null ? latest.toISOString().substring(0, 10) : undefined}
                />
                {(dateRange.start || dateRange.end) && (
                  <button 
                    onClick={() => setDateRange({start: null, end: null})}
                    className="bg-gray-800 hover:bg-gray-700 rounded px-2 py-1 text-sm text-gray-400"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="p-4" style={{ maxHeight, overflowY: 'auto' }}>
        <div className="relative border-l-2 border-primary pl-6 pb-6 space-y-8">
          {sortedEvents.map((event, index) => (
            <div 
              key={event.id || index}
              onMouseEnter={() => setHoveredEventId(event.id || String(index))}
              onMouseLeave={() => setHoveredEventId(null)}
              className="relative"
            >
              {/* Timeline dot */}
              <div 
                className={`absolute -left-[10px] w-[18px] h-[18px] ${hoveredEventId === (event.id || String(index)) ? 'bg-primary-hover scale-125' : 'bg-primary'} rounded-full border-4 border-gray-900 z-10 transition-all duration-200`}
              ></div>
              <div className="mb-1 text-primary font-medium">
                {formatDate(event.date)}
              </div>
              <div 
                className={`bg-gray-800 rounded-lg p-4 ${onEventClick ? 'cursor-pointer hover:bg-gray-700' : ''} ${hoveredEventId === (event.id || String(index)) ? 'border border-primary shadow-md' : 'border border-transparent'} transition-all duration-200`}
                onClick={() => onEventClick && onEventClick(event)}
              >
                <p className="text-text-primary">{event.description}</p>
                
                {/* Display parties if available */}
                {event.parties && event.parties.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {event.parties.map((party, i) => (
                      <span key={i} className="text-xs bg-gray-700 text-text-secondary rounded-full px-2 py-0.5">
                        {party}
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Display sources if any */}
                {event.sources && event.sources.length > 0 && (
                  <div className="mt-2 text-xs text-text-secondary">
                    Sources: {event.sources.join(', ')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TimelineView;
