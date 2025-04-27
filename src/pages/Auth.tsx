import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthCard from '../components/auth/AuthCard';
import AuthTabs from '../components/auth/AuthTabs';
import SignInForm from '../components/auth/SignInForm';
import SignUpForm from '../components/auth/SignUpForm';
import LegalDisclaimer from '../components/auth/LegalDisclaimer';
import { useAuth } from '../context/AuthContext';
import MagicalInfoButton from '../components/ui/MagicalInfoButton';

const Auth: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect to dashboard if already authenticated
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
      {/* Magical Info Button in upper right */}
      <div className="absolute top-4 right-4 z-40">
        <MagicalInfoButton />
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
