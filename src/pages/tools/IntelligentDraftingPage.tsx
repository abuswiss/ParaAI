import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Copy, FileSignature, Loader2, Sparkles, FileText, Wand2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import BreadcrumbNav, { BreadcrumbItemDef } from '@/components/layout/BreadcrumbNav';
import { Skeleton } from '@/components/ui/skeleton';
import { useAtomValue } from 'jotai';
import { activeCaseIdAtom } from '@/atoms/appAtoms';
import * as documentService from '@/services/documentService';
import { DocumentMetadata } from '@/services/documentService';

const draftTypes = [
  { value: 'email', label: 'Email' },
  { value: 'client_portal_message', label: 'Client Portal Message' },
  { value: 'text_message', label: 'Text Message (SMS)' },
  { value: 'event_description', label: 'Event Description' },
  { value: 'general_correspondence', label: 'General Correspondence' },
];

const toneOptions = [
  { value: 'formal', label: 'Formal' },
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'empathetic', label: 'Empathetic' },
  { value: 'assertive', label: 'Assertive' },
];

const lengthOptions = [
  { value: 'short', label: 'Short & Concise' },
  { value: 'medium', label: 'Medium Length' },
  { value: 'long', label: 'Detailed & Comprehensive' },
];

const IntelligentDraftingPage: React.FC = () => {
  const [draftType, setDraftType] = useState<string>(draftTypes[0].value);
  const [promptDetails, setPromptDetails] = useState<string>('');
  const [documentContext, setDocumentContext] = useState<string>('');
  
  // Find initial index for tone and length for sliders
  const initialToneIndex = toneOptions.findIndex(opt => opt.value === 'professional');
  const [toneIndex, setToneIndex] = useState<number>(initialToneIndex !== -1 ? initialToneIndex : 1);
  
  const initialLengthIndex = lengthOptions.findIndex(opt => opt.value === 'medium');
  const [lengthIndex, setLengthIndex] = useState<number>(initialLengthIndex !== -1 ? initialLengthIndex : 1);

  const [generatedDraft, setGeneratedDraft] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const activeCaseId = useAtomValue(activeCaseIdAtom);
  const [caseDocuments, setCaseDocuments] = useState<DocumentMetadata[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
  const [isLoadingDocuments, setIsLoadingDocuments] = useState<boolean>(false);

  // Fetch documents when activeCaseId changes
  useEffect(() => {
    if (activeCaseId) {
      setIsLoadingDocuments(true);
      documentService.getUserDocuments(activeCaseId)
        .then(({ data, error }) => {
          if (error) {
            toast.error('Failed to load documents for current case.');
            console.error('Error fetching documents:', error);
            setCaseDocuments([]);
          } else {
            setCaseDocuments(data || []);
          }
        })
        .finally(() => setIsLoadingDocuments(false));
    } else {
      setCaseDocuments([]);
    }
    // Reset selected document and context if case changes
    setSelectedDocumentId('');
    setDocumentContext('');
  }, [activeCaseId]);

  // Fetch content when selectedDocumentId changes
  useEffect(() => {
    if (selectedDocumentId && activeCaseId) {
      const selectedDoc = caseDocuments.find(doc => doc.id === selectedDocumentId);
      if (selectedDoc) {
        const contentToUse = selectedDoc.editedContent || selectedDoc.extractedText;
        if (contentToUse) {
          setDocumentContext(contentToUse);
          toast.success(`Context from '${selectedDoc.filename}' loaded.`);
        } else {
          setDocumentContext('');
          toast.warning(`No text content available for '${selectedDoc.filename}'. It might be processing or unsupported.`);
        }
      }
    } else {
      setDocumentContext(''); // Clear context if no document is selected
    }
  }, [selectedDocumentId, activeCaseId, caseDocuments]);

  const handleGenerateDraft = async () => {
    if (!promptDetails.trim()) {
      toast.error('Please enter the key points or purpose of your draft.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setGeneratedDraft('');

    try {
      const params = {
        draft_type: draftType,
        prompt_details: promptDetails,
        document_context: documentContext.trim() || undefined,
        tone: toneOptions[toneIndex].value,
        length_preference: lengthOptions[lengthIndex].value,
      };

      const { data, error: funcError } = await supabase.functions.invoke(
        'intelligent-drafting',
        { body: params }
      );

      if (funcError) {
        throw new Error(funcError.message);
      }
      
      if (data && data.draft_suggestion) {
        setGeneratedDraft(data.draft_suggestion);
        toast.success('Draft generated successfully!');
      } else {
        throw new Error(data?.error || 'Failed to generate draft.');
      }
    } catch (e: any) {
      console.error('Drafting error:', e);
      setError(e.message || 'An unexpected error occurred during drafting.');
      toast.error(e.message || 'Draft generation failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyDraft = () => {
    if (!generatedDraft) return;
    navigator.clipboard.writeText(generatedDraft)
      .then(() => {
        toast.success('Draft copied to clipboard!');
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
      })
      .catch(err => toast.error('Failed to copy draft.'));
  };

  const breadcrumbItems: BreadcrumbItemDef[] = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Tools', path: '/dashboard' }, // Or a dedicated /tools page
    { name: 'Intelligent Drafting' }
  ];

  return (
    <div className="p-4 md:p-6 flex-grow flex flex-col overflow-y-auto bg-background text-foreground dark:bg-dark-background dark:text-dark-foreground">
      <BreadcrumbNav items={breadcrumbItems} />
      <h1 className="text-2xl font-semibold my-4 text-foreground dark:text-dark-foreground">Intelligent Drafting Assistant</h1>
      <div className="max-w-5xl mx-auto w-full">
        <Card className="shadow-xl bg-card dark:bg-dark-card">
          <CardHeader>
            <div className="flex items-center space-x-3">
                <Wand2 className="h-8 w-8 text-primary" />
                <div>
                    <CardTitle className="text-xl">Drafting Controls</CardTitle>
                    <CardDescription>Configure and generate first drafts for various communications.</CardDescription>
                </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            {error && (
              <div className="p-3 bg-red-100 text-red-700 border border-red-300 rounded-md dark:bg-red-900/30 dark:text-red-300 dark:border-red-700">
                <p>Error: {error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column: Inputs & Controls */}
              <div className="md:col-span-1 space-y-6">
                <div>
                  <Label htmlFor="draft-type" className="text-base">Type of Communication</Label>
                  <Select value={draftType} onValueChange={setDraftType}>
                    <SelectTrigger id="draft-type" className="mt-1 bg-input dark:bg-dark-input dark:border-slate-600">
                      <SelectValue placeholder="Select draft type" />
                    </SelectTrigger>
                    <SelectContent>
                      {draftTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="prompt" className="text-base">Key Points / Purpose</Label>
                  <Textarea
                    id="prompt"
                    value={promptDetails}
                    onChange={(e) => setPromptDetails(e.target.value)}
                    placeholder="e.g., Inform client about upcoming hearing on June 15th, request necessary documents..."
                    rows={5}
                    className="mt-1 resize-none bg-input dark:bg-dark-input dark:text-dark-foreground dark:border-slate-600 focus:ring-primary dark:focus:ring-offset-slate-800"
                  />
                </div>
                
                <div>
                  <Label htmlFor="tone" className="text-base">Tone: {toneOptions[toneIndex].label}</Label>
                  <Slider
                    id="tone"
                    min={0}
                    max={toneOptions.length - 1}
                    step={1}
                    value={[toneIndex]}
                    onValueChange={(value) => setToneIndex(value[0])}
                    className="mt-2 bg-input dark:bg-dark-secondary/30 dark:border-slate-600"
                  />
                </div>

                <div>
                  <Label htmlFor="length" className="text-base">Length: {lengthOptions[lengthIndex].label}</Label>
                  <Slider
                    id="length"
                    min={0}
                    max={lengthOptions.length - 1}
                    step={1}
                    value={[lengthIndex]}
                    onValueChange={(value) => setLengthIndex(value[0])}
                    className="mt-2 bg-input dark:bg-dark-secondary/30 dark:border-slate-600"
                  />
                </div>

                <div>
                  <Label htmlFor="document-context-select" className="text-base">Select Document for Context (Optional)</Label>
                  <Select 
                    value={selectedDocumentId}
                    onValueChange={setSelectedDocumentId}
                    disabled={!activeCaseId || isLoadingDocuments || (caseDocuments.length === 0 && !isLoadingDocuments)}
                  >
                    <SelectTrigger id="document-context-select" className="mt-1 bg-input dark:bg-dark-input dark:border-slate-600">
                      <SelectValue placeholder={!activeCaseId ? "Select a case first" : (isLoadingDocuments ? "Loading documents..." : (caseDocuments.length === 0 ? "No documents in this case" : "Select a document..."))} />
                    </SelectTrigger>
                    <SelectContent>
                      {activeCaseId && !isLoadingDocuments && caseDocuments.length > 0 && caseDocuments.map(doc => (
                        <SelectItem key={doc.id} value={doc.id}>{doc.filename}</SelectItem>
                      ))}
                      {activeCaseId && !isLoadingDocuments && caseDocuments.length === 0 && (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">No documents found in this case.</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="context" className="text-base">Document Context Preview (Read-only)</Label>
                  <Textarea
                    id="context"
                    value={documentContext}
                    readOnly
                    placeholder="Select a document above to load its content here for context..."
                    rows={7}
                    className="mt-1 resize-none dark:bg-slate-800/40 dark:text-gray-300 dark:border-slate-600 focus:ring-0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">The AI will use the content of the selected document as context.</p>
                </div>

                <Button onClick={handleGenerateDraft} disabled={isLoading} size="lg" className="w-full">
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating Draft...</>
                  ) : (
                    <><Sparkles className="mr-2 h-5 w-5" /> Generate Draft</>
                  )}
                </Button>
              </div>

              {/* Right Column: Output */}
              <div className="md:col-span-2 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Generated Draft:</h3>
                  {generatedDraft && !isLoading && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleCopyDraft} 
                      className="dark:text-gray-300 dark:border-slate-600 hover:dark:bg-slate-700 min-w-[120px]"
                      disabled={isCopied}
                    >
                      {isCopied ? (
                        <><Check className="mr-2 h-4 w-4 text-green-500" /> Copied!</>
                      ) : (
                        <><Copy className="mr-2 h-4 w-4" /> Copy Draft</>
                      )}
                    </Button>
                  )}
                </div>
                {isLoading && !generatedDraft && (
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-1/4 mb-2" /> 
                    <Skeleton className="h-[400px] w-full" /> 
                  </div>
                )}
                {!isLoading && (
                  <Tabs defaultValue="draft" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="draft">Draft</TabsTrigger>
                      <TabsTrigger value="context">Context</TabsTrigger>
                    </TabsList>
                    <TabsContent value="draft">
                      <Textarea
                        placeholder="Your AI-generated draft will appear here..."
                        value={generatedDraft}
                        onChange={(e) => setGeneratedDraft(e.target.value)}
                        className="resize-none bg-input dark:bg-dark-input dark:text-dark-foreground dark:border-slate-700 focus:ring-0 min-h-[400px]"
                        id="draft-output"
                      />
                    </TabsContent>
                    <TabsContent value="context">
                      <Textarea
                        value={documentContext}
                        readOnly
                        placeholder="Select a document above to load its content here for context..."
                        rows={7}
                        className="mt-1 resize-none dark:bg-slate-800/40 dark:text-gray-300 dark:border-slate-600 focus:ring-0"
                      />
                      <p className="text-xs text-muted-foreground mt-1">The AI will use the content of the selected document as context.</p>
                    </TabsContent>
                  </Tabs>
                )}
                 {generatedDraft && !isLoading && (
                    <p className="text-xs text-muted-foreground mt-1">Review and edit the draft as needed before use.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default IntelligentDraftingPage; 