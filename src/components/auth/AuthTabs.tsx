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
      <div className="flex border-b border-gray-700/50">
        {tabNames.map((tabName, index) => (
          <button
            key={index}
            className={`relative w-1/2 py-4 text-sm font-medium transition-all duration-300 ${
              activeTab === index 
                ? 'text-primary' 
                : 'text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setActiveTab(index)}
          >
            {tabName}
            {activeTab === index && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full animate-fadeIn" />
            )}
          </button>
        ))}
      </div>
      <div className="p-6 transition-all duration-300">
        {React.Children.toArray(children).map((child, index) => (
          <div 
            key={index} 
            className={`transition-opacity duration-300 ${
              activeTab === index ? 'opacity-100' : 'opacity-0 hidden'
            }`}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AuthTabs;