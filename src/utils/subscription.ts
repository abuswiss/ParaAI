import { UserProfile } from '@/context/AuthContext';
import { TRIAL_AI_CALL_LIMIT } from '@/config/constants';

/**
 * Determine if the user's subscription is active.
 */
export function isSubscriptionActive(profile: UserProfile | null | undefined): boolean {
  return !!profile && profile.subscription_status === 'active';
}

/**
 * Determine if the user is currently in a valid trial period.
 * A trial is valid if:
 *  - subscription_status is 'trialing'
 *  - trial_ends_at exists and is in the future
 *  - trial_ai_calls_used is below the TRIAL_AI_CALL_LIMIT
 */
export function isTrialValid(profile: UserProfile | null | undefined): boolean {
  if (!profile || profile.subscription_status !== 'trialing') return false;
  const end = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  if (!end) return false;
  const callsUsed = profile.trial_ai_calls_used ?? 0;
  return end.getTime() > Date.now() && callsUsed < TRIAL_AI_CALL_LIMIT;
}
