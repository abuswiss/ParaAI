import React, { useState } from 'react';
import { InfoIcon } from '../ui/Icons';
import { Tooltip } from '../ui/Tooltip';

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
        {/* Magical AI Info button */}
        <Tooltip content="About Paralegal AI & Quick Help">
          <button
            className="p-2 rounded-full bg-gradient-to-tr from-pink-400 via-purple-500 to-yellow-400 text-white shadow-lg hover:scale-105 transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50"
            aria-label="About Paralegal AI"
            onClick={() => setShowInfo(true)}
          >
            <InfoIcon className="h-5 w-5" color="url(#ai-gradient)" />
            <svg width="0" height="0">
              <defs>
                <linearGradient id="ai-gradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#F472B6" />
                  <stop offset="50%" stopColor="#A78BFA" />
                  <stop offset="100%" stopColor="#FDE68A" />
                </linearGradient>
              </defs>
            </svg>
          </button>
        </Tooltip>
        {/* Info Popup */}
        {showInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
            <div className="relative bg-gradient-to-br from-gray-900 via-purple-900 to-yellow-900 border-4 border-primary rounded-2xl shadow-2xl p-8 max-w-lg w-full animate-fadeIn">
              <button
                className="absolute top-3 right-3 text-gray-300 hover:text-white focus:outline-none"
                aria-label="Close info popup"
                onClick={() => setShowInfo(false)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="flex flex-col items-center text-center">
                <div className="mb-4">
                  <InfoIcon className="h-12 w-12" color="url(#ai-gradient)" />
                </div>
                <h2 className="text-2xl font-bold text-primary mb-2">Welcome to Paralegal AI</h2>
                <p className="text-lg text-white mb-4">Your magical AI-powered legal assistant for document analysis, drafting, and more.</p>
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-pink-300 mb-1">What can you do here?</h3>
                  <ul className="text-white text-left mx-auto max-w-xs list-disc list-inside space-y-1">
                    <li>Upload, analyze, and chat about legal documents</li>
                    <li>Use AI to extract key clauses, risks, and summaries</li>
                    <li>Draft new documents from smart templates</li>
                    <li>Organize cases and manage files</li>
                    <li>Get instant legal insights and suggestions</li>
                  </ul>
                </div>
                <div className="mb-2">
                  <h3 className="text-lg font-semibold text-yellow-300 mb-1">Quick Start</h3>
                  <ul className="text-white text-left mx-auto max-w-xs list-disc list-inside space-y-1">
                    <li>Upload or select a document to begin</li>
                    <li>Ask questions or request analysis in chat</li>
                    <li>Try the Templates tab to draft new docs</li>
                  </ul>
                </div>
                <div className="mt-4 text-xs text-gray-300">Paralegal AI is not a law firm and does not provide legal advice. For informational purposes only.</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
