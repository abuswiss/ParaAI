import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAtomValue } from 'jotai';
import { themePreferenceAtom } from '@/atoms/appAtoms';
import { cn } from '@/lib/utils';

const LandingPage: React.FC = () => {
  const theme = useAtomValue(themePreferenceAtom);

  React.useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    // Determine theme, defaulting to 'light' if 'system' or undefined
    const currentTheme = theme === 'system' 
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') 
      : theme || 'light';
    document.documentElement.classList.add(currentTheme);
  }, [theme]);

  return (
    <div className={cn(
      "flex flex-col items-center justify-center min-h-screen p-8",
      "bg-background text-foreground" // Uses global styles for light/dark mode
    )}>
      <header className="mb-12 text-center">
        {/* Optional: A simple text logo or an SVG icon could be placed here */}
        {/* For now, using a text-based title */}
        <h1 className="text-5xl font-bold mb-4 text-primary dark:text-primary">
          BenchWise
        </h1>
        <p className="text-xl text-muted-foreground dark:text-dark-muted-foreground">
          Revolutionizing legal workflows with AI.
        </p>
      </header>

      <main className="mb-12 w-full max-w-2xl text-center">
        <div className="p-10 border rounded-xl shadow-xl bg-card text-card-foreground dark:bg-dark-card dark:text-dark-card-foreground">
          <h2 className="text-3xl font-semibold mb-6">
            Supercharge Your Paralegal Tasks
          </h2>
          <p className="text-lg text-muted-foreground dark:text-dark-muted-foreground mb-8">
            Discover intelligent drafting, in-depth document analysis, and seamless case management. BenchWise is your AI-powered partner for peak efficiency.
          </p>
          {/* Future marketing content sections can be added below */}
          {/* <div className="mt-8">
            <h3 className="text-2xl font-semibold mb-4">Key Features</h3>
            <ul className="list-disc list-inside text-left text-muted-foreground">
              <li>AI-Powered Document Review</li>
              <li>Intelligent Clause Detection</li>
              <li>Automated Summary Generation</li>
              <li>Secure Case Management</li>
            </ul>
          </div> */}
        </div>
      </main>

      <footer className="text-center">
        <Button asChild size="lg" className="px-10 py-6 text-lg">
          <Link to="/auth">Get Started / Login</Link>
        </Button>
        <p className="mt-6 text-sm text-muted-foreground dark:text-dark-muted-foreground">
          Access your dashboard or create a new account.
        </p>
      </footer>
    </div>
  );
};

export default LandingPage; 