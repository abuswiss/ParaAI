import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import * as authService from '@/services/authService';
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Icons } from "@/components/ui/Icons";
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';

interface SignInFormProps {
  onSuccess?: () => void;
}

const SignInForm: React.FC<SignInFormProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    const { error: signInError } = await authService.signIn({ email, password });
    if (!signInError) {
      onSuccess?.();
    } else {
      setFormError(signInError.message || "An unexpected error occurred.");
    }
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError && (
        <Alert variant="destructive">
          <Icons.AlertTriangle className="h-4 w-4" />
          <AlertTitle>Sign In Failed</AlertTitle>
          <AlertDescription>{formError} Please try again.</AlertDescription>
        </Alert>
      )}
      
      <div className="space-y-1.5">
        <Label htmlFor="email">Email Address</Label>
        <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-purple-gray" />
            <Input
                id="email"
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
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <a href="#" className="text-xs text-primary hover:underline dark:text-legal-purple dark:hover:text-royal-purple">
            Forgot password?
          </a>
        </div>
        <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-purple-gray" />
            <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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
      
      <Button
        type="submit"
        className="w-full"
        disabled={isSubmitting || authLoading}
      >
        {isSubmitting ? (
          <Icons.Loader className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          "Secure Sign In"
        )}
      </Button>
    </form>
  );
};

export default SignInForm;