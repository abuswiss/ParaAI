import React, { useState } from 'react';
import { importTemplate } from '@/services/templateService';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Label } from '@/components/ui/Label';
import { Spinner } from '@/components/ui/Spinner';
import { Icons } from '@/components/ui/Icons';

interface TemplateImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

const TemplateImportModal: React.FC<TemplateImportModalProps> = ({ isOpen, onClose, onImportSuccess }) => {
  const [jsonInput, setJsonInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    if (!jsonInput.trim()) {
      setError('Please paste valid template JSON.');
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      const { data, error: importError } = await importTemplate(jsonInput);
      if (importError) throw importError;
      
      // Optionally show a success message before closing
      console.log('Template imported successfully:', data?.name);
      onImportSuccess(); // Trigger list refresh and close
      setJsonInput(''); // Clear input on success
    } catch (err) {
      console.error("Error importing template:", err);
      setError(err instanceof Error ? err.message : "Failed to import template. Check JSON format.");
    } finally {
      setIsImporting(false);
    }
  };

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (!isOpen) {
      setJsonInput('');
      setError(null);
      setIsImporting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />
      <div className="relative z-50 w-full max-w-lg bg-surface rounded-lg shadow-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-text-primary">Import Template from JSON</h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="-mr-2">
            <Icons.Close className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Paste the JSON content of the template you want to import.
            {/* TODO: Add option for file upload */}
          </p>
          <div>
            <Label htmlFor="template-json-input">Template JSON</Label>
            <Textarea
              id="template-json-input"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='{ "name": "My Template", "category": "other", ... }'
              rows={10}
              className="mt-1 font-mono text-xs"
              disabled={isImporting}
            />
          </div>
          {error && (
            <p className="text-sm text-error">Error: {error}</p>
          )}
        </div>

        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={isImporting}>Cancel</Button>
          <Button onClick={handleImport} disabled={isImporting || !jsonInput.trim()}>
            {isImporting ? <Spinner size="sm" className="mr-2" /> : <Icons.Upload className="h-4 w-4 mr-2" />}
            {isImporting ? 'Importing...' : 'Import Template'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TemplateImportModal; 