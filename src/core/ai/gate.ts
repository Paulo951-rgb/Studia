export type AiGateError = 'consent_required' | 'missing_api_key';

/**
 * Decides whether a turn may leave the device. Kept pure so the rule is testable
 * without a keychain or a network stack.
 */
export function checkAiGate(input: { hasConsent: boolean; hasApiKey: boolean }): AiGateError | null {
  if (!input.hasConsent) return 'consent_required';
  if (!input.hasApiKey) return 'missing_api_key';
  return null;
}
