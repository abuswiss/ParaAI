import React from 'react';
import {
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter, 
  DialogClose // Import DialogClose for a close button
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Info, ListChecks } from 'lucide-react'; // Use icons

// Simple component to render the content of the About dialog
const AboutInfoModalContent: React.FC = () => {
  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center">
            <Info className="h-5 w-5 mr-2 text-primary" /> 
            Welcome to Paralegal AI
        </DialogTitle>
        <DialogDescription>
            Your intelligent legal document assistant.
        </DialogDescription>
      </DialogHeader>
      
      <div className="py-4 space-y-4 text-sm">
          <div>
            <h3 className="font-semibold text-foreground mb-1">What can you do here?</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Upload, analyze, and chat about legal documents</li>
              <li>Use AI to extract key clauses, risks, and summaries</li>
              <li>Draft new documents from smart templates</li>
              <li>Organize cases and manage files</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">Quick Start</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Select or create a Case in the sidebar</li>
              <li>Upload documents to the selected case</li>
              <li>View documents, see analysis, and chat for insights</li>
              <li>Explore Templates to draft new documents</li>
            </ul>
          </div>
           <div className="pt-2 text-xs text-muted-foreground border-t border-border">
             <p className="mt-2">
                **Disclaimer:** Paralegal AI is an assistive tool and does not provide legal advice. 
                Always review AI-generated content with a qualified legal professional. 
                Use of this tool does not create an attorney-client relationship.
             </p>
          </div>
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary">
            Close
          </Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  );
};

export default AboutInfoModalContent; 