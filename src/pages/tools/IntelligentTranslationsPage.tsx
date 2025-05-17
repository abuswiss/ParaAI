import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { ArrowRightLeft, Copy, Languages, Loader2, XCircle, History, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient'; // Assuming supabase client is set up
import BreadcrumbNav, { BreadcrumbItemDef } from '@/components/layout/BreadcrumbNav'; // Import BreadcrumbNav
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton
import { v4 as uuidv4 } from 'uuid'; // For unique keys in history

const MAX_HISTORY_ITEMS = 5;

interface TranslationHistoryItem {
  id: string;
  inputText: string;
  outputText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: Date;
}

const availableLanguages = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh-CN', label: 'Chinese (Simplified)' },
  // Add more common languages
];

const IntelligentTranslationsPage: React.FC = () => {
  const [inputText, setInputText] = useState<string>('');
  const [outputText, setOutputText] = useState<string>('');
  const [sourceLang, setSourceLang] = useState<string>('auto'); // 'auto' for auto-detect
  const [targetLang, setTargetLang] = useState<string>('es'); // Default to Spanish
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [inputCharCount, setInputCharCount] = useState<number>(0);
  const [translationHistory, setTranslationHistory] = useState<TranslationHistoryItem[]>([]);

  useEffect(() => {
    // Load history from localStorage
    const storedHistory = localStorage.getItem('translationHistory');
    if (storedHistory) {
      try {
        const parsedHistory = JSON.parse(storedHistory) as TranslationHistoryItem[];
        // Ensure timestamps are Date objects
        setTranslationHistory(parsedHistory.map(item => ({ ...item, timestamp: new Date(item.timestamp) })));
      } catch (e) {
        console.error("Failed to parse translation history from localStorage", e);
        setTranslationHistory([]);
      }
    }
  }, []);

  useEffect(() => {
    // Save history to localStorage
    if (translationHistory.length > 0 || localStorage.getItem('translationHistory')) { // Only save if there's something to save or clear
        localStorage.setItem('translationHistory', JSON.stringify(translationHistory));
    }
  }, [translationHistory]);

  const handleInputTextChange = (newText: string) => {
    setInputText(newText);
    setInputCharCount(newText.length);
  };

  const handleClearInput = () => {
    setInputText('');
    setOutputText(''); // Also clear output when input is cleared
    setInputCharCount(0);
    toast.info('Input cleared.');
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) {
      toast.error('Please enter text to translate.');
      return;
    }

    if (sourceLang !== 'auto' && sourceLang === targetLang) {
      toast.warning('Source and target languages are the same. No translation needed.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setOutputText('');

    try {
      const params: { 
        text_to_translate: string;
        target_language: string;
        source_language?: string;
      } = {
        text_to_translate: inputText,
        target_language: targetLang,
      };
      if (sourceLang !== 'auto') {
        params.source_language = sourceLang;
      }

      const { data, error: funcError } = await supabase.functions.invoke(
        'intelligent-translation',
        { body: params }
      );

      if (funcError) {
        throw new Error(funcError.message);
      }
      
      if (data && data.translated_text) {
        setOutputText(data.translated_text);
        toast.success('Translation successful!');
        // Add to history
        const newHistoryItem: TranslationHistoryItem = {
          id: uuidv4(),
          inputText,
          outputText: data.translated_text,
          sourceLang,
          targetLang,
          timestamp: new Date(),
        };
        setTranslationHistory(prevHistory => 
          [newHistoryItem, ...prevHistory].slice(0, MAX_HISTORY_ITEMS)
        );
      } else {
        throw new Error(data?.error || 'Failed to get translation.');
      }
    } catch (e: any) {
      console.error('Translation error:', e);
      setError(e.message || 'An unexpected error occurred during translation.');
      toast.error(e.message || 'Translation failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyOutput = () => {
    if (!outputText) return;
    navigator.clipboard.writeText(outputText)
      .then(() => toast.success('Translated text copied to clipboard!'))
      .catch(err => toast.error('Failed to copy text.'));
  };

  const handleSwapLanguages = () => {
    if (sourceLang === 'auto') {
        // If auto, and we have output, we can't reliably swap back to original source language (yet)
        // For now, just swap target to become source, and pick a common default for target or require user selection
        if (outputText) {
            const currentOutput = outputText;
            handleInputTextChange(currentOutput); // Use handler to update char count
            setOutputText('');
            setSourceLang(targetLang);
            setTargetLang('en'); // Or a previous sourceLang if stored
            toast.info('Languages swapped. Please verify source language or set to auto-detect.');
        } else {
            toast.info('Swap not available with auto-detect and no translated text.');
        }
        return;
    }
    const currentSource = sourceLang;
    const currentTarget = targetLang;
    setSourceLang(currentTarget);
    setTargetLang(currentSource);
    const currentOutput = outputText; // Save output before clearing
    handleInputTextChange(currentOutput); // Use handler to update char count
    setOutputText('');       // Clear output
  };

  const handleHistoryItemClick = (item: TranslationHistoryItem) => {
    handleInputTextChange(item.inputText); // Use handler to update char count
    setOutputText(item.outputText);
    setSourceLang(item.sourceLang);
    setTargetLang(item.targetLang);
    toast.info('Loaded translation from history.');
  };

  const handleClearHistory = () => {
    setTranslationHistory([]);
    toast.info('Translation history cleared.');
  };

  const breadcrumbItems: BreadcrumbItemDef[] = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Tools', path: '/dashboard' }, // Or a dedicated /tools page if it exists
    { name: 'Intelligent Translations' }
  ];

  return (
    <div className="p-4 md:p-6 flex-grow flex flex-col overflow-y-auto bg-background text-foreground dark:bg-dark-background dark:text-dark-foreground">
      <BreadcrumbNav items={breadcrumbItems} />
      <h1 className="text-2xl font-semibold my-4 text-foreground dark:text-dark-foreground">Intelligent Translations</h1>
      <div className="max-w-4xl mx-auto w-full">
        <Card className="shadow-xl bg-card dark:bg-dark-card">
          <CardHeader>
            <div className="flex items-center space-x-3">
                <Languages className="h-8 w-8 text-primary" />
                <div>
                    <CardTitle className="text-xl">Intelligent Translation Tool</CardTitle>
                    <CardDescription>Translate text between various languages with AI precision.</CardDescription>
                </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="p-3 bg-red-100 text-red-700 border border-red-300 rounded-md dark:bg-red-900/30 dark:text-red-300 dark:border-red-700">
                <p>Error: {error}</p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
                {/* Source Language Selector */}
                <div className="flex-1">
                    <label htmlFor="source-lang" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From</label>
                    <Select value={sourceLang} onValueChange={setSourceLang}>
                        <SelectTrigger id="source-lang" className="bg-input dark:bg-dark-input dark:text-dark-foreground dark:border-dark-input-border">
                            <SelectValue placeholder="Select source language" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="auto">Auto-detect</SelectItem>
                            {availableLanguages.map(lang => (
                                <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex justify-center md:mt-6">
                    <Button variant="ghost" size="icon" onClick={handleSwapLanguages} aria-label="Swap languages" className="hover:bg-primary/10">
                        <ArrowRightLeft className="h-5 w-5 text-primary" />
                    </Button>
                </div>

                {/* Target Language Selector */}
                <div className="flex-1">
                    <label htmlFor="target-lang" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To</label>
                    <Select value={targetLang} onValueChange={setTargetLang}>
                        <SelectTrigger id="target-lang" className="bg-input dark:bg-dark-input dark:text-dark-foreground dark:border-dark-input-border">
                            <SelectValue placeholder="Select target language" />
                        </SelectTrigger>
                        <SelectContent>
                            {availableLanguages.map(lang => (
                                <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="relative">
              <Textarea
                value={inputText}
                onChange={(e) => handleInputTextChange(e.target.value)}
                placeholder="Enter text to translate..."
                rows={6}
                className="resize-none bg-input dark:bg-dark-input dark:text-dark-foreground dark:border-dark-input-border focus:ring-primary dark:focus:ring-offset-slate-800 pr-10"
              />
              {inputText && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearInput}
                  className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  aria-label="Clear input"
                >
                  <XCircle className="h-5 w-5" />
                </Button>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 text-right pr-1">
              {inputCharCount} character{inputCharCount === 1 ? '' : 's'}
            </p>

            <div className="flex justify-center">
              <Button onClick={handleTranslate} disabled={isLoading} size="lg" className="min-w-[150px]">
                {isLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Translating...</>
                ) : (
                  <div className="flex items-center"><Languages className="mr-2 h-5 w-5"/>Translate</div>
                )}
              </Button>
            </div>

            {isLoading && !outputText && (
                <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center">
                        <Skeleton className="h-6 w-1/3" />
                        <Skeleton className="h-8 w-20" />
                    </div>
                    <Skeleton className="h-[120px] w-full" /> 
                </div>
            )}

            {!isLoading && outputText && (
              <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Translated Text:</h3>
                  <Button variant="outline" size="sm" onClick={handleCopyOutput} className="dark:text-gray-300 dark:border-slate-600 hover:dark:bg-slate-700">
                    <Copy className="mr-2 h-4 w-4" /> Copy
                  </Button>
                </div>
                <Textarea
                  value={outputText}
                  readOnly
                  rows={6}
                  className="resize-none bg-input dark:bg-dark-input dark:text-dark-foreground dark:border-dark-input-border focus:ring-0"
                />
              </div>
            )}

            {/* Translation History Section */}
            {translationHistory.length > 0 && (
              <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center">
                    <History className="mr-2 h-5 w-5" /> Translation History
                  </h3>
                  <Button variant="outline" size="sm" onClick={handleClearHistory} className="dark:text-gray-300 dark:border-slate-600 hover:dark:bg-slate-700">
                    <Trash2 className="mr-2 h-4 w-4" /> Clear History
                  </Button>
                </div>
                <ul className="space-y-3 max-h-60 overflow-y-auto pr-2">
                  {translationHistory.map((item) => (
                    <li 
                      key={item.id} 
                      onClick={() => handleHistoryItemClick(item)}
                      className="p-3 border rounded-md hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors duration-150 ease-in-out bg-card dark:bg-dark-card-nested"
                    >
                      <div className="flex justify-between items-start text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span>
                            {availableLanguages.find(l => l.value === item.sourceLang)?.label || item.sourceLang}
                            {' \u2192 '} {/* Right Arrow */}
                            {availableLanguages.find(l => l.value === item.targetLang)?.label || item.targetLang}
                        </span>
                        <span className="text-xs">
                            {item.timestamp.toLocaleTimeString()} - {item.timestamp.toLocaleDateString()}
                        </span>
                      </div>
                      <p className="truncate text-sm font-medium text-foreground dark:text-dark-foreground" title={item.inputText}>
                        <strong>In:</strong> {item.inputText}
                      </p>
                      <p className="truncate text-sm text-muted-foreground dark:text-dark-muted-foreground" title={item.outputText}>
                        <strong>Out:</strong> {item.outputText}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default IntelligentTranslationsPage; 