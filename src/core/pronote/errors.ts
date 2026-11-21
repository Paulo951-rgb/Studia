export type PronoteErrorCode =
  | 'invalid_credentials'
  | 'session_expired'
  | 'double_auth_required'
  | 'ip_suspended'
  | 'rate_limited'
  | 'unreachable'
  | 'server_busy'
  | 'page_unavailable'
  | 'account_disabled'
  | 'access_denied'
  | 'authentication_failed'
  | 'server_error'
  | 'not_authorized_tab'
  | 'network_error'
  | 'unknown';

export type MappedPronoteError = {
  code: PronoteErrorCode;
  message: string;
  retryable: boolean;
  /** When true the stored session must be dropped and the user must reconnect. */
  requiresReauth: boolean;
};

/**
 * Maps errors thrown by the PRONOTE connector to stable codes.
 *
 * Pawnote exposes dedicated error classes (BadCredentialsError, SessionExpiredError,
 * SecurityError, SuspendedIPError, RateLimitedError, UnreachableError, BusyPageError,
 * PageUnavailableError, AccountDisabledError, AccessDeniedError, AuthenticateError,
 * ServerSideError). We match on the class name rather than importing them so the sync
 * engine stays free of connector dependencies and remains testable.
 */
export function mapPronoteError(error: unknown): MappedPronoteError {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : 'Erreur inconnue';

  switch (name) {
    case 'BadCredentialsError':
      return { code: 'invalid_credentials', message: "Identifiants PRONOTE refusés.", retryable: false, requiresReauth: true };
    case 'SessionExpiredError':
      return { code: 'session_expired', message: 'La session PRONOTE a expiré.', retryable: true, requiresReauth: true };
    case 'SecurityError':
      return {
        code: 'double_auth_required',
        message: "PRONOTE demande une validation supplémentaire (double authentification).",
        retryable: false,
        requiresReauth: false,
      };
    case 'SuspendedIPError':
      return {
        code: 'ip_suspended',
        message: 'PRONOTE a temporairement suspendu les connexions depuis ce réseau. Réessayez plus tard.',
        retryable: true,
        requiresReauth: false,
      };
    case 'RateLimitedError':
      return { code: 'rate_limited', message: 'PRONOTE limite les requêtes. Synchronisation reportée.', retryable: true, requiresReauth: false };
    case 'UnreachableError':
      return { code: 'unreachable', message: "Établissement injoignable. Vérifiez la connexion.", retryable: true, requiresReauth: false };
    case 'BusyPageError':
      return { code: 'server_busy', message: 'Le serveur PRONOTE est occupé.', retryable: true, requiresReauth: false };
    case 'PageUnavailableError':
      return { code: 'page_unavailable', message: "Cette page PRONOTE n'est pas disponible pour ce compte.", retryable: false, requiresReauth: false };
    case 'AccountDisabledError':
      return { code: 'account_disabled', message: 'Compte désactivé par l’établissement.', retryable: false, requiresReauth: true };
    case 'AccessDeniedError':
      return { code: 'access_denied', message: 'Accès refusé par PRONOTE.', retryable: false, requiresReauth: true };
    case 'AuthenticateError':
      return { code: 'authentication_failed', message: "L'authentification PRONOTE a échoué.", retryable: false, requiresReauth: true };
    case 'ServerSideError':
      return { code: 'server_error', message: 'Erreur côté serveur PRONOTE.', retryable: true, requiresReauth: false };
    default:
      if (/network|fetch|timeout|abort/i.test(message)) {
        return { code: 'network_error', message: 'Réseau indisponible.', retryable: true, requiresReauth: false };
      }
      return { code: 'unknown', message, retryable: false, requiresReauth: false };
  }
}

export const PRONOTE_ERROR_LABELS: Record<PronoteErrorCode, string> = {
  invalid_credentials: 'Identifiants refusés',
  session_expired: 'Session expirée',
  double_auth_required: 'Double authentification requise',
  ip_suspended: 'Connexions suspendues',
  rate_limited: 'Trop de requêtes',
  unreachable: 'Établissement injoignable',
  server_busy: 'Serveur occupé',
  page_unavailable: 'Page indisponible',
  account_disabled: 'Compte désactivé',
  access_denied: 'Accès refusé',
  authentication_failed: 'Authentification échouée',
  server_error: 'Erreur serveur',
  not_authorized_tab: 'Onglet non autorisé',
  network_error: 'Réseau indisponible',
  unknown: 'Erreur inconnue',
};
