import React from 'react';

interface HeaderProps {
  toggleSidebar: () => void;
  isSidebarOpen: boolean;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar, isSidebarOpen }) => {
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
        {/* Search button */}
        <button className="
          p-2 rounded-full
          text-text-secondary hover:text-text-primary
          hover:bg-surface-lighter
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50
        ">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
        
        {/* Notifications button */}
        <button className="
          p-2 rounded-full
          text-text-secondary hover:text-text-primary
          hover:bg-surface-lighter
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50
          relative
        ">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary"></span>
        </button>
      </div>
    </header>
  );
};

export default Header;
