import React, { useState } from 'react';

interface AuthTabsProps {
  children: React.ReactNode[];
  tabNames: string[];
  defaultTab?: number;
}

const AuthTabs: React.FC<AuthTabsProps> = ({ 
  children, 
  tabNames, 
  defaultTab = 0 
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <div>
      <div className="flex border-b border-gray-800">
        {tabNames.map((tabName, index) => (
          <button
            key={index}
            className={`w-1/2 py-3 text-sm font-medium ${
              activeTab === index 
                ? 'text-primary border-b-2 border-primary' 
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setActiveTab(index)}
          >
            {tabName}
          </button>
        ))}
      </div>
      <div className="p-5">
        {React.Children.toArray(children)[activeTab]}
      </div>
    </div>
  );
};

export default AuthTabs;
