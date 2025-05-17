import React, { useState, useEffect } from 'react';
import { createCase, updateCase, Case } from '../../services/caseService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Textarea } from '../ui/Textarea';
import { Spinner } from '../ui/Spinner';
import { Icons } from '../ui/Icons';
import { toast } from 'react-hot-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';

interface CaseFormProps {
  isOpen: boolean;
  onClose: (refresh?: boolean) => void;
  caseData?: Case | null;
}

interface CaseFormData {
  name: string;
  description: string;
  client_name: string;
  opposing_party: string;
  case_number: string;
  court: string;
  status: 'active' | 'archived' | 'closed';
}

const CaseForm: React.FC<CaseFormProps> = ({ isOpen, onClose, caseData }) => {
  const [formData, setFormData] = useState<CaseFormData>({
    name: '',
    description: '',
    client_name: '',
    opposing_party: '',
    case_number: '',
    court: '',
    status: 'active',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!caseData;

  useEffect(() => {
    if (isEditMode && caseData) {
      setFormData({
        name: caseData.name || '',
        description: caseData.description || '',
        client_name: caseData.client_name || '',
        opposing_party: caseData.opposing_party || '',
        case_number: caseData.case_number || '',
        court: caseData.court || '',
        status: caseData.status || 'active',
      });
      setSuccess(false);
      setError(null);
    } else {
      setFormData({
        name: '',
        description: '',
        client_name: '',
        opposing_party: '',
        case_number: '',
        court: '',
        status: 'active',
      });
    }
  }, [isOpen, caseData, isEditMode]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Matter name is required');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      let result;
      const updates = { 
          name: formData.name,
          description: formData.description,
          client_name: formData.client_name,
          opposing_party: formData.opposing_party,
          case_number: formData.case_number,
          court: formData.court,
          status: formData.status
      };

      if (isEditMode && caseData) {
        console.log('Updating case:', caseData.id, updates);
        result = await updateCase(caseData.id, updates);
        if (!result.success || result.error) {
          throw result.error || new Error('Failed to update case.');
        }
        console.log('Case updated successfully');
      } else {
        console.log('Creating case:', updates);
        const { data: newCase, error } = await createCase(updates);
        if (error) throw error;
        // console.log('Case created successfully:', newCase);
        toast.success("Matter created successfully!");
        onClose(true);
      }

      setSuccess(true);
      setTimeout(() => {
        onClose(true);
      }, 1000);

    } catch (err) {
      console.error('Error submitting case form:', err);
      const errorMessage = err instanceof Error ? err.message : `Failed to ${isEditMode ? 'update' : 'create'} matter.`;
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-background/80 dark:bg-dark-background/80 backdrop-blur-sm z-40" onClick={() => onClose()} />

        <div className="relative z-50 w-full max-w-2xl bg-card dark:bg-dark-card backdrop-blur-md border border-border dark:border-dark-border rounded-lg shadow-xl p-6">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-foreground dark:text-dark-foreground">
                {isEditMode ? 'Edit Matter' : 'Create New Matter'}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => onClose()} className="-mr-2 text-muted-foreground hover:text-foreground dark:text-dark-muted-foreground dark:hover:text-dark-foreground">
                    <Icons.Close className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label>Matter Name *</Label>
                    <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="e.g., Smith v. Jones Discovery"
                        required
                    />
                </div>
                 <div>
                    <Label>Status</Label>
                    <select
                        id="status"
                        name="status"
                        value={formData.status}
                        onChange={handleInputChange}
                        className="block w-full mt-1 rounded-md border border-input dark:border-dark-input shadow-sm focus:border-primary dark:focus:border-dark-primary focus:ring-ring dark:focus:ring-dark-ring bg-input dark:bg-dark-input text-foreground dark:text-dark-foreground p-2 text-sm"
                    >
                        <option value="active">Active</option>
                        <option value="closed">Closed</option>
                        <option value="archived">Archived</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <Label>Client Name</Label>
                    <Input
                        id="client_name"
                        name="client_name"
                        value={formData.client_name}
                        onChange={handleInputChange}
                        placeholder="Enter client name"
                    />
                </div>
                 <div>
                    <Label>Opposing Party</Label>
                    <Input
                        id="opposing_party"
                        name="opposing_party"
                        value={formData.opposing_party}
                        onChange={handleInputChange}
                        placeholder="Enter opposing party name"
                    />
                </div>
            </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <Label>Case Number</Label>
                    <Input
                        id="case_number"
                        name="case_number"
                        value={formData.case_number}
                        onChange={handleInputChange}
                        placeholder="e.g., CV-2024-1234"
                    />
                </div>
                 <div>
                    <Label>Court</Label>
                    <Input
                        id="court"
                        name="court"
                        value={formData.court}
                        onChange={handleInputChange}
                        placeholder="e.g., Superior Court of California"
                    />
                </div>
            </div>

            <div>
                <Label>Description</Label>
                <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                placeholder="Enter case description or key details"
                />
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-border dark:border-dark-border mt-6">
                <Button
                type="button"
                variant="outline"
                onClick={() => onClose()}
                disabled={loading}
                >
                Cancel
                </Button>
                <Button
                type="submit"
                disabled={loading || success}
                variant={success ? undefined : "primary"} 
                className={`min-w-[120px] flex items-center justify-center ${success ? 'bg-success hover:bg-success/90 text-success-foreground' : ''}`}
                >
                {loading ? (
                    <><Spinner size="sm" className="mr-2" /> Saving...</>
                ) : success ? (
                    <><Icons.Check className="h-4 w-4 mr-2 text-success-foreground" /> Saved!</>
                ) : isEditMode ? (
                    'Save Changes'
                ) : (
                    'Create Matter'
                )}
                </Button>
            </div>
            </form>
        </div>
    </div>
  );
};

export default CaseForm;
