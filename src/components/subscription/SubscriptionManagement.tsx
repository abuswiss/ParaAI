import React, { useState, useEffect } from 'react';
import { useStripe } from '@stripe/react-stripe-js';
import { supabase } from '@/lib/supabaseClient'; // Your Supabase client
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { toast } from 'sonner'; // Assuming you use sonner for toasts
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { TRIAL_AI_CALL_LIMIT } from '@/config/constants';
import { isSubscriptionActive, isTrialValid } from '@/utils/subscription';

// Replace with your actual Price IDs from Stripe Dashboard
const MONTHLY_PRICE_ID = import.meta.env.VITE_STRIPE_MONTHLY_PRICE_ID || 'price_xxxxxxxxxxxxxx_monthly';
const ANNUAL_PRICE_ID = import.meta.env.VITE_STRIPE_ANNUAL_PRICE_ID || 'price_yyyyyyyyyyyyyy_annual';

export const SubscriptionManagement: React.FC = () => {
  const stripe = useStripe();
  const auth = useAuth();
  const { user, userProfile, loading: authLoading } = auth;
  const [isLoading, setIsLoading] = useState(false);
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [message, setMessage] = useState(''); // For general messages
  const [error, setError] = useState(''); // For error messages

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('session_id')) {
      setMessage('Subscription process initiated! Please wait while we update your status...');
      // Clear the session_id from URL to prevent re-triggering
      window.history.replaceState({}, document.title, window.location.pathname);
      // Poll or wait for webhook to update profile then refresh
      const timeoutId = setTimeout(() => {
        if (user?.id) {
          auth.fetchUserProfile(user.id).then(() => {
            setMessage('Subscription status updated! If you see old info, try refreshing the page.');
          });
        }
      }, 7000); // Wait a bit longer for webhooks and DB updates
      return () => clearTimeout(timeoutId);
    }
    if (query.get('subscription_canceled')) {
      setMessage('Your subscription has been canceled. We are sorry to see you go.');
      window.history.replaceState({}, document.title, window.location.pathname);
       if (auth.user?.id) {
          auth.fetchUserProfile(auth.user.id);
        }
    }
  }, [auth]);

  const handleStartTrial = async () => {
    if (!auth.user) {
      setError('You must be logged in to start a trial.');
      toast.error('Not Logged In', { description: 'Please log in to start a trial.' });
      return;
    }
    setIsStartingTrial(true);
    setError('');
    setMessage('');

    try {
      const { data, error: functionError } = await supabase.functions.invoke('start-user-trial', {
        body: { userId: auth.user.id },
      });

      if (functionError) {
        console.error('Supabase function error (start-user-trial):', functionError);
        throw new Error(functionError.message || 'Could not invoke start trial function.');
      }
      
      if (data.error) {
        console.error('Error from start-user-trial function:', data.error);
        throw new Error(data.error);
      }

      toast.success('Trial Started!', { description: 'Your 10-day free trial has begun.' });
      setMessage('Trial successfully started! Your profile is being updated.');
      
      // --- Debugging logs ---
      console.log('[Debug] In handleStartTrial, entire auth object:', auth);
      console.log('[Debug] In handleStartTrial, typeof auth.fetchUserProfile:', typeof auth.fetchUserProfile);
      console.log('[Debug] In handleStartTrial, value of auth.fetchUserProfile:', auth.fetchUserProfile);
      // --- End Debugging logs ---

      if (typeof auth.fetchUserProfile === 'function') {
        await auth.fetchUserProfile(auth.user.id); // Refresh user profile using auth.fetchUserProfile
      } else {
        console.error('Critical Error: auth.fetchUserProfile is not a function right before calling it. Profile cannot be refreshed automatically.', { fetchUserProfileValue: auth.fetchUserProfile });
        setError('Your trial has started, but we could not refresh your profile status automatically. Please refresh the page.');
        toast.error('Profile Refresh Failed', { description: 'Please refresh the page to see your updated trial status.' });
      }
    } catch (e: any) {
      console.error('Start trial error:', e);
      setError(`Error: ${e.message || 'Could not start trial.'}`);
      toast.error('Trial Error', { description: e.message || 'Could not start trial.'});
    } finally {
      setIsStartingTrial(false);
    }
  };

  const handleSubscribe = async (priceId: string) => {
    if (!stripe || !auth.user) {
      setError('Stripe.js has not loaded yet or you are not logged in.');
      return;
    }
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      // Call the Supabase Edge Function to create a checkout session
      const { data, error: functionError } = await supabase.functions.invoke('create-checkout-session', {
        body: { priceId, userId: auth.user.id },
      });

      if (functionError) {
        console.error('Supabase function error (create-checkout-session):', functionError);
        throw new Error(functionError.message || 'Could not invoke checkout session function.');
      }
      
      if (data.error) {
        console.error('Error from create-checkout-session function:', data.error);
        throw new Error(data.error);
      }

      const { sessionId } = data;
      if (!sessionId) {
        throw new Error('Failed to retrieve a session ID.');
      }

      const { error: stripeError } = await stripe.redirectToCheckout({ sessionId });

      if (stripeError) {
        console.error('Stripe redirect error:', stripeError);
        setError(`Stripe Error: ${stripeError.message}`);
      }
    } catch (e: any) {
      console.error('Subscription initiation error:', e);
      setError(`Error: ${e.message || 'Could not create checkout session.'}`);
      toast.error('Subscription Error', { description: e.message || 'Could not create checkout session.'});
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!userProfile?.stripe_customer_id) {
      setError('Stripe customer ID not found for your profile.');
      toast.error('Error', { description: 'Stripe customer ID not found.'});
      return;
    }
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      // Call the Supabase Edge Function to create a customer portal session
      const { data, error: functionError } = await supabase.functions.invoke('create-customer-portal-session', {
        body: { customerId: userProfile.stripe_customer_id },
      });

      if (functionError) {
        console.error('Supabase function error (create-customer-portal-session):', functionError);
        throw new Error(functionError.message || 'Could not invoke customer portal function.');
      }

      if (data.error) {
        console.error('Error from create-customer-portal-session function:', data.error);
        throw new Error(data.error);
      }
      
      if (!data.url) {
        throw new Error('Failed to retrieve customer portal URL.');
      }

      window.location.href = data.url;
    } catch (e: any) {
      console.error('Customer portal error:', e);
      setError(`Error: ${e.message || 'Could not redirect to customer portal.'}`);
      toast.error('Portal Error', { description: e.message || 'Could not redirect to customer portal.'});
      setIsLoading(false); // Only set loading false on error, successful redirect won't reach here
    }
    // No finally block for setIsLoading(false) here, as successful redirect navigates away.
  };

  if (authLoading && !userProfile) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading subscription information...</p>
      </div>
    );
  }

  const isActiveSub = isSubscriptionActive(userProfile);
  const isTrialing = userProfile?.subscription_status === 'trialing';
  const trialEndsAt = userProfile?.trial_ends_at ? new Date(userProfile.trial_ends_at) : null;
  const trialCallsUsed = userProfile?.trial_ai_calls_used || 0;
  const isTrialExpired = isTrialing && trialEndsAt && trialEndsAt.getTime() < Date.now();
  const trialCallLimitReached = trialCallsUsed >= TRIAL_AI_CALL_LIMIT;
  const isCurrentlyValidTrial = isTrialValid(userProfile);

  // Condition to show "Start Trial" button:
  // User exists, profile might or might not exist yet (or has no status)
  // OR they are not active, and not in a currently valid trial.
  const showStartTrialOption = user && (
    !userProfile || // Profile doesn't exist in DB / not loaded yet fully for status check
    userProfile.subscription_status === null ||
    userProfile.subscription_status === undefined ||
    (userProfile.subscription_status !== 'active' && !isCurrentlyValidTrial)
  );

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {message && (
        <Alert variant={error ? "destructive" : "default"} className="bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-300">
          <AlertTitle>{error ? 'Error' : 'Notification'}</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {error && !message && (
         <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Subscription Status</CardTitle>
          <CardDescription className="text-md">
            Current Status: <span className="font-semibold capitalize">{userProfile?.subscription_status || 'N/A'}</span>
            {isActiveSub && userProfile?.current_period_ends_at && (
              ` (Renews on: ${new Date(userProfile.current_period_ends_at).toLocaleDateString()})`
            )}
             {isTrialing && trialEndsAt && !isTrialExpired && (
              ` (Trial ends on: ${trialEndsAt.toLocaleDateString()})`
            )}
            {isTrialExpired && ` (Trial expired on: ${trialEndsAt?.toLocaleDateString()})`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isTrialExpired && (
            <Alert variant="destructive">
                <AlertTitle>Trial Expired</AlertTitle>
                <AlertDescription>Your free trial has ended. Please subscribe to continue using our services.</AlertDescription>
            </Alert>
          )}
          {isTrialing && trialCallLimitReached && !isTrialExpired && (
             <Alert variant="destructive">
                <AlertTitle>Trial AI Call Limit Reached</AlertTitle>
                <AlertDescription>You have used all your AI calls for the trial. Please subscribe to continue.</AlertDescription>
            </Alert>
          )}

          {/* New "Start Trial" Section - show if user has no active sub and no valid ongoing trial */}
          {showStartTrialOption && !isActiveSub && !isCurrentlyValidTrial && (
            <Card className="border-primary/50 bg-primary/5 dark:bg-primary/10">
              <CardHeader>
                <CardTitle className="text-lg text-primary">New to Paralegal AI or Need a Fresh Start?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Activate a 10-day free trial to explore all features, including {TRIAL_AI_CALL_LIMIT} AI-powered actions.
                </p>
                <Button onClick={handleStartTrial} disabled={isStartingTrial || isLoading} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
                  {isStartingTrial ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Start Your 10-Day Free Trial
                </Button>
              </CardContent>
            </Card>
          )}
          
          {!isActiveSub && (
            <div className="grid md:grid-cols-2 gap-6 pt-4"> {/* Added pt-4 for spacing if Start Trial is shown */}
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                    <CardTitle className="text-xl">Monthly Plan</CardTitle>
                    <CardDescription className="text-2xl font-bold">$34.99 <span className="text-sm font-normal text-muted-foreground">/ month</span></CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">Full access to all features, billed monthly.</p>
                  <Button onClick={() => handleSubscribe(MONTHLY_PRICE_ID)} disabled={isLoading || !auth.user} className="w-full">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isLoading ? 'Processing...' : (auth.user ? 'Subscribe Monthly' : 'Login to Subscribe')}
                  </Button>
                </CardContent>
              </Card>
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                    <CardTitle className="text-xl">Annual Plan</CardTitle>
                     <CardDescription className="text-2xl font-bold">$350.00 <span className="text-sm font-normal text-muted-foreground">/ year</span></CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-2">Save ~16% with annual billing. Full access to all features.</p>
                  <Button onClick={() => handleSubscribe(ANNUAL_PRICE_ID)} disabled={isLoading || !auth.user} className="w-full bg-primary hover:bg-primary/90">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isLoading ? 'Processing...' : (auth.user ? 'Subscribe Annually' : 'Login to Subscribe')}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {isActiveSub && (
            <div>
                <p className="text-muted-foreground mb-4">You have an active subscription. You can manage your subscription, update payment methods, or cancel through the Stripe customer portal.</p>
                <Button onClick={handleManageSubscription} disabled={isLoading} className="w-full md:w-auto">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isLoading ? 'Processing...' : 'Manage Subscription'}
                </Button>
            </div>
          )}
           {isTrialing && !isTrialExpired && userProfile && <p className="mt-6 text-sm text-center text-muted-foreground">You are currently on a trial. Choose a plan above to upgrade and continue service uninterrupted.</p>}
        </CardContent>
        {isActiveSub && userProfile?.stripe_price_id && (
            <CardFooter className="text-xs text-muted-foreground">
                <p>Plan ID: {userProfile.stripe_price_id}</p>
            </CardFooter>
        )}
      </Card>
    </div>
  );
}; 