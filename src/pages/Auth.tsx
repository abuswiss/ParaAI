import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthCard from '../components/auth/AuthCard';
import AuthTabs from '../components/auth/AuthTabs';
import SignInForm from '../components/auth/SignInForm';
import SignUpForm from '../components/auth/SignUpForm';
import LegalDisclaimer from '../components/auth/LegalDisclaimer';
import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/Button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/Tooltip";
import { Info } from 'lucide-react';
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/Dialog";
import AboutInfoModalContent from '../components/common/AboutInfoModalContent';

const Auth: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !loading) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const handleAuthSuccess = () => {
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-text-primary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background">
      <div className="absolute top-4 right-4 z-40">
        <Dialog>
          <DialogTrigger asChild>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                  >
                    <Info className="h-5 w-5" />
                    <span className="sr-only">About Paralegal AI</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>About Paralegal AI & Quick Help</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DialogTrigger>
          <AboutInfoModalContent />
        </Dialog>
      </div>
      <AuthCard 
        title="Sign in to your account" 
      >
        <div className="p-5">
          <LegalDisclaimer />
          <AuthTabs tabNames={['Sign In', 'Sign Up']}>
            <SignInForm onSuccess={handleAuthSuccess} />
            <SignUpForm onSuccess={handleAuthSuccess} />
          </AuthTabs>
        </div>
      </AuthCard>
    </div>
  );
};

export default Auth;
