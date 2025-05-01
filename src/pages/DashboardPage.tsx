import React from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useSetAtom } from 'jotai';
import {
  uploadModalOpenAtom,
  resetChatTriggerAtom,
  commandPaletteOpenAtom,
  selectTemplateModalOpenAtom,
} from '@/atoms/appAtoms';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { 
  RefreshIcon, 
  DocumentIcon as DocumentIconFromUI,
  PlusIcon, 
  FileTextIcon
} from '@/components/ui/Icons';
import { FolderPlus, MessageSquarePlus, Upload, FileText, Search } from 'lucide-react';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const setUploadModalOpen = useSetAtom(uploadModalOpenAtom);
  const triggerChatReset = useSetAtom(resetChatTriggerAtom);
  const setCommandPaletteOpen = useSetAtom(commandPaletteOpenAtom);
  const setShowSelectTemplateModal = useSetAtom(selectTemplateModalOpenAtom);

  const handleNewCase = () => {
    navigate('/files', { state: { action: 'createCase' } });
  };

  const handleUploadDocument = () => {
    setUploadModalOpen(true);
  };

  const handleNewChat = () => {
    triggerChatReset(c => c + 1);
  };

  const handleUseTemplate = () => {
    setShowSelectTemplateModal(true);
  };

  const handleGlobalSearch = () => {
    setCommandPaletteOpen(true);
  };

  return (
    <div className="p-4 md:p-6 h-full overflow-y-auto bg-background text-foreground">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-2">
          Welcome back!
        </h1>
        <p className="text-base md:text-lg text-muted-foreground">
          What can BenchWise help you with today?
        </p>
      </div>

      <div className="mb-8">
        <Button 
          variant="outline"
          className="w-full h-12 text-lg justify-start text-muted-foreground hover:text-foreground border-dashed hover:border-solid" 
          onClick={handleGlobalSearch}
        >
          <Search className="mr-3 h-5 w-5" /> 
          Ask anything, search cases, documents, templates...
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <Card className="hover:shadow-lg transition-shadow border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquarePlus className="h-5 w-5 text-primary" />
              Start a New Chat
            </CardTitle>
            <CardDescription>Ask questions, get legal insights, or analyze text.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={handleNewChat}>
              <RefreshIcon className="mr-2 h-4 w-4" /> New Chat
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileTextIcon className="h-5 w-5 text-primary" />
              Work with Documents
            </CardTitle>
            <CardDescription>Upload, view, analyze, or summarize your documents.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={handleUploadDocument}>
              <Upload className="mr-2 h-4 w-4" /> Upload
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => navigate('/files')}> 
              <Search className="mr-2 h-4 w-4" /> Browse
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Use Templates
            </CardTitle>
            <CardDescription>Draft new documents efficiently using your templates.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={handleUseTemplate}>
              <PlusIcon className="mr-2 h-4 w-4" /> Use Template
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => navigate('/files', { state: { view: 'templates' } })}> 
              <Search className="mr-2 h-4 w-4" /> Browse
            </Button>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-shadow border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-primary" />
              Manage Cases
            </CardTitle>
            <CardDescription>Organize your documents and related information.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate('/files')}> 
              <Search className="mr-2 h-4 w-4" /> View Cases & Files
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage; 