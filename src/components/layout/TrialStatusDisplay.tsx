import React from 'react';
import { useAuth } from '@/hooks/useAuth'; // Assuming useAuth hook is in @/hooks/useAuth
import { Button } from '@/components/ui/Button'; // Assuming Button component is in @/components/ui/Button
import { useNavigate } from 'react-router-dom';
import { TRIAL_AI_CALL_LIMIT } from '@/config/constants';
import { isTrialValid } from '@/utils/subscription';

export const TrialStatusDisplay: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const trialValid = isTrialValid(userProfile);
  if (!userProfile || userProfile.subscription_status !== 'trialing') {
    return null;
  }

  const trialEndsAt = userProfile.trial_ends_at ? new Date(userProfile.trial_ends_at) : null;
  const now = new Date();
  let daysLeft = 0;

  if (trialEndsAt) {
    const diffTime = trialEndsAt.getTime() - now.getTime();
    if (diffTime > 0) {
      daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
  }
  
  daysLeft = Math.max(0, daysLeft); // Ensure it's not negative

  const callsUsed = userProfile.trial_ai_calls_used || 0;
  const callsRemaining = Math.max(0, TRIAL_AI_CALL_LIMIT - callsUsed); // Ensure not negative

  if (!trialValid) {
    return (
      <div className="text-sm text-yellow-700 dark:text-yellow-300 p-3 bg-yellow-100 dark:bg-yellow-800 border border-yellow-300 dark:border-yellow-600 rounded-md shadow-sm flex items-center justify-between">
        <span>Your trial has ended.</span>
        <Button variant="outline" size="sm" onClick={() => navigate('/settings/subscription')}>
          Subscribe Now
        </Button>
      </div>
    );
  }

  return (
    <div className="text-sm text-blue-700 dark:text-blue-300 p-3 bg-blue-100 dark:bg-blue-800 border border-blue-300 dark:border-blue-600 rounded-md shadow-sm flex items-center justify-between">
      <span>
        Trial: <strong>{daysLeft} days left</strong> | <strong>{callsRemaining}/{TRIAL_AI_CALL_LIMIT}</strong> AI calls remaining.
      </span>
      <Button variant="outline" size="sm" onClick={() => navigate('/settings/subscription')}>
        Upgrade Plan
      </Button>
    </div>
  );
}; 