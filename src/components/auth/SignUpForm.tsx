import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import * as authService from '@/services/authService';
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Checkbox } from "@/components/ui/Checkbox";
import { Icons } from "@/components/ui/Icons";
import { Eye, EyeOff, Mail, Lock, CheckCircle } from 'lucide-react';

interface SignUpFormProps {
  onSuccess?: () => void;
}

const SignUpForm: React.FC<SignUpFormProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [localSuccessMessage, setLocalSuccessMessage] = useState<string | null>(null);
  
  const { loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalSuccessMessage(null);
    setFormError(null);
    
    if (!acceptTerms) {
      setFormError('Please review and accept the Terms & Conditions to create your BenchWise account.');
      return;
    }
    
    setIsSubmitting(true);
    const { error: signUpError } = await authService.signUp({ email, password });

    if (!signUpError) {
      setLocalSuccessMessage('Welcome to BenchWise! Please check your email to confirm your account.');
      onSuccess?.();
      setEmail('');
      setPassword('');
      setAcceptTerms(false);
    } else {
      setFormError(signUpError.message || "An unexpected error occurred during sign up.");
    }
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError && !localSuccessMessage && (
        <Alert variant="destructive">
          <Icons.AlertTriangle className="h-4 w-4" />
          <AlertTitle>Sign Up Failed</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      
      {localSuccessMessage && (
        <Alert variant="default">
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{localSuccessMessage}</AlertDescription>
        </Alert>
      )}
      
      {!localSuccessMessage && (
          <>
              <div className="space-y-1.5">
                <Label htmlFor="signup-email">Email Address</Label>
                <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-purple-gray" />
                    <Input
                        id="signup-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className="pl-10"
                        disabled={isSubmitting || authLoading}
                    />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="signup-password">Password</Label>
                <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-purple-gray" />
                    <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create a password"
                        required
                        className="pl-10 pr-10"
                        disabled={isSubmitting || authLoading}
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:bg-transparent hover:text-foreground dark:hover:text-off-white"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        disabled={isSubmitting || authLoading}
                    >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                 <Checkbox 
                    id="terms" 
                    checked={acceptTerms}
                    onCheckedChange={(checked) => setAcceptTerms(Boolean(checked))}
                    disabled={isSubmitting || authLoading}
                  />
                <Label htmlFor="terms" className="text-sm font-normal text-muted-foreground dark:text-soft-purple">
                   I agree to the <a href="#" className="text-primary hover:underline dark:text-legal-purple dark:hover:text-royal-purple">Terms and Conditions</a>
                </Label>
              </div>
              
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || authLoading || !acceptTerms}
              >
                {isSubmitting ? (
                  <Icons.Loader className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  "Create BenchWise Account"
                )}
              </Button>
          </>
      )}
    </form>
  );
};

export default SignUpForm;