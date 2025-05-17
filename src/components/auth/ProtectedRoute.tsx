import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
// import { useAuth } from '@/context/AuthContext'; // OLD PATH
import { useAuth } from '@/hooks/useAuth'; // CORRECT PATH
import { Spinner } from '@/components/ui/Spinner'; // Assuming a Spinner component exists

// Define the trial AI call limit, or import from a shared constants file
const TRIAL_AI_CALL_LIMIT = 30;

const ProtectedRoute: React.FC = () => {
  const { user, userProfile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    // Show a loading indicator while checking auth status
    return (
      <div className="flex justify-center items-center h-screen w-screen bg-background dark:bg-near-black">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    // If not loading and no user, redirect to login page
    // The /auth page is outside the /app structure, so this path is correct.
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // If user is present, but profile is still loading (should be quick after user is available)
  // This might be a brief moment, or if profile fetching failed.
  // The AuthContext loading should ideally cover profile loading as well.
  // If userProfile is explicitly null and user is present, it might indicate an issue or a new user whose profile isn't created/fetched yet.
  // For now, we assume `loading` from `useAuth` covers the initial profile fetch.
  
  // If user is authenticated, check subscription/trial status
  if (userProfile) {
    const isTrialing = userProfile.subscription_status === 'trialing';
    const isActiveSubscription = userProfile.subscription_status === 'active';

    let trialIsValid = false;
    if (isTrialing && userProfile.trial_ends_at) {
      const trialEndDate = new Date(userProfile.trial_ends_at);
      const now = new Date();
      const callsUsed = userProfile.trial_ai_calls_used || 0;
      if (now <= trialEndDate && callsUsed < TRIAL_AI_CALL_LIMIT) {
        trialIsValid = true;
      }
    }

    // Allow access if trial is valid OR subscription is active
    if (trialIsValid || isActiveSubscription) {
      return <Outlet />; // User is authenticated and subscription is valid, allow access to /app/* routes
    } else {
      // If neither trial is valid nor subscription is active, redirect to subscription page
      // Pass a message to the subscription page indicating why they were redirected
      let message = "Your access has expired. Please subscribe to continue.";
      if (isTrialing && !trialIsValid) {
        const trialEndDate = userProfile.trial_ends_at ? new Date(userProfile.trial_ends_at) : null;
        const callsUsed = userProfile.trial_ai_calls_used || 0;
        if (trialEndDate && new Date() > trialEndDate) {
          message = "Your trial period has ended. Please subscribe to continue.";
        } else if (callsUsed >= TRIAL_AI_CALL_LIMIT) {
          message = "You have reached your trial AI call limit. Please subscribe to continue.";
        }
      } else if (userProfile.subscription_status && userProfile.subscription_status !== 'active' && userProfile.subscription_status !== 'trialing') {
        message = `Your subscription status is "${userProfile.subscription_status}". Please update your subscription or contact support.`;
      }
      // Check if already on settings/subscription to prevent loop if profile is valid but subscription is not active
      // Ensure these paths are now prefixed with /app
      if (location.pathname === '/app/settings/subscription' || location.pathname === '/app/settings') {
        return <Outlet />; // Allow SettingsPage to render and show the message/status
      }
      return <Navigate to="/app/settings/subscription" state={{ message: message, from: location }} replace />;
    }
  } else if (!loading && user && !userProfile) {
    // This case: AuthContext loading is done, user exists, but userProfile is null (e.g., profile doesn't exist in DB).
    console.warn("ProtectedRoute: User is authenticated, but no profile found. Redirecting to /app/settings/subscription.");
    // If we are already on the page meant to handle missing profiles/subscriptions, let it render.
    // Ensure these paths are now prefixed with /app
    if (location.pathname === '/app/settings/subscription' || location.pathname === '/app/settings') {
      return <Outlet />; 
    }
    // Otherwise, navigate to the settings page to prompt for subscription/profile setup.
    return <Navigate to="/app/settings/subscription" state={{ message: "Your user profile isn't fully set up, or your subscription needs attention. Please review your subscription options below.", from: location }} replace />;
  }
  
  // Fallback: Should ideally not be reached if AuthContext is robust.
  // If user exists, and not loading, but somehow userProfile status is still indeterminate,
  // rendering Outlet is a safe default but might hide issues.
  // Given the checks, this implies an issue in AuthContext state if hit frequently.
  console.warn("ProtectedRoute: Fallback case, rendering Outlet. User exists, not loading, userProfile state was unexpected.")
  return <Outlet />;
};

export default ProtectedRoute; 