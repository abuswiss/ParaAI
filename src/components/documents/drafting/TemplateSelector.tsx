import React, { useState, useEffect, useRef } from 'react';
import { 
  DocumentTemplate, 
  getAvailableTemplates, 
  getRecentlyUsedTemplates,
  setTemplateFavorite,
  importTemplate,
  exportTemplate
} from '../../../services/templateService';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface TemplateSelectorProps {
  onSelectTemplate: (template: DocumentTemplate) => void;
  selectedCategory?: string;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({ 
  onSelectTemplate,
  selectedCategory
}) => {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [recentTemplates, setRecentTemplates] = useState<DocumentTemplate[]>([]);
  const [favoriteTemplates, setFavoriteTemplates] = useState<DocumentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | undefined>(selectedCategory);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'all' | 'recent' | 'favorites'>('all');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importContent, setImportContent] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importName, setImportName] = useState('');
  const [importDescription, setImportDescription] = useState('');
  const [importCategory, setImportCategory] = useState('');
  const [importTags, setImportTags] = useState('');

  // Move loadTemplates outside useEffect so it can be called directly
  const loadTemplates = async (category = activeCategory) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await getAvailableTemplates(category);
      if (error) throw error;
      if (data) {
        // Mark favorites in the templates list
        const templatesWithFavorites = data.map(template => ({
          ...template,
          isFavorite: template.isFavorite || false
        }));
        setTemplates(templatesWithFavorites);
        // Extract unique categories
        const uniqueCategories = Array.from(new Set(data.map(template => template.category)));
        setCategories(uniqueCategories);
        // Extract unique tags
        const allTags = data.flatMap(template => template.tags);
        const uniqueTags = Array.from(new Set(allTags));
        setAvailableTags(uniqueTags);
        // Filter favorites
        const favorites = templatesWithFavorites.filter(template => template.isFavorite);
        setFavoriteTemplates(favorites);
      }
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('Failed to load templates. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // useEffect just calls loadTemplates
  useEffect(() => {
    loadTemplates();
    // eslint-disable-next-line
  }, [activeCategory]);
  
  // Load recently used templates
  useEffect(() => {
    const loadRecentTemplates = async () => {
      setIsLoadingRecent(true);
      
      try {
        const { data, error } = await getRecentlyUsedTemplates(5); // Get the 5 most recently used templates
        
        if (error) throw error;
        
        if (data) {
          setRecentTemplates(data);
        }
      } catch (err) {
        console.error('Error loading recent templates:', err);
      } finally {
        setIsLoadingRecent(false);
      }
    };
    
    loadRecentTemplates();
  }, []);
  
  // Handle setting a template as favorite
  const toggleFavorite = async (template: DocumentTemplate) => {
    try {
      const newFavoriteStatus = !template.isFavorite;
      
      // Optimistically update UI
      const updatedTemplates = templates.map(t => 
        t.id === template.id ? { ...t, isFavorite: newFavoriteStatus } : t
      );
      setTemplates(updatedTemplates);
      
      // Update favorites list
      if (newFavoriteStatus) {
        setFavoriteTemplates(prev => [...prev, { ...template, isFavorite: true }]);
      } else {
        setFavoriteTemplates(prev => prev.filter(t => t.id !== template.id));
      }
      
      // Call API to update favorite status
      const { success, error } = await setTemplateFavorite(template.id, newFavoriteStatus);
      
      if (!success || error) {
        throw error || new Error('Failed to update favorite status');
      }
    } catch (err) {
      console.error('Error toggling favorite status:', err);
      // Revert changes if there was an error
      setIsLoading(true);
      const { data } = await getAvailableTemplates(activeCategory);
      if (data) {
        setTemplates(data);
        setFavoriteTemplates(data.filter(t => t.isFavorite));
      }
      setIsLoading(false);
    }
  };

  // Filter templates by search term, category, and tags
  const filteredTemplates = templates.filter(template => {
    // Text search matching
    const matchesSearch = 
      searchTerm === '' || 
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Tag filtering
    const matchesTags = 
      selectedTags.length === 0 || 
      selectedTags.some(tag => template.tags.includes(tag));
    
    return matchesSearch && matchesTags;
  });
  
  // Handle importing templates from file
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    const mimeType = file.type;

    if (extension === 'json' || mimeType === 'application/json') {
      // JSON import (existing logic)
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          setImportContent(content);
          setShowImportModal(true);
        } catch (err) {
          console.error('Error reading file:', err);
          setImportError('Failed to read the template file. Please try again.');
        }
      };
      reader.readAsText(file);
    } else if (extension === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      extractDocxTemplate(file);
    } else if (extension === 'pdf' || mimeType === 'application/pdf') {
      extractPdfTemplate(file);
    } else if (extension === 'rtf' || mimeType === 'application/rtf') {
      extractRtfTemplate(file);
    } else if (extension === 'txt' || mimeType === 'text/plain') {
      extractTxtTemplate(file);
    } else {
      setImportError('Unsupported file type. Please select a JSON, DOCX, PDF, TXT, or RTF file.');
    }
  };

  // Extraction stubs (to be implemented in next steps)
  const extractDocxTemplate = (file: File) => {
    setImportError(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result;
        if (!(arrayBuffer instanceof ArrayBuffer)) throw new Error('Could not read DOCX file.');
        const { value: text } = await mammoth.extractRawText({ arrayBuffer });
        setImportContent(text);
        setShowImportModal(true);
      } catch (err) {
        console.error('Error extracting DOCX:', err);
        setImportError('Failed to extract text from DOCX file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };
  const extractPdfTemplate = (file: File) => {
    setImportError(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result;
        if (!arrayBuffer) throw new Error('Could not read PDF file.');
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += (content.items as TextItem[]).map(item => item.str).join(' ') + '\n';
        }
        setImportContent(text);
        setShowImportModal(true);
      } catch (err) {
        console.error('Error extracting PDF:', err);
        setImportError('Failed to extract text from PDF file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };
  const extractRtfTemplate = (file: File) => {
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rtf = e.target?.result as string;
        if (!rtf) throw new Error('Could not read RTF file.');
        // Simple RTF to text: remove RTF tags and control words
        const text = rtf
          .replace(/\\par[d]?/g, '\n')
          .replace(/\\[a-z]+[0-9]? ?/g, '')
          .replace(/[{}]/g, '')
          .replace(/\n{2,}/g, '\n')
          .replace(/\s+/g, ' ')
          .trim();
        setImportContent(text);
        setShowImportModal(true);
      } catch (err) {
        console.error('Error extracting RTF:', err);
        setImportError('Failed to extract text from RTF file.');
      }
    };
    reader.readAsText(file);
  };
  const extractTxtTemplate = (file: File) => {
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) throw new Error('Could not read TXT file.');
        setImportContent(text);
        setShowImportModal(true);
      } catch (err) {
        console.error('Error extracting TXT:', err);
        setImportError('Failed to extract text from TXT file.');
      }
    };
    reader.readAsText(file);
  };
  
  // Handle exporting templates
  const handleExportTemplate = async (template: DocumentTemplate) => {
    try {
      const exportButton = document.getElementById(`export-btn-${template.id}`);
      if (exportButton) {
        exportButton.classList.add('animate-pulse', 'text-accent-500');
      }
      
      const { data, error } = await exportTemplate(template.id);
      
      if (error) throw error;
      if (!data) throw new Error('No data received');
      
      // Create and download the file
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${template.name.replace(/\s+/g, '_').toLowerCase()}_template.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error('Error exporting template:', err);
      alert(`Failed to export template: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      // Remove any UI effects we added
      const exportButton = document.getElementById(`export-btn-${template.id}`);
      if (exportButton) {
        exportButton.classList.remove('animate-pulse', 'text-accent-500');
      }
    }
  };

  // When importContent changes, prefill name and category if possible
  useEffect(() => {
    if (showImportModal && importContent) {
      if (!importName) setImportName('Imported Template');
      if (!importCategory) setImportCategory('other');
    }
    // eslint-disable-next-line
  }, [showImportModal, importContent]);

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <div className="mb-4">
        <h2 className="text-lg font-medium text-text-primary mb-1">Document Templates</h2>
        <p className="text-sm text-text-secondary">Select a template to create a new document draft</p>
      </div>
      
      {/* Search and filters */}
      <div className="mb-4 space-y-3">
        {/* Search input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {/* Search icon */}
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search templates..."
            className="w-full pl-10 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-accent-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {/* View mode selector */}
        <div className="flex items-center gap-2">
          <button
            className={`px-4 py-2 rounded-md ${viewMode === 'all' ? 'bg-accent-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            onClick={() => setViewMode('all')}
          >
            All
          </button>
          <button
            className={`px-4 py-2 rounded-md ${viewMode === 'recent' ? 'bg-accent-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            onClick={() => setViewMode('recent')}
          >
            Recent
          </button>
          <button
            className={`px-4 py-2 rounded-md ${viewMode === 'favorites' ? 'bg-accent-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            onClick={() => setViewMode('favorites')}
          >
            Favorites
          </button>
          
          {/* Import/Export buttons */}
          <div className="ml-auto flex gap-2">
            <button
              className="px-4 py-2 rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 flex items-center gap-1"
              onClick={() => setShowImportModal(true)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              Import
            </button>
            <input 
              type="file" 
              accept=".json,application/json,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,application/pdf,.txt,text/plain,.rtf,application/rtf" 
              className="hidden" 
              ref={importFileRef}
              onChange={handleFileImport}
            />
          </div>
        </div>
      </div>

      {/* Category selector - only show when in 'all' view */}
      {viewMode === 'all' && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            className={`px-4 py-2 rounded-md ${!activeCategory ? 'bg-accent-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            onClick={() => setActiveCategory(undefined)}
          >
            All
          </button>
          {categories.map(category => (
            <button
              key={category}
              className={`px-4 py-2 rounded-md ${activeCategory === category ? 'bg-accent-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      )}
      
      {/* Tag selector - only show when in 'all' view */}
      {viewMode === 'all' && availableTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-gray-400">Tags:</span>
          {availableTags.map(tag => (
            <button
              key={tag}
              className={`px-3 py-1 rounded-full text-sm ${selectedTags.includes(tag) ? 'bg-accent-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              onClick={() => {
                if (selectedTags.includes(tag)) {
                  setSelectedTags(selectedTags.filter(t => t !== tag));
                } else {
                  setSelectedTags([...selectedTags, tag]);
                }
              }}
            >
              {tag}
            </button>
          ))}
          {selectedTags.length > 0 && (
            <button
              className="px-3 py-1 rounded-full text-sm bg-red-500 text-white hover:bg-red-600"
              onClick={() => setSelectedTags([])}
            >
              Clear
            </button>
          )}
        </div>
      )}
      
      {/* Display templates based on view mode */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {viewMode === 'all' && isLoading ? (
          <p className="text-gray-400 col-span-full text-center py-8">Loading templates...</p>
        ) : viewMode === 'recent' && isLoadingRecent ? (
          <p className="text-gray-400 col-span-full text-center py-8">Loading recent templates...</p>
        ) : error ? (
          <p className="text-red-500 col-span-full text-center py-8">{error}</p>
        ) : (
          <>
            {/* Recent templates view */}
            {viewMode === 'recent' && (
              recentTemplates.length === 0 ? (
                <p className="text-gray-400 col-span-full text-center py-8">No recently used templates found.</p>
              ) : (
                recentTemplates.map(template => (
                  <div 
                    key={template.id} 
                    className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors cursor-pointer flex flex-col relative"
                    onClick={() => onSelectTemplate(template)}
                  >
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button 
                        id={`export-btn-${template.id}`}
                        className="text-gray-400 hover:text-accent-500 focus:outline-none"
                        title="Export template"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportTemplate(template);
                        }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7l4-4m0 0l4 4m-4-4v18" />
                        </svg>
                      </button>
                      <button 
                        className="text-gray-400 hover:text-accent-500 focus:outline-none"
                        title="Favorite template"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(template);
                        }}
                      >
                      {template.isFavorite ? (
                        <svg className="w-5 h-5 fill-current text-yellow-500" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 fill-current text-gray-400" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      )}
                      </button>
                    </div>
                    <h3 className="text-white font-medium text-lg mb-1">{template.name}</h3>
                    <p className="text-gray-400 text-sm mb-2">{template.description}</p>
                    <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-700">
                      <span className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
                        {template.category}
                      </span>
                      {template.tags.map(tag => (
                        <span key={tag} className="px-2 py-1 bg-accent-500 bg-opacity-20 rounded text-xs text-accent-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )
            )}
            
            {/* Favorites view */}
            {viewMode === 'favorites' && (
              favoriteTemplates.length === 0 ? (
                <p className="text-gray-400 col-span-full text-center py-8">No favorite templates found.</p>
              ) : (
                favoriteTemplates.map(template => (
                  <div 
                    key={template.id} 
                    className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors cursor-pointer flex flex-col relative"
                    onClick={() => onSelectTemplate(template)}
                  >
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button 
                        id={`export-btn-${template.id}`}
                        className="text-gray-400 hover:text-accent-500 focus:outline-none"
                        title="Export template"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportTemplate(template);
                        }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7l4-4m0 0l4 4m-4-4v18" />
                        </svg>
                      </button>
                      <button 
                        className="text-gray-400 hover:text-accent-500 focus:outline-none"
                        title="Favorite template"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(template);
                        }}
                      >
                      <svg className="w-5 h-5 fill-current text-yellow-500" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      </button>
                    </div>
                    <h3 className="text-white font-medium text-lg mb-1">{template.name}</h3>
                    <p className="text-gray-400 text-sm mb-2">{template.description}</p>
                    <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-700">
                      <span className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
                        {template.category}
                      </span>
                      {template.tags.map(tag => (
                        <span key={tag} className="px-2 py-1 bg-accent-500 bg-opacity-20 rounded text-xs text-accent-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )
            )}
            
            {/* All templates view */}
            {viewMode === 'all' && (
              filteredTemplates.length === 0 ? (
                <p className="text-gray-400 col-span-full text-center py-8">No templates found matching your criteria.</p>
              ) : (
                filteredTemplates.map(template => (
                  <div 
                    key={template.id} 
                    className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors cursor-pointer flex flex-col relative"
                    onClick={() => onSelectTemplate(template)}
                  >
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button 
                        id={`export-btn-${template.id}`}
                        className="text-gray-400 hover:text-accent-500 focus:outline-none"
                        title="Export template"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportTemplate(template);
                        }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7l4-4m0 0l4 4m-4-4v18" />
                        </svg>
                      </button>
                      <button 
                        className="text-gray-400 hover:text-accent-500 focus:outline-none"
                        title="Favorite template"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(template);
                        }}
                      >
                      {template.isFavorite ? (
                        <svg className="w-5 h-5 fill-current text-yellow-500" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 fill-current text-gray-400" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      )}
                      </button>
                    </div>
                    <h3 className="text-white font-medium text-lg mb-1">{template.name}</h3>
                    <p className="text-gray-400 text-sm mb-2">{template.description}</p>
                    <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-700">
                      <span className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
                        {template.category}
                      </span>
                      {template.tags.map(tag => (
                        <span key={tag} className="px-2 py-1 bg-accent-500 bg-opacity-20 rounded text-xs text-accent-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )
            )}
          </>
        )}
      </div>
      
      {/* Import template modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full relative">
            {/* Close (X) button */}
            <button
              type="button"
              className="absolute top-3 right-3 text-gray-400 hover:text-white focus:outline-none"
              aria-label="Close import dialog"
              onClick={() => {
                setShowImportModal(false);
                setImportContent('');
                setImportError(null);
                setImportName('');
                setImportDescription('');
                setImportCategory('');
                setImportTags('');
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h3 className="text-white text-lg font-medium mb-4">Import Template</h3>
            {importContent ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setIsImporting(true);
                  setImportError(null);
                  // Validate required fields
                  if (!importName.trim() || !importCategory.trim() || !importContent.trim()) {
                    setImportError('Name, category, and content are required.');
                    setIsImporting(false);
                    return;
                  }
                  // Build template JSON
                  const templateJson = JSON.stringify({
                    name: importName,
                    description: importDescription,
                    category: importCategory,
                    content: importContent,
                    tags: importTags.split(',').map(t => t.trim()).filter(Boolean),
                  });
                  const { error } = await importTemplate(templateJson);
                  if (error) {
                    setImportError(error.message || 'Failed to import template.');
                  } else {
                    setShowImportModal(false);
                    setImportContent('');
                    setImportError(null);
                    setImportName('');
                    setImportDescription('');
                    setImportCategory('');
                    setImportTags('');
                    // Refresh the template list immediately
                    await loadTemplates();
                  }
                  setIsImporting(false);
                }}
              >
                <div className="mb-3">
                  <label className="block text-gray-300 text-sm mb-1">Name <span className="text-red-500">*</span></label>
                  <input
                    className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                    value={importName}
                    onChange={e => setImportName(e.target.value)}
                    placeholder="Template Name"
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-gray-300 text-sm mb-1">Description</label>
                  <input
                    className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                    value={importDescription}
                    onChange={e => setImportDescription(e.target.value)}
                    placeholder="Short description (optional)"
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-gray-300 text-sm mb-1">Category <span className="text-red-500">*</span></label>
                  <select
                    className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                    value={importCategory}
                    onChange={e => setImportCategory(e.target.value)}
                    required
                  >
                    <option value="">Select category</option>
                    <option value="contract">Contract</option>
                    <option value="letter">Letter</option>
                    <option value="pleading">Pleading</option>
                    <option value="agreement">Agreement</option>
                    <option value="memorandum">Memorandum</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="block text-gray-300 text-sm mb-1">Tags (comma separated)</label>
                  <input
                    className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                    value={importTags}
                    onChange={e => setImportTags(e.target.value)}
                    placeholder="e.g. NDA, employment, litigation"
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-gray-300 text-sm mb-1">Content <span className="text-red-500">*</span></label>
                  <textarea
                    className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                    value={importContent}
                    onChange={e => setImportContent(e.target.value)}
                    rows={8}
                    required
                  />
                </div>
                {importError && (
                  <div className="bg-red-900 bg-opacity-50 text-red-200 p-2 rounded mb-2 text-sm">{importError}</div>
                )}
                <div className="flex justify-end gap-3 mt-4">
                  <button
                    type="button"
                    className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600"
                    onClick={() => {
                      setShowImportModal(false);
                      setImportContent('');
                      setImportError(null);
                      setImportName('');
                      setImportDescription('');
                      setImportCategory('');
                      setImportTags('');
                    }}
                    disabled={isImporting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-accent-500 text-white rounded-md hover:bg-accent-600 flex items-center gap-2"
                    disabled={isImporting}
                  >
                    {isImporting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Importing...
                      </>
                    ) : (
                      'Import Template'
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p className="text-gray-300 mb-4">Select a JSON, DOCX, PDF, TXT, or RTF file containing the template data</p>
                <button
                  className="w-full py-2 px-4 bg-gray-700 text-white rounded-md hover:bg-gray-600 mb-4 flex items-center justify-center gap-2"
                  onClick={() => importFileRef.current?.click()}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  Select File
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateSelector;