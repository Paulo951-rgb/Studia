import * as LocalAuthentication from 'expo-local-authentication';

export type LockAvailability = {
  /** The device has biometric or device-credential hardware. */
  hasHardware: boolean;
  /** The user has enrolled at least one biometric factor. */
  enrolled: boolean;
  /** Biometrics can be used right now (hardware + enrolment). */
  usable: boolean;
};

export type UnlockResult =
  | { ok: true }
  | { ok: false; code: 'cancelled' | 'failed' | 'unavailable'; message: string };

export async function lockAvailability(): Promise<LockAvailability> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = hasHardware ? await LocalAuthentication.isEnrolledAsync() : false;
  return { hasHardware, enrolled, usable: hasHardware && enrolled };
}

/**
 * Asks the system to authenticate the device owner.
 *
 * `disableDeviceFallback: false` keeps the PIN/pattern fallback: a fingerprint sensor
 * that fails should not lock the student out of their own school data. Nothing here
 * derives the database key from the biometric result; it only gates the UI.
 */
export async function unlockWithDevice(): Promise<UnlockResult> {
  const availability = await lockAvailability();
  if (!availability.usable) {
    return {
      ok: false,
      code: 'unavailable',
      message: 'Aucune biométrie configurée sur cet appareil.',
    };
  }

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Déverrouiller Studia',
      cancelLabel: 'Annuler',
      disableDeviceFallback: false,
    });
    if (result.success) return { ok: true };
    return {
      ok: false,
      code: result.error === 'user_cancel' || result.error === 'system_cancel' ? 'cancelled' : 'failed',
      message: result.error === 'user_cancel' ? 'Déverrouillage annulé.' : 'Déverrouillage refusé.',
    };
  } catch (error) {
    return {
      ok: false,
      code: 'failed',
      message: error instanceof Error ? error.message : 'Déverrouillage impossible.',
    };
  }
}
