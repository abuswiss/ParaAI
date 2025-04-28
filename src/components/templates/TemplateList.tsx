import React, { useState, useEffect } from 'react';
import { getAvailableTemplates, DocumentTemplate } from '@/services/templateService';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { AlertCircle, Star, PlusCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TemplateListProps {
  onSelectTemplate: (template: DocumentTemplate) => void;
  categoryFilter?: string;
}

const TemplateList: React.FC<TemplateListProps> = ({ onSelectTemplate, categoryFilter }) => {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await getAvailableTemplates(categoryFilter);
        if (fetchError) {
          throw fetchError;
        }
        setTemplates(data || []);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load templates';
        console.error('Error fetching templates:', err);
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [categoryFilter]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-500">
        <AlertCircle className="w-12 h-12 mb-4" />
        <p className="text-lg font-semibold">Error Loading Templates</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {templates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <Card
              key={template.id}
              title={template.name}
              subtitle={template.category}
              className="hover:shadow-primary/30 flex flex-col h-full"
              contentClassName="flex-grow"
              border
              hover
              footer={
                <div className="flex justify-between items-center">
                  <div className="flex flex-wrap gap-1">
                    {template.tags?.map((tag) => (
                      <Badge key={tag} variant="secondary" size="xs">
                        {tag}
                      </Badge>
                    ))}
                    {template.isPublic && <Badge variant="info" size="xs">Public</Badge>}
                  </div>
                  <div className="flex space-x-2">
                    <Link to={`/templates/edit/${template.id}`}>
                      <Button size="sm" variant="outline">Edit</Button>
                    </Link>
                    <Button size="sm" onClick={() => onSelectTemplate(template)}>Use</Button>
                  </div>
                </div>
              }
            >
              <p className="text-sm text-text-secondary mb-3 line-clamp-3 flex-grow">{template.description}</p>
              <div className="flex items-center justify-between text-xs text-text-secondary/70 mt-auto">
                <span>Updated: {new Date(template.updatedAt).toLocaleDateString()}</span>
                <div className="flex items-center">
                  <Star className="w-3 h-3 mr-1 text-yellow-500" />
                  <span>{template.useCount || 0} uses</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <AlertCircle className="w-12 h-12 mb-4" />
          <p className="text-lg font-semibold">No Templates Found</p>
          <p className="text-sm">Try adjusting your filters or create a new template.</p>
          <Link to="/templates/new">
            <Button variant="primary" size="sm" className="mt-4">
              <PlusCircle className="w-4 h-4 mr-2" />
              Create New Template
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
};

export default TemplateList; 