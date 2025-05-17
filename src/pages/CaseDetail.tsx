import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAtom } from 'jotai';
import { getCaseById } from '../services/caseService';
import { Case } from '../types/case';
import { activeCaseAtom } from '@/atoms/appAtoms';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ArrowLeft } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { AlertTriangle } from 'lucide-react';

const CaseDetail: React.FC = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const [activeCase, setActiveCase] = useAtom(activeCaseAtom);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (caseId && activeCase?.id !== caseId) {
      setLoading(true);
      setActiveCase(caseId);
    }
    const checkCaseDetails = async () => {
      if (!caseId) return;
      if(activeCase?.id === caseId && activeCase?.details) {
          setLoading(false);
          setError(null);
          return;
      }
      const timeoutId = setTimeout(() => {
            if (activeCase?.id === caseId && !activeCase.details) {
                setLoading(false);
            }
        }, 2000);

       return () => clearTimeout(timeoutId);
    };

    checkCaseDetails();

  }, [caseId, activeCase, setActiveCase]);

  useEffect(() => {
    if (activeCase?.id === caseId && activeCase?.details) {
      setLoading(false);
      setError(null);
    } else if (activeCase?.id === caseId && !activeCase.details) {
       setLoading(true); 
    }
  }, [activeCase, caseId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
       <div className="container mx-auto p-4">
         <Alert variant="destructive">
           <AlertTriangle className="h-4 w-4" />
           <AlertTitle>Error</AlertTitle>
           <AlertDescription>{error}</AlertDescription>
         </Alert>
       </div>
    );
  }

  if (!activeCase?.details) {
    return (
      <div className="container mx-auto p-4 text-center">
        <p>Matter not found or details could not be loaded.</p>
        <Link to="/files">
          <Button variant="link" className="mt-4">
            Go back to Matters
          </Button>
        </Link>
      </div>
    );
  }

  const caseDetails = activeCase.details;

  return (
    <div className="container mx-auto p-4 md:p-6">
      <Link to="/files" className="mb-4 inline-block">
        <Button variant="outline" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Matters
        </Button>
      </Link>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{caseDetails.name || 'Matter Details'}</CardTitle>
        </CardHeader>
        <CardContent>
          <p><strong>Matter Number:</strong> {caseDetails.case_number || 'N/A'}</p>
          <p><strong>Status:</strong> <span className="capitalize">{caseDetails.status || 'N/A'}</span></p>
          <p><strong>Description:</strong> {caseDetails.description || 'No description available.'}</p>
        </CardContent>
      </Card>

      <h2 className="text-xl font-semibold mb-4">Documents</h2>
      <div className="p-4 border rounded-md bg-muted/40">
          <p className="text-sm text-muted-foreground">
              Document management for this matter is now handled in the 
              <Link to="/files" className="text-primary underline hover:no-underline mx-1">
                  File Manager
              </Link>.
              You can select the matter there to view its documents.
          </p>
           <Link to={`/files?caseId=${caseId}`}> 
             <Button variant="secondary" size="sm" className="mt-3">
               Go to Matter in File Manager
            </Button>
           </Link>
       </div>

    </div>
  );
};

export default CaseDetail;
