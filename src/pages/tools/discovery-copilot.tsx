import React from 'react';
import { CopilotProvider } from '@/context/CopilotContext';
import { CaseProvider } from '@/context/CaseContext';
import MultiDocumentSelector from '@/components/ai/copilot/MultiDocumentSelector';
import CopilotTaskConfiguration from '@/components/ai/copilot/CopilotTaskConfiguration';
import CopilotOutputDisplay from '@/components/ai/copilot/CopilotOutputDisplay';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/Badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Terminal } from 'lucide-react';

const CopilotMainInterface: React.FC = () => {
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/tools">AI Tools</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>AI Discovery CoPilot</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center mb-6">
        <h1 className="text-3xl font-bold mr-3">AI Discovery CoPilot</h1>
        <Badge>Beta</Badge>
      </div>
      
      <Alert className="mb-6">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Welcome to AI Discovery CoPilot (Beta)!</AlertTitle>
        <AlertDescription>
          Select up to 3 documents, define your goal (e.g., "Draft responses to these interrogatories", "Identify objections to these document requests"), and let the AI assist you. 
          This tool works best with clear, specific goals and well-processed documents.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 flex flex-col space-y-6">
          <MultiDocumentSelector />
          <CopilotTaskConfiguration />
        </div>
        <div className="lg:col-span-2">
          <CopilotOutputDisplay />
        </div>
      </div>
    </div>
  );
};

const CopilotMainInterfacePage: React.FC = () => {
  return (
    <CopilotProvider>
      <CaseProvider>
        <CopilotMainInterface />
      </CaseProvider>
    </CopilotProvider>
  );
};

export default CopilotMainInterfacePage;