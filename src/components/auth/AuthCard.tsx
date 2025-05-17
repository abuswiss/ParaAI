import React from 'react';
import { 
    Card, 
    CardContent, 
    CardDescription, 
    CardFooter, 
    CardHeader, 
    CardTitle 
} from "@/components/ui/Card"; // Import shadcn Card components
import { Icons } from "@/components/ui/Icons"; // Assuming logo might be an Icon

interface AuthCardProps {
  children: React.ReactNode;
  logo?: boolean; // Keep optional logo flag
  title: string;
  subtitle?: string;
}

const AuthCard: React.FC<AuthCardProps> = ({ 
  children, 
  logo = true, 
  title, 
  subtitle 
}) => {

  // Removed canvas ref and useEffect for background animation

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background dark:bg-dark-background">
      {/* Removed canvas element */}
      
      <div className="w-full max-w-md relative z-10">
        {/* Top section (Logo, App Title, Subtitle) - Moved outside the Card for centering */}
        <div className="flex flex-col items-center mb-6">
          {logo && (
            <div className="mb-4 transition-transform hover:scale-105 duration-300">
              {/* Consider using Icons.Logo or similar if available */}
              <img 
                src="/src/assets/gavel-icon.svg" 
                alt="BenchWise Logo"
                className="h-16 w-16 text-primary dark:text-dark-primary"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const div = document.createElement('div');
                    div.textContent = '⚖️';
                    div.className = 'text-5xl';
                    parent.appendChild(div);
                  }
                }}
              />
            </div>
          )}
          <h1 className="text-2xl font-semibold text-foreground dark:text-dark-foreground mb-1 tracking-tight">
            BenchWise <span className="text-sm font-normal text-primary dark:text-dark-primary">(Alpha)</span>
          </h1>
          <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground mb-6">
            {subtitle || "Your intelligent legal co-pilot."}
          </p>
        </div>
        
        {/* The Card component is already themed. We rely on its inherent styles. */}
        <Card className="w-full"> 
          <CardHeader className="text-center">
            {/* CardTitle and CardDescription should inherit themed styles from Card component */}
            <CardTitle>{title}</CardTitle>
            {subtitle && <CardDescription>{subtitle}</CardDescription>}
          </CardHeader>
          <CardContent>
            {children} {/* Form content goes here */}
          </CardContent>
          {/* Footer can be added if needed, e.g., links */}
          {/* <CardFooter className="text-xs text-muted-foreground text-center">
            <p>Secure authentication powered by Paralegal AI</p>
          </CardFooter> */}
        </Card>
        
        {/* Moved footer text outside card */}
        <div className="mt-4 text-center text-xs text-muted-foreground dark:text-dark-muted-foreground">
          <span>Secure authentication powered by Paralegal AI</span>
        </div>
      </div>
    </div>
  );
};

export default AuthCard;