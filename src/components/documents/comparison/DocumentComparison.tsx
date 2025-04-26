import React, { useState, useEffect } from 'react';
import { calculateLineDiff, calculateWordDiff, TextDiffChunk } from '../../../utils/textDiff';
import { Document } from '../../../types/document';
import { DocumentDraft } from '../../../services/templateService';

interface DocumentComparisonProps {
  // Two documents to compare - these can be existing documents or drafts
  originalDocument?: Document | DocumentDraft;
  revisedDocument?: Document | DocumentDraft;
  // Or direct text comparison
  originalText?: string;
  revisedText?: string;
  // Options
  comparisonMode?: 'line' | 'word';
  showLineNumbers?: boolean;
  title?: string;
  maxHeight?: string;
}

const DocumentComparison: React.FC<DocumentComparisonProps> = ({
  originalDocument,
  revisedDocument,
  originalText,
  revisedText,
  comparisonMode = 'line',
  showLineNumbers = true,
  title,
  maxHeight = '70vh'
}) => {
  const [diffChunks, setDiffChunks] = useState<TextDiffChunk[]>([]);
  const [originalContent, setOriginalContent] = useState<string>('');
  const [revisedContent, setRevisedContent] = useState<string>('');
  const [selectedMode, setSelectedMode] = useState<'line' | 'word'>(comparisonMode);
  
  // Get content from either direct texts or document/draft objects
  useEffect(() => {
    // Get original content
    if (originalText !== undefined) {
      setOriginalContent(originalText);
    } else if (originalDocument) {
      if ('extractedText' in originalDocument) {
        // It's a Document
        setOriginalContent(originalDocument.extractedText || '');
      } else if ('content' in originalDocument) {
        // It's a DocumentDraft
        setOriginalContent(originalDocument.content);
      }
    }
    
    // Get revised content
    if (revisedText !== undefined) {
      setRevisedContent(revisedText);
    } else if (revisedDocument) {
      if ('extractedText' in revisedDocument) {
        // It's a Document
        setRevisedContent(revisedDocument.extractedText || '');
      } else if ('content' in revisedDocument) {
        // It's a DocumentDraft
        setRevisedContent(revisedDocument.content);
      }
    }
  }, [originalDocument, revisedDocument, originalText, revisedText]);
  
  // Calculate diff when content changes
  useEffect(() => {
    if (originalContent && revisedContent) {
      const chunks = selectedMode === 'line' 
        ? calculateLineDiff(originalContent, revisedContent)
        : calculateWordDiff(originalContent, revisedContent);
      
      setDiffChunks(chunks);
    }
  }, [originalContent, revisedContent, selectedMode]);
  
  // Function to highlight diff chunks with appropriate colors
  const renderDiffChunk = (chunk: TextDiffChunk, index: number) => {
    const className = 
      chunk.type === 'common' ? 'text-text-primary' :
      chunk.type === 'added' ? 'bg-green-900/30 text-green-400' :
      'bg-red-900/30 text-red-400';
    
    return (
      <span key={index} className={className}>
        {chunk.value}
      </span>
    );
  };
  
  // Function to render line numbers
  const renderLineNumbers = (text: string) => {
    if (!showLineNumbers) return null;
    
    const lines = text.split('\n');
    return (
      <div className="flex-shrink-0 pr-3 text-right border-r border-gray-700 mr-3">
        {lines.map((_, i) => (
          <div key={i} className="text-xs text-gray-500 leading-5 h-5">
            {i + 1}
          </div>
        ))}
      </div>
    );
  };
  
  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium text-text-primary">
            {title || 'Document Comparison'}
          </h2>
          <p className="text-sm text-text-secondary">
            Showing differences between documents
          </p>
        </div>
        
        {/* Comparison mode selector */}
        <div className="flex space-x-2">
          <button
            className={`px-3 py-1 text-sm rounded-full 
              ${selectedMode === 'line' 
                ? 'bg-primary text-white' 
                : 'bg-gray-800 text-text-secondary hover:bg-gray-700'}`}
            onClick={() => setSelectedMode('line')}
          >
            Line by Line
          </button>
          <button
            className={`px-3 py-1 text-sm rounded-full 
              ${selectedMode === 'word' 
                ? 'bg-primary text-white' 
                : 'bg-gray-800 text-text-secondary hover:bg-gray-700'}`}
            onClick={() => setSelectedMode('word')}
          >
            Word by Word
          </button>
        </div>
      </div>
      
      {/* Legend */}
      <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center space-x-4">
        <div className="flex items-center space-x-1">
          <span className="h-3 w-3 inline-block bg-green-900/30"></span>
          <span className="text-xs text-text-secondary">Added</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="h-3 w-3 inline-block bg-red-900/30"></span>
          <span className="text-xs text-text-secondary">Removed</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="h-3 w-3 inline-block bg-transparent border border-gray-700"></span>
          <span className="text-xs text-text-secondary">Unchanged</span>
        </div>
      </div>
      
      {/* Split view comparison */}
      <div className="grid grid-cols-2 bg-gray-800 gap-0.5">
        {/* Original document */}
        <div className="bg-gray-900 p-4">
          <div className="text-sm font-medium text-text-secondary mb-2">
            Original Document
          </div>
          <div 
            className="bg-gray-800 p-3 rounded border border-gray-700 overflow-auto whitespace-pre-wrap font-mono text-sm"
            style={{ maxHeight }}
          >
            {originalContent ? (
              <div className="flex">
                {showLineNumbers && renderLineNumbers(originalContent)}
                <div className="flex-1">
                  {selectedMode === 'line' 
                    ? diffChunks
                        .filter(chunk => chunk.type !== 'added')
                        .map(renderDiffChunk)
                    : calculateLineDiff(originalContent, revisedContent)
                        .filter(chunk => chunk.type !== 'added')
                        .map(renderDiffChunk)
                  }
                </div>
              </div>
            ) : (
              <div className="text-gray-500">No original document content</div>
            )}
          </div>
        </div>
        
        {/* Revised document */}
        <div className="bg-gray-900 p-4">
          <div className="text-sm font-medium text-text-secondary mb-2">
            Revised Document
          </div>
          <div 
            className="bg-gray-800 p-3 rounded border border-gray-700 overflow-auto whitespace-pre-wrap font-mono text-sm"
            style={{ maxHeight }}
          >
            {revisedContent ? (
              <div className="flex">
                {showLineNumbers && renderLineNumbers(revisedContent)}
                <div className="flex-1">
                  {selectedMode === 'line' 
                    ? diffChunks
                        .filter(chunk => chunk.type !== 'removed')
                        .map(renderDiffChunk)
                    : calculateLineDiff(originalContent, revisedContent)
                        .filter(chunk => chunk.type !== 'removed')
                        .map(renderDiffChunk)
                  }
                </div>
              </div>
            ) : (
              <div className="text-gray-500">No revised document content</div>
            )}
          </div>
        </div>
      </div>
      
      {/* Unified view comparison */}
      <div className="bg-gray-900 p-4 border-t border-gray-800">
        <div className="text-sm font-medium text-text-secondary mb-2">
          Unified Comparison View
        </div>
        <div 
          className="bg-gray-800 p-3 rounded border border-gray-700 overflow-auto whitespace-pre-wrap font-mono text-sm"
          style={{ maxHeight }}
        >
          {diffChunks.length > 0 ? (
            <div className="flex">
              {showLineNumbers && renderLineNumbers(originalContent + revisedContent)}
              <div className="flex-1">
                {diffChunks.map(renderDiffChunk)}
              </div>
            </div>
          ) : (
            <div className="text-gray-500">
              {!originalContent || !revisedContent 
                ? 'Please provide both original and revised documents to compare'
                : 'No differences found between documents'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentComparison;
