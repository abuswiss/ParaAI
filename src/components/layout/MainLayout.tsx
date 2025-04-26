import React, { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Header from './Header';
import Sidebar from './Sidebar';

const MainLayout: React.FC = () => {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4"></div>
          <div className="text-text-primary">Loading...</div>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    return <Navigate to="/auth" />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-text-primary relative">
      {/* Sidebar with smooth transition */}
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
      
      {/* Main content area with smooth transition */}
      <div 
        className={`
          flex flex-col flex-1 
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'md:ml-64' : 'ml-0'}
          w-full
          bg-background
          absolute md:relative inset-0
        `}
      >
        <Header toggleSidebar={toggleSidebar} isSidebarOpen={sidebarOpen} />
        
        {/* Main content with refined padding and scrolling */}
        <main className="
          flex-1 overflow-auto
          px-4 py-6 md:px-6 md:py-8
          transition-all duration-300 ease-in-out
        ">
          <div className="
            max-w-7xl mx-auto
            h-full
            animate-fadeIn
          ">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
