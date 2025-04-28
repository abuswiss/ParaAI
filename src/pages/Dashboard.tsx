import React from 'react';

const Dashboard: React.FC = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 text-center bg-neutral-50 dark:bg-background">
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold text-neutral-800 dark:text-text-primary mb-4">
          Welcome to your Paralegal AI Assistant
        </h1>
        <p className="text-neutral-600 dark:text-text-secondary">
          Select a case from the left panel to view its details and documents.
          You can manage your document templates using the link in the navigation panel.
          Select a document or draft to begin editing in this area.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
