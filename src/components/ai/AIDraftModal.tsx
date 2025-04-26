import React, { useState } from 'react';
import { generateDraftWithAI, createTemplate, createDraftFromTemplate } from '../../services/templateService';

interface AIDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: 'template' | 'document';
  onExport?: (content: string) => void;
}

const AIDraftModal: React.FC<AIDraftModalProps> = ({ isOpen, onClose, context, onExport }) => {
  const [step, setStep] = useState<'input' | 'draft' | 'refine'>('input');
  const [requirements, setRequirements] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftName, setDraftName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  // Use the real AI call for initial draft
  const handleGenerateDraft = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await generateDraftWithAI(requirements, undefined, context);
      if (error || !data) {
        setError(error?.message || 'Failed to generate draft.');
        setIsLoading(false);
        return;
      }
      setDraftContent(data);
      setStep('draft');
      setIsLoading(false);
    } catch {
      setError('Failed to generate draft.');
      setIsLoading(false);
    }
  };

  // Use the real AI call for refinement
  const handleRefineDraft = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await generateDraftWithAI(refinePrompt, draftContent, context);
      if (error || !data) {
        setError(error?.message || 'Failed to refine draft.');
        setIsLoading(false);
        return;
      }
      setDraftContent(data);
      setRefinePrompt('');
      setIsLoading(false);
    } catch {
      setError('Failed to refine draft.');
      setIsLoading(false);
    }
  };

  // Save to template or document draft
  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    setNotification(null);
    try {
      if (context === 'template') {
        const { data, error } = await createTemplate({
          name: draftName || 'Untitled Template',
          description: requirements,
          category: 'other',
          content: draftContent,
          variables: [],
          tags: [],
          isPublic: false
        });
        if (error || !data) throw error || new Error('Failed to save template');
        setNotification('Template saved successfully!');
      } else {
        const { data, error } = await createDraftFromTemplate(
          '', // No templateId for AI-generated
          draftName || 'Untitled Document',
          {}, // No variables
        );
        if (error || !data) throw error || new Error('Failed to save document draft');
        setNotification('Document draft saved successfully!');
      }
      setIsLoading(false);
      setTimeout(() => {
        setNotification(null);
        onClose();
      }, 1200);
    } catch (e: unknown) {
      const errMsg = typeof e === 'object' && e && 'message' in e ? (e as { message?: string }).message : 'Failed to save.';
      setError(errMsg || 'Failed to save.');
      setIsLoading(false);
    }
  };

  // Export as .txt file
  const handleExport = () => {
    if (!draftContent.trim()) return;
    const blob = new Blob([draftContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (draftName || 'ai_draft') + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotification('Draft exported as .txt!');
    setTimeout(() => setNotification(null), 1200);
    if (onExport) onExport(draftContent);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-gray-900 rounded-lg shadow-lg w-full max-w-2xl mx-4 p-6 relative">
        {/* Close button */}
        <button
          className="absolute top-3 right-3 text-gray-400 hover:text-white"
          onClick={onClose}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-xl font-semibold text-text-primary mb-4 text-center">
          AI Draft {context === 'template' ? 'Template' : 'Document'}
        </h2>
        {notification && (
          <div className="mb-4 p-2 bg-green-800 text-green-200 rounded text-center">{notification}</div>
        )}
        {step === 'input' && (
          <>
            <label className="block text-text-secondary mb-2">Describe what you want the AI to draft:</label>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-text-primary mb-4 min-h-[100px]"
              value={requirements}
              onChange={e => setRequirements(e.target.value)}
              placeholder="E.g. Draft a contract for..."
            />
            <button
              className="w-full py-2 bg-primary text-white rounded hover:bg-primary-hover disabled:opacity-50"
              onClick={handleGenerateDraft}
              disabled={!requirements.trim() || isLoading}
            >
              {isLoading ? 'Generating...' : 'Generate Draft'}
            </button>
            {error && <div className="text-red-400 mt-2">{error}</div>}
          </>
        )}
        {step === 'draft' && (
          <>
            <label className="block text-text-secondary mb-2">Draft Name</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-text-primary mb-4"
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              placeholder={`Untitled ${context === 'template' ? 'Template' : 'Document'}`}
            />
            <label className="block text-text-secondary mb-2">AI Draft</label>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-text-primary mb-4 min-h-[200px]"
              value={draftContent}
              onChange={e => setDraftContent(e.target.value)}
            />
            <div className="flex gap-2 mb-4">
              <input
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-text-primary"
                value={refinePrompt}
                onChange={e => setRefinePrompt(e.target.value)}
                placeholder="Refine or add instructions (optional)"
              />
              <button
                className="px-4 py-2 bg-accent-500 text-white rounded hover:bg-accent-600 disabled:opacity-50"
                onClick={handleRefineDraft}
                disabled={!refinePrompt.trim() || isLoading}
              >
                {isLoading ? 'Refining...' : 'Refine'}
              </button>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-hover"
                onClick={handleSave}
                disabled={!draftContent.trim() || isLoading}
              >
                Save
              </button>
              <button
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
                onClick={handleExport}
                disabled={!draftContent.trim()}
              >
                Export
              </button>
            </div>
            {error && <div className="text-red-400 mt-2">{error}</div>}
          </>
        )}
      </div>
    </div>
  );
};

export default AIDraftModal; 