import React, { useState, useEffect, useRef } from 'react';
import { Document } from '../../types/document';
import { analyzeDocument, DocumentAnalysisResult } from '../../services/documentAnalysisService';
import TimelineView, { TimelineEvent } from '../timeline/TimelineView';
// Tooltip component is imported but used directly in JSX rather than as a React component
import { RiskAssessment } from './RiskAssessment';
import { DocumentMinimap } from './DocumentMinimap';

interface AnalysisTab {
  id: 'summary' | 'entities' | 'clauses' | 'risks' | 'timeline' | 'custom';
  label: string;
  icon?: React.ReactNode;
}

interface DocumentAnalyzerProps {
  document: Document | null;
  onClose: () => void;
}

const DocumentAnalyzer: React.FC<DocumentAnalyzerProps> = ({ document, onClose }) => {
  const [activeTab, setActiveTab] = useState<AnalysisTab['id']>('summary');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<Record<string, DocumentAnalysisResult | null>>({
    summary: null,
    entities: null,
    clauses: null,
    risks: null,
    timeline: null,
    custom: null,
  });
  const [customPrompt, setCustomPrompt] = useState('');
  const [hoveredTerm, setHoveredTerm] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{x: number, y: number}>({x: 0, y: 0});
  const contentRef = useRef<HTMLDivElement>(null);

  // A mock legal terms dictionary - in a real application, this would be more comprehensive
  // and potentially fetched from an API or database
  const legalTermsDefinitions: Record<string, string> = {
    "liability": "Legal responsibility for one's acts or omissions.",
    "indemnity": "Security or protection against a loss or other financial burden.",
    "jurisdiction": "The official power to make legal decisions and judgments.",
    "tort": "A wrongful act or an infringement of a right leading to civil legal liability.",
    "plaintiff": "A person who brings a case against another in a court of law.",
    "defendant": "An individual, company, or institution sued or accused in a court of law.",
    "breach": "An act of breaking or failing to observe a law, agreement, or code of conduct.",
    "statute": "A written law passed by a legislative body.",
    "discovery": "Compulsory disclosure of facts or documents relevant to a case.",
    "judgment": "A decision made by a court in respect to a cause or issue before it."
  };

  const tabs: AnalysisTab[] = [
    { 
      id: 'summary', 
      label: 'Summary',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      )
    },
    { 
      id: 'entities', 
      label: 'Entities',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
        </svg>
      )
    },
    { 
      id: 'clauses', 
      label: 'Key Clauses',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
      )
    },
    { 
      id: 'risks', 
      label: 'Risk Analysis',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      )
    },
    { 
      id: 'timeline', 
      label: 'Timeline',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
        </svg>
      )
    },
    { 
      id: 'custom', 
      label: 'Custom Analysis',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
          <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
        </svg>
      )
    },
  ];

  const runAnalysis = async (type: AnalysisTab['id']) => {
    if (!document) return;

    setLoading(true);
    setError(null);
    
    try {
      // For custom analysis, use the customPrompt
      const prompt = type === 'custom' ? customPrompt : undefined;
      
      const { data, error } = await analyzeDocument(
        document.id, 
        type,
        prompt
      );
      
      if (error) {
        throw error;
      }
      
      setAnalysisResults(prev => ({
        ...prev,
        [type]: data
      }));
    } catch (err) {
      console.error('Error analyzing document:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze document');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Reset state when document changes
    setAnalysisResults({
      summary: null,
      entities: null,
      clauses: null,
      risks: null,
      timeline: null,
      custom: null,
    });
    setActiveTab('summary');
    setCustomPrompt('');
    setError(null);
  }, [document]);

  useEffect(() => {
    // Automatically run the selected analysis when tab changes (except for custom)
    if (document && activeTab !== 'custom' && !analysisResults[activeTab]) {
      runAnalysis(activeTab);
    }
  }, [activeTab, document, analysisResults, runAnalysis]);

  const handleCustomAnalysis = () => {
    if (customPrompt.trim()) {
      runAnalysis('custom');
    }
  };

  const handleTermMouseOver = (term: string, event: React.MouseEvent) => {
    // Check if this term is in our legal dictionary
    const normalizedTerm = term.toLowerCase();
    
    // We'll check if any word in the term matches our dictionary
    const words = normalizedTerm.split(/\s+/);
    const matchedTerm = Object.keys(legalTermsDefinitions).find(key => 
      words.includes(key) || normalizedTerm.includes(key)
    );
    
    if (matchedTerm) {
      setHoveredTerm(matchedTerm);
      setTooltipPosition({ 
        x: event.clientX, 
        y: event.clientY 
      });
    }
  };
  
  const handleTermMouseOut = () => {
    setHoveredTerm(null);
  };

  if (!document) {
    return null;
  }

  const renderAnalysisContent = () => {
    const result = analysisResults[activeTab];
    
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center p-8">
          <div className="flex space-x-2 mb-4">
            <div className="w-3 h-3 bg-primary rounded-full animate-bounce"></div>
            <div className="w-3 h-3 bg-primary rounded-full animate-bounce delay-150"></div>
            <div className="w-3 h-3 bg-primary rounded-full animate-bounce delay-300"></div>
          </div>
          <p className="text-text-primary">Analyzing document...</p>
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="p-4 bg-red-500 bg-opacity-20 text-red-500 rounded-md">
          <p className="font-medium">Error</p>
          <p>{error}</p>
        </div>
      );
    }
    
    if (!result) {
      // Show empty state with run button
      return (
        <div className="flex flex-col items-center justify-center p-8">
          {activeTab === 'custom' ? (
            <div className="w-full max-w-lg">
              <label className="block text-text-primary mb-2">
                Enter your custom analysis prompt:
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="E.g., Identify potential tax implications in this document"
                className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 text-text-primary mb-4 min-h-[120px]"
              />
              <button
                onClick={handleCustomAnalysis}
                disabled={!customPrompt.trim()}
                className="bg-primary text-white px-4 py-2 rounded-md disabled:opacity-50"
              >
                Run Custom Analysis
              </button>
            </div>
          ) : (
            <>
              <p className="text-text-primary mb-4">
                Run {activeTab} analysis on this document to extract key information.
              </p>
              <button
                onClick={() => runAnalysis(activeTab)}
                className="bg-primary text-white px-4 py-2 rounded-md"
              >
                Run {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Analysis
              </button>
            </>
          )}
        </div>
      );
    }
    
    // Render the analysis result based on the tab
    return (
      <div className="p-4">
        {activeTab === 'summary' && (
          <div className="prose prose-invert max-w-none">
            <h3 className="text-xl font-medium mb-4">Document Summary</h3>
            <div className="bg-gray-700 rounded-lg p-5">
              <div className="whitespace-pre-wrap">{result.result}</div>
            </div>
          </div>
        )}
        
        {activeTab === 'entities' && (
          <div className="prose prose-invert max-w-none">
            <h3 className="text-xl font-medium mb-4">Entity Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(() => {
                // Try to parse entities by category
                // Define a type for categories to allow string indexing
                interface EntityCategories {
                  [key: string]: string[];
                }
                
                const categories: EntityCategories = {
                  'People': [],
                  'Organizations': [],
                  'Dates': [],
                  'Locations': [],
                  'Legal Terms': [],
                  'Financial Terms': [],
                  'Other': []
                };
                
                // Simple parsing - splits the text by double newlines and tries to categorize
                const sections = result.result.split('\n\n');
                let currentCategory = 'Other';
                
                sections.forEach((section: string) => {
                  // Check if this is a category header
                  const trimmedSection = section.trim();
                  if (!trimmedSection) return;
                  
                  if (trimmedSection.endsWith(':') && trimmedSection.includes(':') && trimmedSection.indexOf(':') === trimmedSection.lastIndexOf(':')) {
                    // This is likely a category header
                    currentCategory = trimmedSection.replace(':', '');
                    if (!categories[currentCategory]) {
                      categories[currentCategory] = [];
                    }
                  } else if (trimmedSection.match(/^[A-Z\s]+:$/)) {
                    // Alternative category format
                    currentCategory = trimmedSection.replace(':', '');
                    if (!categories[currentCategory]) {
                      categories[currentCategory] = [];
                    }
                  } else {
                    // This is content
                    // Split by lines to get individual entities
                    const entities = trimmedSection.split('\n')
                      .map((e: string) => e.trim())
                      .filter((e: string) => e && !e.endsWith(':'));
                    
                    if (entities.length > 0) {
                      if (categories[currentCategory]) {
                        categories[currentCategory].push(...entities);
                      } else {
                        categories['Other'].push(...entities);
                      }
                    }
                  }
                });
                
                // Filter out empty categories
                const nonEmptyCategories = Object.entries(categories)
                  .filter(([, entities]) => entities.length > 0);
                
                if (nonEmptyCategories.length === 0) {
                  // Fallback if parsing fails - just display the raw text
                  return <div className="whitespace-pre-wrap">{result.result}</div>;
                }
                
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {nonEmptyCategories.map(([category, entities]) => (
                      <div key={category} className="bg-gray-800/50 p-4 rounded-lg">
                        <h4 className="text-lg font-medium mb-2 text-primary">{category}</h4>
                        <ul className="space-y-1">
                          {entities.map((entity, index) => (
                            <li 
                              key={`${category}-${index}`} 
                              className={`text-text-primary ${category === 'Legal Terms' ? 'cursor-help border-b border-dashed border-gray-500' : ''}`}
                              onMouseOver={category === 'Legal Terms' ? (e) => handleTermMouseOver(entity, e) : undefined}
                              onMouseOut={category === 'Legal Terms' ? handleTermMouseOut : undefined}
                            >
                              {entity}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    
                    {/* Tooltip for legal terms */}
                    {hoveredTerm && (
                      <div 
                        className="fixed bg-gray-900 text-white p-3 rounded-md shadow-lg z-50 max-w-xs text-sm border border-primary"
                        style={{
                          top: tooltipPosition.y + 15,
                          left: tooltipPosition.x + 10
                        }}
                      >
                        <h5 className="font-medium text-primary mb-1 capitalize">{hoveredTerm}</h5>
                        <p>{legalTermsDefinitions[hoveredTerm]}</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
        
        {activeTab === 'clauses' && (
          <div className="prose prose-invert max-w-none">
            <h3 className="text-xl font-medium mb-4">Key Clauses</h3>
            <div className="space-y-4">
              {(() => {
                try {
                  // Split by double newlines to get clause blocks
                  const clauseBlocks = result.result.split('\n\n')
                    .filter((block: string) => block.trim());
                  
                  if (clauseBlocks.length > 0) {
                    return clauseBlocks.map((block: string, index: number) => {
                      // Try to extract a title/header if it exists
                      const lines = block.split('\n');
                      let title = '';
                      let content = block;
                      
                      // Check if first line looks like a header (e.g., ends with colon or is in all caps or starts with number)
                      if (lines[0].match(/^\d+\./) || lines[0].endsWith(':') || lines[0].toUpperCase() === lines[0]) {
                        title = lines[0].replace(/:\s*$/, '');
                        content = lines.slice(1).join('\n').trim();
                      }
                      
                      return (
                        <div key={index} className="bg-gray-700 rounded-lg p-4 border-l-4 border-primary">
                          {title && <h4 className="font-medium text-lg text-primary mb-2">{title}</h4>}
                          <div className="whitespace-pre-wrap">{content}</div>
                        </div>
                      );
                    });
                  }
                } catch (e: unknown) {
                  console.error('Error parsing clauses', e);
                }
                
                // Fallback to raw text
                return <div className="whitespace-pre-wrap">{result.result}</div>;
              })()}
            </div>
          </div>
        )}
        
        {activeTab === 'risks' && (
          <div className="prose prose-invert max-w-none relative">
            <h3 className="text-xl font-medium mb-4">Risk Analysis</h3>
            {contentRef.current && <DocumentMinimap contentRef={contentRef as React.RefObject<HTMLDivElement>} className="z-50" />}
            <div className="pb-16"> {/* Add padding to avoid content being hidden by the minimap */}
              <RiskAssessment analysis={result} />
            </div>
          </div>
        )}
        
        {activeTab === 'timeline' && (
          <div className="prose prose-invert max-w-none">
            <h3 className="text-xl font-medium mb-4">Timeline</h3>
            {(() => {
              try {
                // Try to parse the timeline as JSON
                let timelineData: TimelineEvent[] = [];
                
                try {
                  // First try parsing as direct JSON
                  timelineData = JSON.parse(result.result);
                } catch (parseError) {
                  // If that fails, look for a JSON structure within the text
                  const jsonMatch = result.result.match(/```json\s*([\s\S]+?)\s*```/);
                  if (jsonMatch && jsonMatch[1]) {
                    timelineData = JSON.parse(jsonMatch[1]);
                  } else {
                    // Try to parse from a text format
                    // Assume format like: "Date: Event description"
                    const events = result.result.split('\n\n')
                      .filter((line: string) => line.trim())
                      .map((line: string) => {
                        const [datePart, ...restParts] = line.split(':');
                        const description = restParts.join(':').trim();
                        
                        // Basic date parsing - this is a simple approach
                        // In a real app, we'd want more robust date parsing
                        let date = new Date();
                        try {
                          date = new Date(datePart.trim());
                        } catch {
                          // If date parsing fails, use current date
                        }
                        
                        return {
                          date: date.toISOString(),
                          title: description.split('\n')[0] || 'Event',
                          description: description.split('\n').slice(1).join('\n') || description
                        };
                      });
                    
                    if (events.length > 0) {
                      timelineData = events;
                    }
                  }
                }
                
                if (timelineData.length > 0) {
                  return <TimelineView events={timelineData} />;
                } else {
                  // If we failed to parse the timeline, just display the raw text
                  return <div className="whitespace-pre-wrap">{result.result}</div>;
                }
              } catch (e: unknown) {
                console.error('Error parsing timeline', e);
                return <div className="whitespace-pre-wrap">{result.result}</div>;
              }
            })()}
          </div>
        )}
        
        {activeTab === 'custom' && (
          <div className="prose prose-invert max-w-none">
            <h3 className="text-xl font-medium mb-4">Custom Analysis</h3>
            <div className="bg-gray-700 rounded-lg p-5">
              <div className="text-sm text-gray-400 mb-2">Prompt: {customPrompt}</div>
              <div className="whitespace-pre-wrap">{result.result}</div>
            </div>
            
            <div className="mt-4">
              <label className="block text-text-primary mb-2">
                Try another custom analysis:
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="E.g., What are the tax implications of this document?"
                className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 text-text-primary mb-4 min-h-[120px]"
              />
              <button
                onClick={handleCustomAnalysis}
                disabled={!customPrompt.trim()}
                className="bg-primary text-white px-4 py-2 rounded-md disabled:opacity-50"
              >
                Run New Analysis
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700 p-4">
        <h2 className="text-lg font-medium text-text-primary">Document Analysis: {document.filename}</h2>
        <button 
          onClick={onClose} 
          className="text-text-secondary hover:text-text-primary p-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b border-gray-700 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`px-4 py-3 flex items-center space-x-2 ${
              activeTab === tab.id
                ? 'border-b-2 border-primary text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon && <span>{tab.icon}</span>}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      
      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto relative">
        {renderAnalysisContent()}
      </div>
    </div>
  );
};

export default DocumentAnalyzer;
