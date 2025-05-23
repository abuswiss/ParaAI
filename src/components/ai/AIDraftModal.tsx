import React, { useState, useEffect } from 'react';
import { generateDraftWithAI, createTemplate, createDraftFromTemplate, createAIDraft } from '../../services/templateService';
import { saveAs } from 'file-saver';
import { X } from 'lucide-react';

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts',
  'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island',
  'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming'
];

export interface AIDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  context?: 'document' | 'template' | 'general' | null;
  onExport?: (content: string) => void;
  initialContent?: string;
  onDraftCreated: (draftId: string) => void;
}

type DocumentType = 'contract' | 'letter' | 'pleading' | 'memorandum' | 'agreement' | 'other';

const AIDraftModal: React.FC<AIDraftModalProps> = ({ isOpen, onClose, context, onExport, initialContent, onDraftCreated }) => {
  const [step, setStep] = useState<'input' | 'draft' | 'refine'>('input');
  const [requirements, setRequirements] = useState('');
  const [docType, setDocType] = useState<DocumentType>('contract');
  const [jurisdiction, setJurisdiction] = useState('US Federal');
  const [audience, setAudience] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [draftContent, setDraftContent] = useState(initialContent || '');
  const [draftName, setDraftName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [notification, setNotification] = useState<string | null>(null);
  const [saveMode, setSaveMode] = useState<'none' | 'document' | 'template'>('none');

  // When initialContent changes (e.g., when opening modal), update draftContent
  useEffect(() => {
    if (isOpen && initialContent !== undefined) {
      setDraftContent(initialContent);
    }
  }, [isOpen, initialContent]);

  // Compose a detailed prompt for the AI
  const buildAIPrompt = () => {
    let prompt = `Type of Document: ${docType}\n`;
    prompt += `Jurisdiction: ${jurisdiction}\n`;
    if (audience.trim()) prompt += `Intended Audience: ${audience}\n`;
    if (specialInstructions.trim()) prompt += `Special Instructions: ${specialInstructions}\n`;
    prompt += `Requirements: ${requirements}`;
    return prompt;
  };

  // Use the real AI call for initial draft
  const handleGenerateDraft = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const aiPrompt = buildAIPrompt();
      const { data, error } = await generateDraftWithAI(aiPrompt, undefined, context);
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
      if (saveMode === 'template') {
        const { data, error } = await createTemplate({
          name: draftName || 'Untitled Template',
          description: requirements,
          category: docType,
          content: draftContent,
          variables: [],
          tags: [jurisdiction, ...(audience ? [audience] : []), ...(specialInstructions ? [specialInstructions] : [])],
          isPublic: false
        });
        if (error || !data) throw error || new Error('Failed to save template');
        setNotification('Template saved successfully!');
        setTimeout(() => {
          setNotification(null);
          onClose();
        }, 1200);
      } else if (saveMode === 'document') {
        const { data, error } = await createAIDraft(
          draftName || 'Untitled Document',
          draftContent
        );
        if (error || !data) throw error || new Error('Failed to save document draft');
        setNotification('Document draft saved successfully!');
        if (onDraftCreated) {
          onDraftCreated(data.id);
        }
        onClose();
      }
      setIsLoading(false);
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

  // Utility: Export as .txt
  const exportAsTxt = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain' });
    saveAs(blob, filename + '.txt');
  };

  // Utility: Export as .docx
  const exportAsDocx = async (text: string, filename: string) => {
    const { Document, Packer, Paragraph } = await import('docx');
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [new Paragraph(text)],
        },
      ],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, filename + '.docx');
  };

  // Utility: Export as .pdf
  const exportAsPdf = async (text: string, filename: string) => {
    const jsPDF = (await import('jspdf')).default;
    const doc = new jsPDF();
    doc.setFont('courier');
    doc.setFontSize(12);
    doc.text(text, 10, 10);
    doc.save(filename + '.pdf');
  };

  // Utility: Export as .json (for templates)
  const exportAsJson = (templateObj: object, filename: string) => {
    const blob = new Blob([JSON.stringify(templateObj, null, 2)], { type: 'application/json' });
    saveAs(blob, filename + '.json');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm">
      <div className="bg-card dark:bg-dark-card backdrop-blur-md shadow-xl border border-card-border dark:border-dark-card-border rounded-lg w-full max-w-4xl mx-4 p-8 relative">
        {/* Close button */}
        <button
          className="absolute top-4 right-4 text-muted-foreground dark:text-dark-muted-foreground hover:text-foreground dark:hover:text-dark-foreground p-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:focus-visible:ring-dark-ring"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-2xl font-semibold text-foreground dark:text-dark-foreground mb-6 text-center">
          AI Draft {context === 'template' ? 'Template' : 'Document'}
        </h2>
        {notification && (
          <div className="mb-6 p-3 bg-success/20 dark:bg-dark-success/20 text-success dark:text-dark-success border border-success/30 dark:border-dark-success/30 rounded text-center">{notification}</div>
        )}
        {step === 'input' && (
          <>
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-foreground dark:text-dark-foreground mb-2">Type of Document</label>
                <select
                  className="w-full bg-input dark:bg-dark-input border border-input-border dark:border-dark-input-border rounded px-4 py-3 text-foreground dark:text-dark-foreground focus:outline-none focus:ring-2 focus:ring-ring dark:focus:ring-dark-ring focus:border-ring dark:focus:border-dark-ring"
                  value={docType}
                  onChange={e => setDocType(e.target.value as DocumentType)}
                >
                  <option value="contract">Contract</option>
                  <option value="letter">Letter</option>
                  <option value="pleading">Pleading</option>
                  <option value="memorandum">Memorandum</option>
                  <option value="agreement">Agreement</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground dark:text-dark-foreground mb-2">Jurisdiction</label>
                <select
                  className="w-full bg-input dark:bg-dark-input border border-input-border dark:border-dark-input-border rounded px-4 py-3 text-foreground dark:text-dark-foreground focus:outline-none focus:ring-2 focus:ring-ring dark:focus:ring-dark-ring focus:border-ring dark:focus:border-dark-ring"
                  value={jurisdiction}
                  onChange={e => setJurisdiction(e.target.value)}
                >
                  <option value="US Federal">US Federal</option>
                  {US_STATES.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                  <option value="Other/None">Other/None</option>
                </select>
              </div>
            </div>
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-foreground dark:text-dark-foreground mb-2">Intended Audience <span className="text-xs text-muted-foreground dark:text-dark-muted-foreground">(optional)</span></label>
                <textarea
                  className="w-full bg-input dark:bg-dark-input border border-input-border dark:border-dark-input-border rounded px-4 py-3 text-foreground dark:text-dark-foreground min-h-[80px] placeholder:text-muted-foreground dark:placeholder:text-dark-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring dark:focus:ring-dark-ring focus:border-ring dark:focus:border-dark-ring"
                  value={audience}
                  onChange={e => setAudience(e.target.value)}
                  placeholder="E.g. Client, Court, Opposing Counsel"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground dark:text-dark-foreground mb-2">Special Instructions <span className="text-xs text-muted-foreground dark:text-dark-muted-foreground">(optional)</span></label>
                <textarea
                  className="w-full bg-input dark:bg-dark-input border border-input-border dark:border-dark-input-border rounded px-4 py-3 text-foreground dark:text-dark-foreground min-h-[80px] placeholder:text-muted-foreground dark:placeholder:text-dark-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring dark:focus:ring-dark-ring focus:border-ring dark:focus:border-dark-ring"
                  value={specialInstructions}
                  onChange={e => setSpecialInstructions(e.target.value)}
                  placeholder="E.g. Use plain English, include indemnification clause"
                />
              </div>
            </div>
            <label className="block text-sm font-medium text-foreground dark:text-dark-foreground mb-2">Describe what you want the AI to draft:</label>
            <textarea
              className="w-full bg-input dark:bg-dark-input border border-input-border dark:border-dark-input-border rounded px-4 py-3 text-foreground dark:text-dark-foreground mb-6 min-h-[150px] placeholder:text-muted-foreground dark:placeholder:text-dark-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring dark:focus:ring-dark-ring focus:border-ring dark:focus:border-dark-ring"
              value={requirements}
              onChange={e => setRequirements(e.target.value)}
              placeholder="E.g. Draft a contract for..."
            />
            <button
              className="w-full py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-colors duration-150 shadow-md"
              onClick={handleGenerateDraft}
              disabled={!requirements.trim() || isLoading}
            >
              {isLoading ? 'Generating...' : 'Generate Draft'}
            </button>
            {error && <div className="text-destructive dark:text-dark-destructive mt-4">{error}</div>}
          </>
        )}
        {step === 'draft' && (
          <>
            <div className="mt-6">
              {saveMode === 'none' && (
                <div className="flex flex-col items-center space-y-4">
                  <div className="text-muted-foreground dark:text-dark-muted-foreground mb-2">How would you like to save this draft?</div>
                  <div className="flex gap-4">
                    <button
                      className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary-hover"
                      onClick={() => setSaveMode('document')}
                    >
                      Save as Document
                    </button>
                    <button
                      className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary-hover"
                      onClick={() => setSaveMode('template')}
                    >
                      Save as Template
                    </button>
                  </div>
                </div>
              )}
              {saveMode !== 'none' && (
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    handleSave();
                  }}
                  className="mt-4 flex flex-col gap-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-foreground dark:text-dark-foreground mb-1">{saveMode === 'template' ? 'Template Name' : 'Document Name'}</label>
                    <input
                      type="text"
                      value={draftName}
                      onChange={e => setDraftName(e.target.value)}
                      className="w-full bg-input dark:bg-dark-input border border-input-border dark:border-dark-input-border rounded px-3 py-2 text-foreground dark:text-dark-foreground placeholder:text-muted-foreground dark:placeholder:text-dark-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring dark:focus:ring-dark-ring focus:border-ring dark:focus:border-dark-ring"
                      placeholder={saveMode === 'template' ? 'Enter template name...' : 'Enter document name...'}
                      required
                    />
                  </div>
                  {saveMode === 'template' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-foreground dark:text-dark-foreground mb-1">Description</label>
                        <input
                          type="text"
                          value={requirements}
                          onChange={e => setRequirements(e.target.value)}
                          className="w-full bg-input dark:bg-dark-input border border-input-border dark:border-dark-input-border rounded px-3 py-2 text-foreground dark:text-dark-foreground placeholder:text-muted-foreground dark:placeholder:text-dark-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring dark:focus:ring-dark-ring focus:border-ring dark:focus:border-dark-ring"
                          placeholder="Describe this template (optional)"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground dark:text-dark-foreground mb-1">Category</label>
                        <select
                          value={docType}
                          onChange={e => setDocType(e.target.value as DocumentType)}
                          className="w-full bg-input dark:bg-dark-input border border-input-border dark:border-dark-input-border rounded px-3 py-2 text-foreground dark:text-dark-foreground focus:outline-none focus:ring-2 focus:ring-ring dark:focus:ring-dark-ring focus:border-ring dark:focus:border-dark-ring"
                        >
                          <option value="contract">Contract</option>
                          <option value="letter">Legal Letter</option>
                          <option value="pleading">Pleading</option>
                          <option value="memorandum">Legal Memorandum</option>
                          <option value="agreement">Agreement</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </>
                  )}
                  <div className="flex gap-4 mt-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary-hover disabled:opacity-60"
                      disabled={isLoading}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary-hover"
                      onClick={() => setSaveMode('none')}
                      disabled={isLoading}
                    >
                      Back
                    </button>
                  </div>
                  {error && <div className="text-destructive dark:text-dark-destructive text-sm mt-2">{error}</div>}
                </form>
              )}
            </div>
            <label className="block text-sm font-medium text-foreground dark:text-dark-foreground mb-2 mt-6">AI Draft</label>
            <textarea
              className="w-full bg-input dark:bg-dark-input border border-input-border dark:border-dark-input-border rounded px-4 py-3 text-foreground dark:text-dark-foreground mb-6 min-h-[300px] focus:outline-none focus:ring-2 focus:ring-ring dark:focus:ring-dark-ring focus:border-ring dark:focus:border-dark-ring"
              value={draftContent}
              onChange={e => setDraftContent(e.target.value)}
            />
            <div className="flex gap-4 mb-6">
              <input
                className="flex-1 bg-input dark:bg-dark-input border border-input-border dark:border-dark-input-border rounded px-4 py-3 text-foreground dark:text-dark-foreground placeholder:text-muted-foreground dark:placeholder:text-dark-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring dark:focus:ring-dark-ring focus:border-ring dark:focus:border-dark-ring"
                value={refinePrompt}
                onChange={e => setRefinePrompt(e.target.value)}
                placeholder="Refine or add instructions (optional)"
              />
              <button
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-colors duration-150 shadow-md"
                onClick={handleRefineDraft}
                disabled={!refinePrompt.trim() || isLoading}
              >
                {isLoading ? 'Refining...' : 'Refine'}
              </button>
            </div>
            <div className="flex gap-4 justify-end">
              <button
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-colors duration-150 shadow-md"
                onClick={handleExport}
                disabled={!draftContent.trim()}
              >
                Export
              </button>
            </div>
            {error && <div className="text-destructive dark:text-dark-destructive mt-4">{error}</div>}
          </>
        )}
      </div>
    </div>
  );
};

export default AIDraftModal; 