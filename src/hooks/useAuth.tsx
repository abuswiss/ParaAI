import { useContext } from 'react';
import { AuthContext, AuthContextType } from '@/context/AuthContext';

// This custom hook now directly consumes and returns the AuthContext.
// It serves as the primary way for components to access authentication state
// and user profile information.
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // This error means a component is trying to useAuth outside of an AuthProvider.
    // Ensure your component tree is wrapped with <AuthProvider>.
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 