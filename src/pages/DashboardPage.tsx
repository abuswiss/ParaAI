import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSetAtom, useAtom, useAtomValue } from 'jotai';
import {
  uploadModalOpenAtom,
  commandPaletteOpenAtom,
  selectTemplateModalOpenAtom,
  activeCaseIdAtom,
  newAITemplateDraftModalOpenAtom,
  newAIDocumentDraftModalOpenAtom,
  deepResearchModeAtom
} from '@/atoms/appAtoms';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { 
  FolderPlus, MessageSquarePlus, Upload, Search, Brain, FileUp, 
  FolderIcon, ChevronRight, ScanText, Settings,
  Briefcase, BookTemplate, FilePieChart, 
  BookHeadphones, 
  FileCheck,
  Languages,
  FileSignature,
  UsersRound,
  ScaleIcon
} from 'lucide-react';
import TemplateSelectorModal from '@/components/templates/TemplateSelectorModal';
import { toast } from 'sonner';
import { createDocumentFromTemplate } from '@/lib/templateUtils';
import CaseRequiredDialog from '@/components/common/CaseRequiredDialog';
import { useStartNewChat } from '@/hooks/useStartNewChat';
import * as caseService from '@/services/caseService';
import { Case } from '@/types/case';
import CaseManagementModal from '@/components/cases/CaseManagementModal';
import NewAITemplateDraftModal from "@/components/templates/NewAITemplateDraftModal";
import NewAIDocumentDraftModal from "@/components/documents/NewAIDocumentDraftModal";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/Spinner';

// Glass card styling from src/pages/DashboardPage.tsx
const glassCardClass = `relative overflow-hidden backdrop-blur-2xl bg-card border border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.05)] shadow-2xl rounded-3xl transition-all duration-200 ring-1 ring-black/10 dark:ring-white/10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/70 transform-gpu hover:scale-[1.045] active:scale-[0.98] hover:shadow-3xl hover:bg-[rgba(255,248,231,0.80)] dark:hover:bg-[rgba(24,24,27,0.80)] group`;
const glassCardStaticClass = "relative overflow-hidden backdrop-blur-2xl bg-card border border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.05)] shadow-xl rounded-3xl ring-1 ring-black/10 dark:ring-white/10";
const glassGradient = "after:content-[''] after:absolute after:inset-0 after:bg-gradient-to-br after:from-white/10 after:to-primary/10 after:pointer-events-none after:rounded-3xl after:opacity-70"; // Adjusted opacity
const glassInnerBorder = "before:content-[''] before:absolute before:inset-0 before:rounded-3xl before:border before:border-white/10 before:pointer-events-none"; // Adjusted opacity
const glassReflection = "before:content-[''] before:absolute before:top-0 before:left-0 before:w-full before:h-1/3 before:bg-gradient-to-b before:from-white/50 before:to-transparent before:opacity-30 before:rounded-t-3xl before:pointer-events-none"; // Adjusted opacity

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const setUploadModalOpen = useSetAtom(uploadModalOpenAtom);
  const setCommandPaletteOpen = useSetAtom(commandPaletteOpenAtom);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useAtom(selectTemplateModalOpenAtom);
  const [activeCaseId, setActiveCaseId] = useAtom(activeCaseIdAtom);
  const [isCaseRequiredDialogOpen, setIsCaseRequiredDialogOpen] = useState(false);
  const startNewChat = useStartNewChat();

  const [recentMatters, setRecentMatters] = useState<Case[]>([]);
  const [isLoadingMatters, setIsLoadingMatters] = useState(true);
  const [isCaseManagementModalOpen, setIsCaseManagementModalOpen] = useState(false);

  const setIsNewAITemplateModalOpen = useSetAtom(newAITemplateDraftModalOpenAtom);
  const isNewAITemplateModalOpenVal = useAtomValue(newAITemplateDraftModalOpenAtom);
  const setIsNewAIDocumentDraftModalOpen = useSetAtom(newAIDocumentDraftModalOpenAtom);
  const isNewAIDocumentDraftModalOpenVal = useAtomValue(newAIDocumentDraftModalOpenAtom);
  const setDeepResearchMode = useSetAtom(deepResearchModeAtom);

  useEffect(() => {
    const fetchRecentMatters = async () => {
      setIsLoadingMatters(true);
      try {
        const { data, error } = await caseService.getUserCases();
        if (error) throw error;
        const sortedMatters = (data || []).sort((a, b) => 
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        setRecentMatters(sortedMatters.slice(0, 5));
      } catch (error) {
        console.error("Failed to fetch recent matters:", error);
      } finally {
        setIsLoadingMatters(false);
      }
    };
    fetchRecentMatters();
  }, []);

  const handleNewMatter = () => {
    setIsCaseManagementModalOpen(true);
  };

  const handleUploadDocument = () => {
    if (!activeCaseId) {
      setIsCaseRequiredDialogOpen(true);
      return;
    }
    setUploadModalOpen(true);
  };

  const handleNewChat = () => {
    startNewChat();
  };

  const handleUseTemplateClick = () => {
    if (!activeCaseId) {
      setIsCaseRequiredDialogOpen(true);
      return;
    }
    setIsTemplateModalOpen(true);
  };

  const handleGlobalSearch = () => {
    setCommandPaletteOpen(true);
  };

  const handleTemplateSelected = (templateId: string) => {
    if (!activeCaseId) {
      toast.error("Please select an active matter first.");
      setIsCaseRequiredDialogOpen(true);
      return;
    }
    createDocumentFromTemplate(navigate, templateId, activeCaseId, () => {
      setIsTemplateModalOpen(false);
    });
  };
  
  const handleRefreshMatters = async () => {
    setIsLoadingMatters(true);
    try {
      const { data, error } = await caseService.getUserCases();
      if (error) throw error;
      const sortedMatters = (data || []).sort((a, b) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      setRecentMatters(sortedMatters.slice(0, 5));
    } catch (error) {
      console.error("Failed to refresh recent matters:", error);
      toast.error("Could not refresh recent matters.");
    } finally {
      setIsLoadingMatters(false);
    }
  };

  const handleGenerateAIDocument = () => {
    if (!activeCaseId) {
      setIsCaseRequiredDialogOpen(true);
      return;
    }
    setIsNewAIDocumentDraftModalOpen(true);
  };
  
  const handleGenerateAITemplate = () => {
    setIsNewAITemplateModalOpen(true);
  };

  const handleActivateDeepResearch = () => {
    setDeepResearchMode(true);
    toast.info("Deep Research mode activated. Navigating to chat.", {
      description: "The legal assistant will now perform in-depth research.",
    });
    handleNewChat();
  };

  return (
    <div className="p-4 md:p-6 h-full bg-background text-foreground dark:bg-dark-background dark:text-dark-foreground overflow-y-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-foreground dark:text-dark-foreground mb-1">
          BenchWise Legal Assistant
        </h1>
        <p className="text-lg text-muted-foreground dark:text-dark-muted-foreground">
          Your AI-powered paralegal solution
        </p>
      </header>

      <div className="mb-6">
        <Button 
          variant="outline"
          className="w-full h-14 text-lg justify-start text-muted-foreground hover:text-foreground border-dashed hover:border-solid border-input hover:border-primary transition-all duration-200 ease-in-out group pl-4 pr-3 py-3 shadow-sm hover:shadow-md"
          onClick={handleGlobalSearch}
        >
          <Search className="mr-3 h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" /> 
          <span className="flex-grow text-left">Ask, or search matters, documents, templates...</span>
          <span className="text-xs bg-muted px-1.5 py-0.5 rounded-sm border border-border group-hover:border-primary group-hover:text-primary transition-colors">⌘K</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-8 mb-10">
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-primary dark:text-dark-primary flex items-center">
              <Briefcase className="mr-2 h-5 w-5 text-primary" />
              Workspace & Matters
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card 
              className={`${glassCardClass} ${glassInnerBorder} ${glassReflection}`}
              tabIndex={0}
              onClick={() => navigate('/files')}
              role="button"
              aria-label="Open File Manager"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center mb-1">
                  <FolderIcon className="h-6 w-6 mr-3 text-primary drop-shadow group-hover:text-orange-500 transition-colors duration-200" />
                  <CardTitle className="text-xl font-bold group-hover:text-orange-600 transition-colors duration-200">Browse Files</CardTitle>
                </div>
                <CardDescription className="text-base text-neutral-700/80 dark:text-neutral-200/80">Access all your documents and files</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pb-2 flex flex-col justify-end flex-1">
                <div className="mt-6 text-lg font-semibold text-primary/80 dark:text-legal-purple/80 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors duration-200 tracking-wide flex items-center gap-2">
                  <span>File Manager</span>
                  <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`${glassCardClass} ${glassInnerBorder} ${glassReflection}`}
              tabIndex={0}
              onClick={handleNewMatter}
              role="button"
              aria-label="Manage Matters"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center mb-1">
                  <FolderPlus className="h-6 w-6 mr-3 text-primary drop-shadow group-hover:text-orange-500 transition-colors duration-200" />
                  <CardTitle className="text-xl font-bold group-hover:text-orange-600 transition-colors duration-200">Manage Matters</CardTitle>
                </div>
                <CardDescription className="text-base text-neutral-700/80 dark:text-neutral-200/80">Create and manage legal matters</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pb-2 flex flex-col justify-end flex-1">
                <div className="mt-6 text-lg font-semibold text-primary/80 dark:text-legal-purple/80 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors duration-200 tracking-wide flex items-center gap-2">
                  <span>Manage Matters</span>
                  <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`${glassCardStaticClass} ${glassInnerBorder} ${glassReflection} col-span-1 sm:col-span-2 lg:col-span-1 flex flex-col`}
            >
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center">
                    <FolderIcon className="h-5 w-5 mr-2 text-primary" />
                    <CardTitle className="text-lg">Recent Matters</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-grow pt-2 pb-0 px-0">
                {isLoadingMatters ? (
                  <div className="p-6 text-center flex justify-center items-center h-full">
                    <Spinner size="md" />
                  </div>
                ) : recentMatters.length > 0 ? (
                  <ScrollArea className="h-[150px]">
                    <ul className="divide-y divide-border">
                      {recentMatters.map((matter) => (
                        <li key={matter.id}>
                          <Link 
                            to={`/files?caseId=${matter.id}`} 
                            onClick={() => setActiveCaseId(matter.id)}
                            className={`flex items-center justify-between px-4 py-2.5 hover:bg-muted/60 dark:hover:bg-dark-secondary/60 transition-colors duration-150 ease-in-out group ${activeCaseId === matter.id ? 'bg-muted dark:bg-dark-secondary font-semibold text-primary' : ''}`}
                          >
                            <div className="flex items-center min-w-0">
                               <FolderIcon className={`mr-2 h-4 w-4 flex-shrink-0 ${activeCaseId === matter.id ? 'text-primary' : 'text-muted-foreground/80 group-hover:text-primary/80 dark:text-dark-muted-foreground/80 dark:group-hover:text-primary/80'}`} />
                               <div className="min-w-0">
                                   <span className="truncate text-sm font-medium block text-foreground dark:text-dark-foreground">{matter.name || 'Untitled Matter'}</span>
                               </div>
                            </div>
                            <ChevronRight className={`ml-2 h-4 w-4 text-muted-foreground/70 group-hover:text-primary transition-transform duration-150 group-hover:translate-x-0.5 ${activeCaseId === matter.id ? 'text-primary': 'dark:text-dark-muted-foreground/70 dark:group-hover:text-primary' }`} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 text-center h-[150px]">
                    <FolderPlus className="h-8 w-8 text-muted-foreground/60 mb-2" />
                    <p className="text-sm font-medium text-muted-foreground mb-1">No Matters Yet</p>
                    <p className="text-xs text-muted-foreground/80 mb-3">Create your first matter to organize your work</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-primary dark:text-dark-primary flex items-center">
              <FilePieChart className="mr-2 h-5 w-5 text-primary" />
              Document Intelligence CoPilot
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card 
              className={`${glassCardClass} ${glassInnerBorder} ${glassReflection}`}
              tabIndex={0}
              onClick={handleUploadDocument}
              role="button"
              aria-label="Upload Document"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center mb-1">
                  <Upload className="h-6 w-6 mr-3 text-primary drop-shadow group-hover:text-orange-500 transition-colors duration-200" />
                  <CardTitle className="text-xl font-bold group-hover:text-orange-600 transition-colors duration-200">Upload Document</CardTitle>
                </div>
                <CardDescription className="text-base text-neutral-700/80 dark:text-neutral-200/80">Upload new documents to your workspace</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pb-2 flex flex-col justify-end flex-1">
                <div className="mt-6 text-lg font-semibold text-primary/80 dark:text-legal-purple/80 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors duration-200 tracking-wide flex items-center gap-2">
                  <span>Upload</span>
                  <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`${glassCardClass} ${glassInnerBorder} ${glassReflection}`}
              tabIndex={0}
              onClick={handleGenerateAIDocument}
              role="button"
              aria-label="AI Document"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center mb-1">
                  <Brain className="h-6 w-6 mr-3 text-primary drop-shadow group-hover:text-orange-500 transition-colors duration-200" />
                  <CardTitle className="text-xl font-bold group-hover:text-orange-600 transition-colors duration-200">AI Document</CardTitle>
                </div>
                <CardDescription className="text-base text-neutral-700/80 dark:text-neutral-200/80">Generate a document with AI assistance</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pb-2 flex flex-col justify-end flex-1">
                 <div className="mt-6 text-lg font-semibold text-primary/80 dark:text-legal-purple/80 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors duration-200 tracking-wide flex items-center gap-2">
                  <span>AI Document</span>
                  <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`${glassCardClass} ${glassInnerBorder} ${glassReflection}`}
              tabIndex={0}
              onClick={() => navigate('/quick-scan')}
              role="button"
              aria-label="Quick Scan"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center mb-1">
                  <ScanText className="h-6 w-6 mr-3 text-primary drop-shadow group-hover:text-orange-500 transition-colors duration-200" />
                  <CardTitle className="text-xl font-bold group-hover:text-orange-600 transition-colors duration-200 flex items-center gap-2">
                    Quick Scan
                  </CardTitle>
                </div>
                <CardDescription className="text-base text-neutral-700/80 dark:text-neutral-200/80">
                  Get a quick analysis of a document
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pb-2 flex flex-col justify-end flex-1">
                <div className="mt-6 text-lg font-semibold text-primary/80 dark:text-legal-purple/80 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors duration-200 tracking-wide flex items-center gap-2">
                  <span>Quick Scan</span>
                  <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`${glassCardClass} ${glassInnerBorder} ${glassReflection}`}
              tabIndex={0}
              onClick={() => navigate('/files')}
              role="button"
              aria-label="Review Document"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center mb-1">
                  <FileCheck className="h-6 w-6 mr-3 text-primary drop-shadow group-hover:text-orange-500 transition-colors duration-200" />
                  <CardTitle className="text-xl font-bold group-hover:text-orange-600 transition-colors duration-200">Review Document</CardTitle>
                </div>
                <CardDescription className="text-base text-neutral-700/80 dark:text-neutral-200/80">Review and analyze existing document</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pb-2 flex flex-col justify-end flex-1">
                <div className="mt-6 text-lg font-semibold text-primary/80 dark:text-legal-purple/80 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors duration-200 tracking-wide flex items-center gap-2">
                  <span>Review</span>
                  <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-primary dark:text-dark-primary flex items-center">
              <BookTemplate className="mr-2 h-5 w-5 text-primary" />
              Template Suite CoPilot
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card 
              className={`${glassCardClass} ${glassInnerBorder} ${glassReflection}`}
              tabIndex={0}
              onClick={handleGenerateAITemplate}
              role="button"
              aria-label="Generate AI Template"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center mb-1">
                  <Brain className="h-6 w-6 mr-3 text-primary drop-shadow group-hover:text-orange-500 transition-colors duration-200" />
                  <CardTitle className="text-xl font-bold group-hover:text-orange-600 transition-colors duration-200">Generate AI Template</CardTitle>
                </div>
                <CardDescription className="text-base text-neutral-700/80 dark:text-neutral-200/80">Create a new template with AI assistance</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pb-2 flex flex-col justify-end flex-1">
                <div className="mt-6 text-lg font-semibold text-primary/80 dark:text-legal-purple/80 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors duration-200 tracking-wide flex items-center gap-2">
                  <span>Generate AI Template</span>
                  <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`${glassCardClass} ${glassInnerBorder} ${glassReflection}`}
              tabIndex={0}
              onClick={handleUseTemplateClick}
              role="button"
              aria-label="Use Custom Template"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center mb-1">
                  <FileUp className="h-6 w-6 mr-3 text-primary drop-shadow group-hover:text-orange-500 transition-colors duration-200" />
                  <CardTitle className="text-xl font-bold group-hover:text-orange-600 transition-colors duration-200">Use Custom Template</CardTitle>
                </div>
                <CardDescription className="text-base text-neutral-700/80 dark:text-neutral-200/80">Use one of your existing templates</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pb-2 flex flex-col justify-end flex-1">
                <div className="mt-6 text-lg font-semibold text-primary/80 dark:text-legal-purple/80 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors duration-200 tracking-wide flex items-center gap-2">
                  <span>Use Custom Template</span>
                  <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-primary dark:text-dark-primary flex items-center">
              <Brain className="mr-2 h-5 w-5 text-primary" />
              AI Legal Intelligence CoPilot
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card 
              className={`${glassCardClass} ${glassInnerBorder} ${glassReflection}`}
              tabIndex={0}
              onClick={handleNewChat}
              role="button"
              aria-label="New Legal Chat"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center mb-1">
                  <MessageSquarePlus className="h-6 w-6 mr-3 text-primary drop-shadow group-hover:text-orange-500 transition-colors duration-200" />
                  <CardTitle className="text-xl font-bold group-hover:text-orange-600 transition-colors duration-200">New Legal Chat</CardTitle>
                </div>
                <CardDescription className="text-base text-neutral-700/80 dark:text-neutral-200/80">Ask questions and get legal insights</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pb-2 flex flex-col justify-end flex-1">
                <div className="mt-6 text-lg font-semibold text-primary/80 dark:text-legal-purple/80 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors duration-200 tracking-wide flex items-center gap-2">
                  <span>New Legal Chat</span>
                  <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`${glassCardClass} ${glassInnerBorder} ${glassReflection}`}
              tabIndex={0}
              onClick={() => navigate('/explain-concept')}
              role="button"
              aria-label="Explain Legal Terms"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center mb-1">
                  <BookHeadphones className="h-6 w-6 mr-3 text-primary drop-shadow group-hover:text-orange-500 transition-colors duration-200" />
                  <CardTitle className="text-xl font-bold group-hover:text-orange-600 transition-colors duration-200 flex items-center gap-2">
                    Explain Legal Terms
                  </CardTitle>
                </div>
                <CardDescription className="text-base text-neutral-700/80 dark:text-neutral-200/80">
                  Get explanations for complex legal concepts
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pb-2 flex flex-col justify-end flex-1">
                <div className="mt-6 text-lg font-semibold text-primary/80 dark:text-legal-purple/80 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors duration-200 tracking-wide flex items-center gap-2">
                  <span>Explain Legal Terms</span>
                  <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`${glassCardClass} ${glassInnerBorder} ${glassReflection}`}
              tabIndex={0}
              onClick={handleActivateDeepResearch}
              role="button"
              aria-label="Deep Legal Research"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center mb-1">
                  <Brain className="h-6 w-6 mr-3 text-primary drop-shadow group-hover:text-orange-500 transition-colors duration-200" />
                  <CardTitle className="text-xl font-bold group-hover:text-orange-600 transition-colors duration-200">Deep Legal Research</CardTitle>
                </div>
                <CardDescription className="text-base text-neutral-700/80 dark:text-neutral-200/80">Conduct in-depth legal research with advanced AI.</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pb-2 flex flex-col justify-end flex-1">
                <div className="mt-6 text-lg font-semibold text-primary/80 dark:text-legal-purple/80 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors duration-200 tracking-wide flex items-center gap-2">
                  <span>Deep Research</span>
                  <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`${glassCardClass} ${glassInnerBorder} ${glassReflection}`}
              tabIndex={0}
              onClick={() => navigate('/tools/intelligent-translations')}
              role="button"
              aria-label="Intelligent Translations"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center mb-1">
                  <Languages className="h-6 w-6 mr-3 text-primary drop-shadow group-hover:text-orange-500 transition-colors duration-200" />
                  <CardTitle className="text-xl font-bold group-hover:text-orange-600 transition-colors duration-200 flex items-center gap-2">
                    Intelligent Translations
                  </CardTitle>
                </div>
                <CardDescription className="text-base text-neutral-700/80 dark:text-neutral-200/80">
                  Translate text for client communication.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pb-2 flex flex-col justify-end flex-1">
                <div className="mt-6 text-lg font-semibold text-primary/80 dark:text-legal-purple/80 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors duration-200 tracking-wide flex items-center gap-2">
                  <span>Translate</span>
                  <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`${glassCardClass} ${glassInnerBorder} ${glassReflection}`}
              tabIndex={0}
              onClick={() => navigate('/tools/intelligent-drafting')}
              role="button"
              aria-label="Intelligent Drafting"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center mb-1">
                  <FileSignature className="h-6 w-6 mr-3 text-primary drop-shadow group-hover:text-orange-500 transition-colors duration-200" />
                  <CardTitle className="text-xl font-bold group-hover:text-orange-600 transition-colors duration-200 flex items-center gap-2">
                    Intelligent Drafting
                  </CardTitle>
                </div>
                <CardDescription className="text-base text-neutral-700/80 dark:text-neutral-200/80">
                  AI-powered first drafts for communications.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pb-2 flex flex-col justify-end flex-1">
                <div className="mt-6 text-lg font-semibold text-primary/80 dark:text-legal-purple/80 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors duration-200 tracking-wide flex items-center gap-2">
                  <span>Draft</span>
                  <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`${glassCardClass} ${glassInnerBorder} ${glassReflection}`}
              tabIndex={0}
              onClick={() => navigate('/tools/discovery-copilot')}
              role="button"
              aria-label="AI Discovery CoPilot"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center mb-1">
                  <UsersRound className="h-6 w-6 mr-3 text-primary drop-shadow group-hover:text-orange-500 transition-colors duration-200" />
                  <CardTitle className="text-xl font-bold group-hover:text-orange-600 transition-colors duration-200 flex items-center gap-2">
                    AI Discovery CoPilot
                  </CardTitle>
                </div>
                <CardDescription className="text-base text-neutral-700/80 dark:text-neutral-200/80">
                  Analyze discovery & draft responses from multiple documents <span className="font-semibold text-blue-600 dark:text-blue-400">(Test Feature)</span>.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pb-2 flex flex-col justify-end flex-1">
                <div className="mt-6 text-lg font-semibold text-primary/80 dark:text-legal-purple/80 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors duration-200 tracking-wide flex items-center gap-2">
                  <span>Start CoPilot</span>
                  <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`${glassCardClass} ${glassInnerBorder} ${glassReflection}`}
              tabIndex={0}
              onClick={() => {
                if (!activeCaseId) {
                  setIsCaseRequiredDialogOpen(true);
                  return;
                }
                navigate(`/cases/${activeCaseId}/compare`);
              }}
              role="button"
              aria-label="Compare Documents"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center mb-1">
                  <ScaleIcon className="h-6 w-6 mr-3 text-primary drop-shadow group-hover:text-orange-500 transition-colors duration-200" />
                  <CardTitle className="text-xl font-bold group-hover:text-orange-600 transition-colors duration-200 flex items-center gap-2">
                    Compare Documents
                  </CardTitle>
                </div>
                <CardDescription className="text-base text-neutral-700/80 dark:text-neutral-200/80">
                  Visually compare two documents in your case
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pb-2 flex flex-col justify-end flex-1">
                <div className="mt-6 text-lg font-semibold text-primary/80 dark:text-legal-purple/80 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors duration-200 tracking-wide flex items-center gap-2">
                  <span>Compare</span>
                  <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </CardContent>
            </Card>

          </div>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-primary dark:text-dark-primary flex items-center">
              <Settings className="mr-2 h-5 w-5 text-primary" />
              Utilities & Management
            </h2>
          </div>
          <div className="grid grid-cols-1 max-w-md mx-auto">
            <Card 
              className={`${glassCardClass} ${glassInnerBorder} ${glassReflection}`}
              tabIndex={0}
              onClick={() => navigate('/settings')}
              role="button"
              aria-label="Application Settings"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center mb-1">
                  <Settings className="h-6 w-6 mr-3 text-primary drop-shadow group-hover:text-orange-500 transition-colors duration-200" />
                  <CardTitle className="text-xl font-bold group-hover:text-orange-600 transition-colors duration-200">Application Settings</CardTitle>
                </div>
                <CardDescription className="text-base text-neutral-700/80 dark:text-neutral-200/80">Configure application and account settings</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pb-2 flex flex-col justify-end flex-1">
                <div className="mt-6 text-lg font-semibold text-primary/80 dark:text-legal-purple/80 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors duration-200 tracking-wide flex items-center gap-2">
                  <span>Application Settings</span>
                  <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

      </div>

      <TemplateSelectorModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onTemplateSelect={handleTemplateSelected}
      />
      <CaseRequiredDialog
        isOpen={isCaseRequiredDialogOpen}
        onClose={() => setIsCaseRequiredDialogOpen(false)}
        action={"perform this action"}
      />
      <CaseManagementModal
        isOpen={isCaseManagementModalOpen}
        onClose={() => {
            setIsCaseManagementModalOpen(false);
            handleRefreshMatters();
        }}
        onCasesUpdated={handleRefreshMatters}
      />
      <NewAITemplateDraftModal
        isOpen={isNewAITemplateModalOpenVal}
        onClose={() => setIsNewAITemplateModalOpen(false)}
      />
      <NewAIDocumentDraftModal
        isOpen={isNewAIDocumentDraftModalOpenVal}
        onClose={() => setIsNewAIDocumentDraftModalOpen(false)}
        activeCaseId={activeCaseId}
         onSuccess={(newDocId: string) => { 
            navigate(`/review/document/${newDocId}`);
        }}
      />

    </div>
  );
};

export default DashboardPage; 