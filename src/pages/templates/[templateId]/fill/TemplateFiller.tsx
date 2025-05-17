import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { activeCaseIdAtom } from '@/atoms/appAtoms'; // Adjusted path
import * as templateService from '@/services/templateService';
import { DocumentTemplate } from '@/services/templateService';
import * as documentService from '@/services/documentService';
import { supabase } from '@/lib/supabaseClient'; // Adjusted path
import NewTiptapEditor, { NewTiptapEditorRef } from '@/components/editor/NewTiptapEditor'; // Adjusted path
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Save, Download, FileText, FileBarChart2, ArrowLeft, Info, Sparkles, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';

interface ParsedTemplateVariable {
  name: string;        // e.g., "ClientFullName"
  description: string;  // e.g., "The full legal name of the client."
  // type: 'text' | 'date' | 'number'; // Future enhancement: auto-detect or allow specifying type
}

const TemplateFiller: React.FC = () => {
  const { id: templateId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeCaseId] = useAtom(activeCaseIdAtom);

  const [template, setTemplate] = useState<DocumentTemplate | null>(null);
  const [parsedVariables, setParsedVariables] = useState<ParsedTemplateVariable[]>([]);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [previewHtml, setPreviewHtml] = useState<string>('<p></p>');
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isExportingWord, setIsExportingWord] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // AI Assist State
  const [aiAssistedField, setAiAssistedField] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [isAiSuggesting, setIsAiSuggesting] = useState<boolean>(false);

  const editorRef = useRef<NewTiptapEditorRef>(null); // For the preview editor

  const [highlightedVariable, setHighlightedVariable] = useState<string | null>(null);

  const parseVariablesFromHTML = useCallback((htmlContent: string): ParsedTemplateVariable[] => {
    if (typeof DOMParser === 'undefined') {
      // DOMParser isn't available (e.g. during SSR). Fallback to a basic
      // regex which only detects {{variable}} placeholders. This approach
      // won't provide highlighting or other advanced parsing features.
      const regex = /\{\{\s*([^}\s]+)\s*\}\}/g;
      const found: Record<string, ParsedTemplateVariable> = {};
      let match: RegExpExecArray | null;
      while ((match = regex.exec(htmlContent)) !== null) {
        const name = match[1];
        if (name && !found[name]) {
          found[name] = { name, description: name };
        }
      }
      return Object.values(found);
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const variableElements = Array.from(doc.querySelectorAll('span[data-variable-name].variable-highlight'));

    const uniqueVariables: Record<string, ParsedTemplateVariable> = {};

    variableElements.forEach(el => {
      const name = el.getAttribute('data-variable-name');
      const description = el.getAttribute('data-variable-description') || name || 'No description';
      if (name && !uniqueVariables[name]) {
        uniqueVariables[name] = { name, description };
      }
    });
    return Object.values(uniqueVariables);
  }, []);

  const generatePreviewHtml = useCallback((baseHtml: string, currentValues: Record<string, string>, highlightVar?: string | null): string => {
    if (!baseHtml) return '<p></p>';
    if (typeof DOMParser === 'undefined') {
      // DOMParser isn't available (e.g. SSR). Replace {{variable}} placeholders
      // directly in the HTML. Highlighting will not be applied in this mode.
      return baseHtml.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (_, v) => {
        return currentValues[v] ?? `{{${v}}}`;
      });
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(baseHtml, 'text/html');
    const variableSpans = Array.from(doc.querySelectorAll('span[data-variable-name].variable-highlight'));

    variableSpans.forEach(span => {
      const name = span.getAttribute('data-variable-name');
      // Highlight if this is the currently hovered/focused variable
      if (highlightVar && name === highlightVar) {
        span.classList.add('variable-highlight-active');
      } else {
        span.classList.remove('variable-highlight-active');
      }
      if (name && currentValues[name] !== undefined) {
        span.textContent = currentValues[name] || `{{${name}}}`;
      } else if (name) {
        span.textContent = `{{${name}}}`;
      }
    });
    return doc.body.innerHTML;
  }, []);

  useEffect(() => {
    if (!templateId) {
      setError('Template ID is missing.');
      setIsLoading(false);
      return;
    }
    const fetchAndProcessTemplate = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await templateService.getTemplateById(templateId);
        if (fetchError) throw fetchError;
        if (!data) throw new Error('Template not found.');
        
        setTemplate(data);
        const parsedVars = parseVariablesFromHTML(data.content);
        setParsedVariables(parsedVars);
        
        const initialValues: Record<string, string> = {};
        parsedVars.forEach(v => { initialValues[v.name] = '' });
        setVariableValues(initialValues);
        
        setPreviewHtml(generatePreviewHtml(data.content, initialValues));

      } catch (err: any) {
        const message = err.message || 'Failed to load template data.';
        setError(message);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAndProcessTemplate();
  }, [templateId, parseVariablesFromHTML, generatePreviewHtml]);

  useEffect(() => {
    if (template) {
      setPreviewHtml(generatePreviewHtml(template.content, variableValues, highlightedVariable));
    }
  }, [variableValues, template, generatePreviewHtml, highlightedVariable]);

  const handleVariableChange = (variableName: string, value: string) => {
    setVariableValues(prev => ({ ...prev, [variableName]: value }));
    if (aiAssistedField === variableName && aiSuggestion) {
        setAiSuggestion(null); // Clear suggestion if user types over it or it matches
        setAiAssistedField(null);
    }
  };

  const handleAiAssist = async (variable: ParsedTemplateVariable) => {
    if (!template) return;
    setAiAssistedField(variable.name);
    setIsAiSuggesting(true);
    setAiSuggestion(null);
    toast.info(`Getting AI suggestion for ${variable.name}...`);

    // Construct context
    let context = `Template Name: ${template.name}\n`;
    context += `Template Category: ${template.category}\n`;
    context += `Field to suggest for: ${variable.name} (Description: ${variable.description})\n`;
    context += '\nExisting field values:\n';
    Object.entries(variableValues).forEach(([key, value]) => {
      if (key !== variable.name && value) {
        context += `${key}: ${value}\n`;
      }
    });
    
    const fullPrompt = `Given the following context about a legal template and its fields, provide a concise and relevant suggestion for the specified field.\n\nContext:\n${context.trim()}\n\nSuggestion for ${variable.name}:`;

    try {
      const { data, error } = await supabase.functions.invoke(
        'generate-field-suggestion',
        { body: { prompt: fullPrompt } } 
        // Optionally add model: 'claude-3-opus-20240229' for higher quality but slower/pricier suggestions
      );

      if (error) throw error;
      if (!data || !data.suggestion) {
        throw new Error('AI suggestion not found in response.');
      }

      setAiSuggestion(data.suggestion);
      toast.success(`AI suggestion received for ${variable.name}.`);

    } catch (err: any) {
      console.error('AI Assist call failed:', err);
      toast.error(`AI Assist failed: ${err.message || 'Could not retrieve suggestion.'}`);
      setAiAssistedField(null); // Clear the active field on error
    } finally {
      setIsAiSuggesting(false);
    }
  };

  const acceptAiSuggestion = () => {
    if (aiSuggestion && aiAssistedField) {
      handleVariableChange(aiAssistedField, aiSuggestion);
      setAiSuggestion(null);
      setAiAssistedField(null);
      toast.info('AI suggestion applied.');
    }
  };

  const handleSaveAsDocument = async () => {
    if (!template || !previewHtml) {
      toast.error('Template data or preview content is not available.');
      return;
    }
    if (!activeCaseId) {
        toast.error('No active case selected. Please select or create a case first.');
        return;
    }

    setIsSaving(true);
    try {
      const documentName = `${template.name} (Filled) - ${new Date().toLocaleDateString()}`;
      const { data: userSession } = await supabase.auth.getUser();
      const userId = userSession.user?.id || '';
      if (!userId) throw new Error('User not authenticated for saving document.');

      const { data: newDoc, error: saveError } = await documentService.createDocument({
        userId: userId, 
        caseId: activeCaseId,
        filename: documentName,
        htmlContent: previewHtml, 
        documentType: 'DOCUMENT_FROM_TEMPLATE',
        sourceTemplateId: template.id,
      });
      if (saveError) throw saveError;
      if (!newDoc || !newDoc.id) throw new Error('Failed to save document or no ID returned.');

      toast.success(`Document "${documentName}" saved successfully!`);
      navigate(`/review/document/${newDoc.id}`);

    } catch (err: any) {
      console.error('Failed to save document from template:', err);
      toast.error(err.message || 'Failed to save document.');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Placeholder for Export functions - adapt from NewDocumentReviewerModule
  const handleExportWord = async () => {
    if (!previewHtml || !template) return toast.error('Content not ready for export.');
    setIsExportingWord(true);
    toast.info('Initiating Word export...');
    try {
        const fileName = (template.name ? template.name.replace(/\.[^/.]+$/, "") : "filled_template") + ".docx";
        const { data } = await supabase.functions.invoke('generate-docx', {
            body: { htmlContent: previewHtml, fileName },
        });
        if (data && data.downloadUrl && data.fileName) {
            const a = document.createElement('a');
            a.href = data.downloadUrl;
            a.download = data.fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            toast.success('Word document exported.');
        } else {
            throw new Error('Word export failed: No download URL returned.');
        }
    } catch (err: any) {
        toast.error(`Word export failed: ${err.message}`);
    } finally {
        setIsExportingWord(false);
    }
  };

  const handleExportPdf = async () => {
    if (!previewHtml || !template) return toast.error('Content not ready for export.');
    setIsExportingPdf(true);
    toast.info('Initiating PDF export...');
     try {
        const fileName = (template.name ? template.name.replace(/\.[^/.]+$/, "") : "filled_template") + ".pdf";
        const { data } = await supabase.functions.invoke('generate-pdf-from-html', {
            body: { htmlContent: previewHtml, fileName },
        });
        if (data && data.downloadUrl) {
            const a = document.createElement('a');
            a.href = data.downloadUrl;
            a.target = '_blank'; // Open PDF in new tab
            document.body.appendChild(a);
            a.click();
            a.remove();
            toast.success('PDF opened in new tab!');
        } else {
             throw new Error('PDF export failed: No download URL returned.');
        }
    } catch (err: any) {
        toast.error(`PDF export failed: ${err.message}`);
    } finally {
        setIsExportingPdf(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><Spinner size="lg" /> <p className='ml-2'>Loading template...</p></div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>Error Loading Template</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/templates')} variant="outline" className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Templates
        </Button>
      </div>
    );
  }

  if (!template) {
    return <div className="flex justify-center items-center h-screen">Template data not found.</div>;
  }

  return (
    <TooltipProvider>
      <style>{`
        .variable-highlight-active {
          background: #ffe066 !important;
          border-radius: 3px;
          box-shadow: 0 0 0 2px #ffd43b;
          transition: background 0.2s, box-shadow 0.2s;
        }
      `}</style>
      <div className="flex h-screen w-full bg-background text-foreground dark:bg-dark-background dark:text-dark-foreground">
        {/* Left Panel: Form for Variables */}
        <div className="w-1/3 h-full flex flex-col border-r border-gray-200 dark:border-gray-700 bg-background dark:bg-dark-secondary">
          <CardHeader className="p-4 border-b dark:border-gray-700">
            <Button variant="ghost" size="sm" onClick={() => navigate('/templates')} className="mb-2 text-sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Templates List
            </Button>
            <CardTitle className="text-xl">Fill Template: {template.name}</CardTitle>
            <CardDescription className="text-sm">
              Fill in the required information. Use AI Assist for contextual suggestions!
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 overflow-y-auto flex-grow">
            {parsedVariables.length === 0 && (
              <div className="text-center py-6">
                  <Info className="mx-auto h-10 w-10 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No variables found in this template.</p>
              </div>
            )}
            <form className="space-y-4">
              {parsedVariables.map((variable) => (
                <div key={variable.name}
                  onMouseEnter={() => setHighlightedVariable(variable.name)}
                  onMouseLeave={() => setHighlightedVariable(null)}
                >
                  <div className="flex justify-between items-center mb-1">
                    <Label htmlFor={variable.name} className="text-sm font-medium">
                      {variable.name.replace(/([A-Z])/g, ' $1').trim()}
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                            variant="ghost"
                            size="icon_sm" 
                            onClick={() => handleAiAssist(variable)}
                            disabled={isAiSuggesting && aiAssistedField === variable.name}
                            className="h-6 w-6 p-0.5 text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                        >
                            {isAiSuggesting && aiAssistedField === variable.name ? (
                                <Spinner size="xs" />
                            ) : (
                                <Sparkles className="h-4 w-4" />
                            )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>AI Assist (Beta) - Get a suggestion for this field.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{variable.description}</p>
                  <Input
                    id={variable.name}
                    value={variableValues[variable.name] || ''}
                    onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                    placeholder={`Enter ${variable.name.toLowerCase()}...`}
                    className="mt-1"
                    onFocus={() => setHighlightedVariable(variable.name)}
                    onBlur={() => setHighlightedVariable(null)}
                  />
                  {aiAssistedField === variable.name && aiSuggestion && (
                    <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-md text-sm">
                      <p className="text-purple-700 dark:text-purple-300 mb-1">AI Suggestion: <strong>{aiSuggestion}</strong></p>
                      <Button size="xs" onClick={acceptAiSuggestion} variant="outline" className="border-purple-500 text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-800">
                        <CheckCircle className="mr-1.5 h-3.5 w-3.5"/> Accept
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </form>
          </CardContent>
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
              <Button onClick={handleSaveAsDocument} disabled={isSaving || isExportingWord || isExportingPdf} className="w-full">
                  {isSaving ? <Spinner size="sm" className="mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                  {isSaving ? 'Saving Document...' : 'Save as Document'}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                  <Button onClick={handleExportWord} variant="secondary" disabled={isExportingWord || isExportingPdf || isSaving} className="w-full">
                      {isExportingWord ? <Spinner size="sm" className="mr-2"/> : <Download className="mr-2 h-4 w-4" />}
                      Export Word
                  </Button>
                  <Button onClick={handleExportPdf} variant="secondary" disabled={isExportingPdf || isExportingWord || isSaving} className="w-full">
                      {isExportingPdf ? <Spinner size="sm" className="mr-2"/> : <FileText className="mr-2 h-4 w-4" />}
                      Export PDF
                  </Button>
              </div>
          </div>
        </div>

        {/* Right Panel: Live Preview */}
        <div className="flex-1 h-full flex flex-col p-1 bg-secondary dark:bg-dark-secondary">
          <div className="flex-grow m-1 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm bg-background dark:bg-dark-background overflow-hidden">
              <NewTiptapEditor
                  ref={editorRef} 
                  content={previewHtml}
                  editable={false} // Preview is not directly editable
                  placeholder="Template preview will appear here..."
              />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default TemplateFiller; 