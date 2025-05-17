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
import ParticleBackground from '../components/common/ParticleBackground';

const Auth: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !loading) {
      navigate('/app/dashboard');
    }
  }, [user, loading, navigate]);

  const handleAuthSuccess = () => {
    navigate('/app/dashboard');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-text-primary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-transparent">
      {/* Particle Background */}
      <ParticleBackground />

      {/* Alpha Release Banner */}
      <div className="absolute top-0 left-0 bg-yellow-400 text-yellow-900 px-3 py-1 text-xs font-bold rounded-br-md z-50">
        ALPHA RELEASE
      </div>
      <AuthCard 
        title="Sign in to your account" 
        className="z-10 relative"
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
