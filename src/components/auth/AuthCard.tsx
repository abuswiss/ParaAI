import React from 'react';

interface AuthCardProps {
  children: React.ReactNode;
  logo?: boolean;
  title: string;
  subtitle?: string;
}

const AuthCard: React.FC<AuthCardProps> = ({ 
  children, 
  logo = true, 
  title, 
  subtitle 
}) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          {logo && (
            <div className="mb-3">
              <img 
                src="/src/assets/gavel-icon.svg" 
                alt="Paralegal AI Assistant Logo" 
                className="h-16 w-16 text-primary"
                onError={(e) => {
                  // Fallback to an emoji if the image fails to load
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
          <h1 className="text-2xl font-semibold text-text-primary">Paralegal AI Assistant</h1>
          <p className="text-sm text-text-secondary">Your intelligent legal document assistant</p>
          <h2 className="mt-8 text-xl font-medium text-text-primary">{title}</h2>
          {subtitle && <p className="mt-2 text-sm text-text-secondary">{subtitle}</p>}
        </div>
        <div className="overflow-hidden rounded-lg border border-gray-800 bg-background shadow-card">
          {children}
        </div>
        <div className="mt-4 text-center text-xs text-text-secondary">
          <span>Secure authentication powered by Paralegal AI</span>
        </div>
      </div>
    </div>
  );
};

export default AuthCard;
