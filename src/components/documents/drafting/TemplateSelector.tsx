import React, { useState, useEffect } from 'react';
import { DocumentTemplate, getAvailableTemplates } from '../../../services/templateService';

interface TemplateSelectorProps {
  onSelectTemplate: (template: DocumentTemplate) => void;
  selectedCategory?: string;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({ 
  onSelectTemplate,
  selectedCategory
}) => {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | undefined>(selectedCategory);

  useEffect(() => {
    const loadTemplates = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const { data, error } = await getAvailableTemplates(activeCategory);
        
        if (error) throw error;
        
        if (data) {
          setTemplates(data);
          
          // Extract unique categories
          const uniqueCategories = Array.from(new Set(data.map(template => template.category)));
          setCategories(uniqueCategories);
        }
      } catch (err) {
        console.error('Error loading templates:', err);
        setError('Failed to load templates. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadTemplates();
  }, [activeCategory]);

  // Filter templates by search term
  const filteredTemplates = templates.filter(template => 
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <div className="mb-4">
        <h2 className="text-lg font-medium text-text-primary mb-1">Document Templates</h2>
        <p className="text-sm text-text-secondary">Select a template to create a new document draft</p>
      </div>
      
      {/* Search and filters */}
      <div className="mb-4 space-y-3">
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search templates..."
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
        />
        
        {/* Category filter */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory(undefined)}
            className={`px-3 py-1 text-sm rounded-full ${!activeCategory ? 'bg-primary text-white' : 'bg-gray-800 text-text-secondary hover:bg-gray-700'}`}
          >
            All
          </button>
          
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-3 py-1 text-sm rounded-full ${activeCategory === category ? 'bg-primary text-white' : 'bg-gray-800 text-text-secondary hover:bg-gray-700'}`}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>
      </div>
      
      {/* Templates list */}
      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <div className="text-center py-6">
          <p className="text-red-400 mb-2">{error}</p>
          <button 
            onClick={() => setActiveCategory(activeCategory)} 
            className="text-primary hover:text-primary-hover"
          >
            Try Again
          </button>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-8">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-text-secondary">No templates found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {filteredTemplates.map(template => (
            <div 
              key={template.id}
              className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-primary cursor-pointer transition-all duration-200"
              onClick={() => onSelectTemplate(template)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-text-primary">{template.name}</h3>
                  <p className="text-sm text-text-secondary mt-1">{template.description}</p>
                </div>
                <span className="text-xs px-2 py-1 bg-gray-700 rounded-full text-primary">
                  {template.category.charAt(0).toUpperCase() + template.category.slice(1)}
                </span>
              </div>
              <div className="mt-3 text-xs text-gray-500 flex justify-between">
                <span>Variables: {template.variables.length}</span>
                <span>{template.isPublic ? 'Public' : 'Private'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TemplateSelector;
