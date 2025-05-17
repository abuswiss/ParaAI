import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Label } from '@/components/ui/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '@/hooks/useAuth';
import { BookText, AlertCircle, Copy, Link as LinkIcon } from 'lucide-react';
import ExplanationSkeleton from '@/components/ai/ExplanationSkeleton';
import { Spinner } from '@/components/ui/Spinner';
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"; // Assuming Popover for dropdown

// Options for Select components
const detailLevelOptions = [
  { value: 'quick', label: 'Quick Overview' },
  { value: 'standard', label: 'Standard Explanation' },
  { value: 'detailed_paralegal', label: 'Detailed for Paralegal' },
];

const jurisdictionOptions = [
  { value: '_none_', label: 'None Specified' },
  { value: 'federal_usa', label: 'Federal (USA)' },
  { value: 'ca', label: 'California' },
  { value: 'ny', label: 'New York' },
  { value: 'tx', label: 'Texas' },
  { value: 'england_wales', label: 'England & Wales' },
  // Add more jurisdictions as needed
];

const areaOfLawOptions = [
  { value: '_none_', label: 'None Specified' },
  { value: 'contract', label: 'Contract Law' },
  { value: 'torts', label: 'Torts' },
  { value: 'criminal', label: 'Criminal Law' },
  { value: 'family', label: 'Family Law' },
  { value: 'corporate', label: 'Corporate Law' },
  { value: 'property', label: 'Property Law' },
  { value: 'ip', label: 'Intellectual Property' },
  // Add more areas as needed
];

// Sample extensive list of legal terms for autosuggest
const allLegalTerms = [
  'Habeas Corpus', 'Stare Decisis', 'Res Ipsa Loquitur', 'Caveat Emptor',
  'Force Majeure', 'Prima Facie', 'Amicus Curiae', 'De Facto', 'De Jure',
  'Injunction', 'Subpoena', 'Affidavit', 'Indictment', 'Arraignment',
  'Bail', 'Parole', 'Probation', 'Misdemeanor', 'Felony',
  'Statute of Limitations', 'Due Process', 'Equal Protection', 'Jurisprudence',
  'Liability', 'Negligence', 'Tort', 'Contract', 'Consideration',
  'Estoppel', 'Laches', 'Sovereign Immunity', 'Mens Rea', 'Actus Reus',
  'Ad Hoc', 'Bona Fide', 'Certiorari', 'Ex Parte', 'Pro Bono',
  'Quid Pro Quo', 'Writ of Mandamus'
  // Add many more terms here for a truly extensive list
];

const LegalConceptExplainerPage: React.FC = () => {
  const [term, setTerm] = useState('');
  const [suggestedTerms, setSuggestedTerms] = useState<string[]>([]);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [context, setContext] = useState('');
  const [jurisdiction, setJurisdiction] = useState('_none_');
  const [areaOfLaw, setAreaOfLaw] = useState('_none_');
  const [detailLevel, setDetailLevel] = useState('standard');
  const [explanation, setExplanation] = useState<string | null>(null);
  const [relatedConcepts, setRelatedConcepts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session, loading: authLoading } = useAuth();
  const [copied, setCopied] = useState(false);

  const handleTermChange = (newTerm: string) => {
    setTerm(newTerm);
    if (newTerm.trim().length > 1) { // Start suggesting after 2 characters
      const filteredTerms = allLegalTerms.filter(t => 
        t.toLowerCase().includes(newTerm.toLowerCase())
      ).slice(0, 7); // Limit suggestions to 7
      setSuggestedTerms(filteredTerms);
      setIsSuggestionsOpen(filteredTerms.length > 0);
    } else {
      setSuggestedTerms([]);
      setIsSuggestionsOpen(false);
    }
  };

  const handleSuggestionClick = (selectedTerm: string) => {
    setTerm(selectedTerm);
    setSuggestedTerms([]);
    setIsSuggestionsOpen(false);
  };

  const handleExplainConcept = useCallback(async (termToExplain: string) => {
    if (isLoading) return; // Prevent re-entry if already loading

    if (!termToExplain.trim()) {
      setError("Please enter a term or concept to explain.");
      return;
    }
    if (!session?.access_token && !authLoading) {
      setError("Authentication required. Please ensure you are logged in.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setExplanation(null);
    setRelatedConcepts([]);
    setCopied(false);
    setIsSuggestionsOpen(false); // Close suggestions when explaining

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const requestBody = {
        term: termToExplain,
        context: context.trim() || undefined,
        jurisdiction: jurisdiction === '_none_' ? undefined : jurisdiction,
        areaOfLaw: areaOfLaw === '_none_' ? undefined : areaOfLaw,
        detailLevel: detailLevel,
        generateRelatedConcepts: true,
      };
      
      const response = await fetch(`${supabaseUrl}/functions/v1/explain-legal-concept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setExplanation(result.explanation);
      if (result.relatedConcepts) {
        setRelatedConcepts(result.relatedConcepts);
      }

    } catch (err) {
      console.error("Error explaining concept:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred during explanation.");
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, context, jurisdiction, areaOfLaw, detailLevel, session, authLoading]);

  const handleCopyExplanation = useCallback(() => {
    if (explanation) {
      navigator.clipboard.writeText(explanation)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(err => {
          console.error("Failed to copy text: ", err);
          setError("Failed to copy explanation to clipboard.");
        });
    }
  }, [explanation]);

  const canExplain = term.trim().length > 0 && !isLoading && !authLoading;

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <div className="text-center">
        <BookText className="mx-auto h-12 w-12 text-primary mb-2" />
        <h1 className="text-3xl font-bold tracking-tight text-foreground">AI Legal Concept Explainer</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Get clear explanations for complex legal terms and concepts, tailored to your needs.
        </p>
      </div>
      
      {authLoading && (
         <div className="flex items-center justify-center p-4">
            <Spinner /> <span className="ml-2">Loading authentication...</span>
         </div>
      )}

      <Card className="max-w-2xl mx-auto shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Define a Legal Term</CardTitle>
          <CardDescription>
            Enter the term, and optionally provide context, jurisdiction, area of law, and desired detail level.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Label htmlFor="term-input" className="font-medium">Term/Concept <span className="text-destructive">*</span></Label>
            <Input 
              id="term-input"
              value={term}
              onChange={(e) => handleTermChange(e.target.value)}
              onFocus={() => term.trim().length > 1 && suggestedTerms.length > 0 && setIsSuggestionsOpen(true)}
              placeholder="e.g., 'Res Ipsa Loquitur', 'Statute of Limitations'"
              disabled={isLoading || authLoading}
              className="mt-1"
              autoComplete="off"
            />
            {isSuggestionsOpen && suggestedTerms.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-background border border-border shadow-lg rounded-md max-h-60 overflow-y-auto">
                <ul className="py-1">
                  {suggestedTerms.map((sTerm, index) => (
                    <li 
                      key={index} 
                      className="px-3 py-2 text-sm hover:bg-muted cursor-pointer"
                      onMouseDown={() => handleSuggestionClick(sTerm)}
                    >
                      {sTerm}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          <div>
            <Label htmlFor="jurisdiction-select" className="font-medium">Jurisdiction (Optional)</Label>
            <Select value={jurisdiction} onValueChange={(value) => { setJurisdiction(value); setIsSuggestionsOpen(false); }} disabled={isLoading || authLoading}>
              <SelectTrigger id="jurisdiction-select" className="mt-1">
                <SelectValue placeholder="Select jurisdiction..." />
              </SelectTrigger>
              <SelectContent>
                {jurisdictionOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="area-of-law-select" className="font-medium">Area of Law (Optional)</Label>
            <Select value={areaOfLaw} onValueChange={(value) => { setAreaOfLaw(value); setIsSuggestionsOpen(false);}} disabled={isLoading || authLoading}>
              <SelectTrigger id="area-of-law-select" className="mt-1">
                <SelectValue placeholder="Select area of law..." />
              </SelectTrigger>
              <SelectContent>
                {areaOfLawOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="detail-level-select" className="font-medium">Detail Level</Label>
            <Select value={detailLevel} onValueChange={(value) => { setDetailLevel(value); setIsSuggestionsOpen(false);}} disabled={isLoading || authLoading}>
              <SelectTrigger id="detail-level-select" className="mt-1">
                <SelectValue placeholder="Select detail level..." />
              </SelectTrigger>
              <SelectContent>
                {detailLevelOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="context-input" className="font-medium">Additional Context (Optional)</Label>
            <Textarea 
              id="context-input"
              value={context}
              onChange={(e) => { setContext(e.target.value); setIsSuggestionsOpen(false); }}
              placeholder="E.g., a sentence where you encountered the term."
              rows={3}
              disabled={isLoading || authLoading}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">Providing context can help the AI give a more relevant explanation.</p>
          </div>

          <Button onClick={() => handleExplainConcept(term)} disabled={!canExplain} className="w-full py-3">
            {isLoading && !explanation ? <Spinner size="sm" className="mr-2" /> : null}
            {isLoading && !explanation ? 'Generating...' : 'Explain Concept'}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="max-w-2xl mx-auto mt-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading && !explanation && <ExplanationSkeleton />}

      {explanation && !isLoading && (
        <Card className="max-w-2xl mx-auto mt-6 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between">
            <CardTitle className="text-xl">Explanation for "<span className='text-primary'>{term}</span>"</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleCopyExplanation} title="Copy explanation">
              <Copy className={`h-4 w-4 ${copied ? 'text-green-500' : ''}`} />
              <span className="ml-2">{copied ? 'Copied!' : 'Copy'}</span>
            </Button>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none pt-4 text-sm leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {explanation}
            </ReactMarkdown>
          </CardContent>
          
          {relatedConcepts && relatedConcepts.length > 0 && (
            <CardContent className="pt-4 mt-4 border-t">
              <h3 className="text-lg font-semibold mb-2 flex items-center">
                <LinkIcon className="h-5 w-5 mr-2 text-muted-foreground" />
                Related Concepts
              </h3>
              <div className="flex flex-wrap gap-2">
                {relatedConcepts.map((concept, index) => (
                  <Button 
                    key={index} 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setTerm(concept);
                      setIsSuggestionsOpen(false);
                      handleExplainConcept(concept);
                    }}
                  >
                    {concept}
                  </Button>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
};

export default LegalConceptExplainerPage; 