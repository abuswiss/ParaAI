import React, { useState } from 'react';
import { InfoIcon } from '../ui/Icons';
import { Tooltip } from '../ui/Tooltip';
import MagicalInfoButton from '../ui/MagicalInfoButton';

interface HeaderProps {
  toggleSidebar: () => void;
  isSidebarOpen: boolean;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar, isSidebarOpen }) => {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <header className="
      bg-surface border-b border-gray-800 
      py-3 px-4 md:px-6
      flex items-center justify-between
      transition-all duration-300 ease-in-out
      shadow-sm shadow-inner-light
    ">
      <div className="flex items-center">
        <button
          onClick={toggleSidebar}
          className="
            text-text-secondary hover:text-text-primary
            p-2 rounded-full
            hover:bg-surface-lighter
            bg-surface-darker
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50
            mr-3
            z-50
            shadow-sm
          "
          aria-label="Toggle sidebar"
        >
          {isSidebarOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
        <div className="flex items-center">
          {/* Logo or icon could go here */}
          <span className="text-primary font-medium text-lg">Paralegal AI</span>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        {/* Search button - greyed out with tooltip */}
        <Tooltip content="Full app search coming soon">
          <button className="
            p-2 rounded-full
            text-gray-500 cursor-not-allowed
            bg-surface-lighter
            transition-all duration-200
            focus:outline-none
          "
            tabIndex={-1}
            aria-label="Search (coming soon)"
            disabled
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </Tooltip>
        {/* Magical AI Info button - now animated and extracted */}
        <MagicalInfoButton />
      </div>
    </header>
  );
};

export default Header;
