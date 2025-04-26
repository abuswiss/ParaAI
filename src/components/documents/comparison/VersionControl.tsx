import React, { useState, useEffect } from 'react';
import { Document } from '../../../types/document';
import { DocumentDraft } from '../../../services/templateService';
import DocumentComparison from './DocumentComparison';

interface DocumentVersion {
  id: string;
  name: string;
  date: string;
  content: string;
  type: 'document' | 'draft';
  versionLabel?: string;
}

interface VersionControlProps {
  drafts?: DocumentDraft[];
  documents?: Document[];
  initialVersion1?: string;
  initialVersion2?: string;
}

const VersionControl: React.FC<VersionControlProps> = ({
  drafts = [],
  documents = [],
  initialVersion1,
  initialVersion2
}) => {
  // State for selected versions to compare
  const [selectedVersion1, setSelectedVersion1] = useState<string | undefined>(initialVersion1);
  const [selectedVersion2, setSelectedVersion2] = useState<string | undefined>(initialVersion2);
  
  // State to track all available versions
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  
  // Comparison mode
  const [comparisonMode] = useState<'line' | 'word'>('line');
  
  // Content of selected versions
  const [version1Content, setVersion1Content] = useState('');
  const [version2Content, setVersion2Content] = useState('');
  
  // Process documents and drafts into versions
  useEffect(() => {
    const documentVersions: DocumentVersion[] = documents.map(doc => ({
      id: doc.id,
      name: doc.filename,
      date: doc.uploadedAt,
      content: doc.extractedText || '',
      type: 'document',
      versionLabel: 'Document'
    }));
    
    const draftVersions: DocumentVersion[] = drafts.map(draft => ({
      id: draft.id,
      name: draft.name,
      date: draft.updatedAt,
      content: draft.content,
      type: 'draft',
      versionLabel: 'Draft'
    }));
    
    // Combine and sort by date (newest first)
    const allVersions = [...documentVersions, ...draftVersions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    setVersions(allVersions);
    
    // Select first two versions by default if not specified
    if (!selectedVersion1 && allVersions.length > 0) {
      setSelectedVersion1(allVersions[0].id);
    }
    
    if (!selectedVersion2 && allVersions.length > 1) {
      setSelectedVersion2(allVersions[1].id);
    }
  }, [documents, drafts, initialVersion1, initialVersion2]);
  
  // Update content when selected versions change
  useEffect(() => {
    if (selectedVersion1) {
      const version = versions.find(v => v.id === selectedVersion1);
      if (version) {
        setVersion1Content(version.content);
      }
    }
    
    if (selectedVersion2) {
      const version = versions.find(v => v.id === selectedVersion2);
      if (version) {
        setVersion2Content(version.content);
      }
    }
  }, [selectedVersion1, selectedVersion2, versions]);
  
  // Get version details
  const getVersionDetails = (versionId?: string) => {
    if (!versionId) return null;
    return versions.find(v => v.id === versionId);
  };
  
  const version1Details = getVersionDetails(selectedVersion1);
  const version2Details = getVersionDetails(selectedVersion2);
  
  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-lg font-medium text-text-primary">Document Version Control</h2>
        <p className="text-sm text-text-secondary">Compare different versions of your documents</p>
      </div>
      
      {/* Version selector */}
      <div className="p-4 border-b border-gray-800 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Version 1 selector */}
        <div>
          <label className="block text-sm text-text-secondary mb-2">Original Version</label>
          <select
            value={selectedVersion1 || ''}
            onChange={e => setSelectedVersion1(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-text-primary focus:outline-none focus:border-primary"
          >
            <option value="">Select version...</option>
            {versions.map(version => (
              <option key={version.id} value={version.id}>
                {version.name} ({new Date(version.date).toLocaleDateString()}) - {version.versionLabel}
              </option>
            ))}
          </select>
        </div>
        
        {/* Version 2 selector */}
        <div>
          <label className="block text-sm text-text-secondary mb-2">Revised Version</label>
          <select
            value={selectedVersion2 || ''}
            onChange={e => setSelectedVersion2(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-text-primary focus:outline-none focus:border-primary"
          >
            <option value="">Select version...</option>
            {versions.map(version => (
              <option key={version.id} value={version.id}>
                {version.name} ({new Date(version.date).toLocaleDateString()}) - {version.versionLabel}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Info cards for selected versions */}
      {(version1Details || version2Details) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0.5 bg-gray-800">
          {version1Details && (
            <div className="bg-gray-900 p-4">
              <h3 className="font-medium text-text-primary">{version1Details.name}</h3>
              <p className="text-sm text-text-secondary mt-1">
                Last updated: {new Date(version1Details.date).toLocaleString()}
              </p>
              <div className="mt-2 inline-block px-2 py-1 text-xs rounded-full bg-gray-800 text-primary">
                {version1Details.versionLabel || version1Details.type}
              </div>
            </div>
          )}
          
          {version2Details && (
            <div className="bg-gray-900 p-4">
              <h3 className="font-medium text-text-primary">{version2Details.name}</h3>
              <p className="text-sm text-text-secondary mt-1">
                Last updated: {new Date(version2Details.date).toLocaleString()}
              </p>
              <div className="mt-2 inline-block px-2 py-1 text-xs rounded-full bg-gray-800 text-primary">
                {version2Details.versionLabel || version2Details.type}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Comparison component */}
      {selectedVersion1 && selectedVersion2 && (
        <DocumentComparison
          originalText={version1Content}
          revisedText={version2Content}
          comparisonMode={comparisonMode}
          title="Version Comparison"
        />
      )}
      
      {/* No versions selected message */}
      {(!selectedVersion1 || !selectedVersion2) && (
        <div className="p-8 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <h3 className="text-lg font-medium text-text-primary mb-2">
            {versions.length === 0 
              ? 'No Document Versions Available' 
              : 'Select Versions to Compare'}
          </h3>
          <p className="text-text-secondary max-w-md mx-auto">
            {versions.length === 0 
              ? 'Upload documents or create drafts to enable version comparison.' 
              : 'Select two versions above to see the differences between them.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default VersionControl;
