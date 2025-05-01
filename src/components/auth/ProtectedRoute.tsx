import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
// import { useAuth } from '@/context/AuthContext'; // OLD PATH
import { useAuth } from '@/hooks/useAuth'; // CORRECT PATH
import { Spinner } from '@/components/ui/Spinner'; // Assuming a Spinner component exists

const ProtectedRoute: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    // Show a loading indicator while checking auth status
    return (
      <div className="flex justify-center items-center h-screen w-screen bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    // If not loading and no user, redirect to login page
    return <Navigate to="/auth" replace />;
  }

  // If authenticated, render the nested routes (AppLayout and its children)
  return <Outlet />;
};

export default ProtectedRoute; 