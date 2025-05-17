import { describe, expect, test } from 'vitest';
import { isSubscriptionActive, isTrialValid } from './subscription';
import { TRIAL_AI_CALL_LIMIT } from '@/config/constants';
import { UserProfile } from '@/context/AuthContext';

const baseProfile: UserProfile = {
  id: 'user1',
  email: 'test@example.com',
  subscription_status: 'trialing',
  trial_started_at: new Date().toISOString(),
  trial_ends_at: new Date(Date.now() + 86400000).toISOString(),
  trial_ai_calls_used: 0,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  stripe_price_id: null,
  current_period_ends_at: null,
};

describe('subscription utils', () => {
  test('isSubscriptionActive returns true when status is active', () => {
    const profile = { ...baseProfile, subscription_status: 'active' };
    expect(isSubscriptionActive(profile)).toBe(true);
  });

  test('isSubscriptionActive returns false otherwise', () => {
    const profile = { ...baseProfile, subscription_status: 'canceled' };
    expect(isSubscriptionActive(profile)).toBe(false);
  });

  test('isTrialValid true when within period and calls below limit', () => {
    expect(isTrialValid(baseProfile)).toBe(true);
  });

  test('isTrialValid false when trial expired', () => {
    const expired = { ...baseProfile, trial_ends_at: new Date(Date.now() - 1000).toISOString() };
    expect(isTrialValid(expired)).toBe(false);
  });

  test('isTrialValid false when call limit reached', () => {
    const overLimit = { ...baseProfile, trial_ai_calls_used: TRIAL_AI_CALL_LIMIT };
    expect(isTrialValid(overLimit)).toBe(false);
  });
});
