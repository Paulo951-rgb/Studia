# Architecture

## Principes

1. **Local First.** Aucun serveur applicatif. Le téléphone parle directement à PRONOTE et,
   si l'utilisateur le décide, à `api.openai.com`.
2. **Séparation stricte** entre UI (`src/app`, `src/ui`), métier (`src/core`), persistance
   (`src/db`) et connecteurs (`src/providers`, `src/platform`).
3. **Aucune donnée fictive.** Les écrans lisent la base ; une absence de données est
   affichée comme telle.

## Couches

```
src/app/            écrans expo-router (chat, école, réglages, connexion)
src/ui/             composants, thème clair/sombre, formatage, markdown léger
src/state/          store Zustand : session, compte actif, envoi de message, sync
src/core/           logique pure, testable sans React Native
  domain/types.ts     modèle de données partagé
  pronote/            capacités, erreurs, mappers (payload PRONOTE -> domaine)
  sync/engine.ts      moteur de synchronisation (budget, reprise, rapports)
  ai/                 prompt système, schémas d'outils, exécuteur d'outils, SSE
  school/averages.ts  moyennes pondérées, simulation de note
  search/query.ts     construction des requêtes FTS5
  util/               identifiants stables, hachage, HTML
src/db/             schéma, migrations, dépôts (accounts, chat, school, search), drivers
src/providers/      PRONOTE (Pawnote) et OpenAI (Responses API)
src/platform/       SQLite chiffré, SecureStore, tâche de fond
tests/              unitaires (core) et intégration (SQLite en mémoire, FTS5 réel)
```

## Flux d'une synchronisation

```
UI (bouton / ouverture / tâche de fond)
  └─ syncAccount()                    src/providers/pronote/service.ts
       ├─ resumePronoteSessionOnce()  jeton en SecureStore -> session Pawnote
       └─ runSync()                   src/core/sync/engine.ts
            ├─ garde : budget de requêtes, signal d'annulation, erreurs typées
            ├─ source.fetchX()        adaptateur PRONOTE -> types du domaine
            ├─ repos.writer.saveX()   upsert par (account_id, native_id)
            ├─ repos.search.index()   alimente FTS5
            └─ repos.sync.*           sync_state, sync_history
```

Points clés :

- **Budget** : 120 requêtes pour une première importation, 30 ensuite ; le dépassement
  arrête la boucle au lieu de marteler le serveur de l'établissement.
- **Incrémental** : chaque ressource enregistre un curseur (`sync_state`) ; les notes,
  devoirs, absences et documents ne sont redemandés que sur la fenêtre utile.
- **Détection des modifications** : `content_hash` par ligne ; une ligne inchangée n'est
  pas réécrite (compteurs `inserted` / `updated` / `unchanged` / `removed`).
- **Doublons** : identifiants déterministes (`makeId('gra', accountId, nativeId)`) et index
  uniques `(account_id, native_id)`.
- **Reprise** : `sync_history` conserve un enregistrement `partial` tant que la
  synchronisation n'est pas terminée ; une annulation ou une coupure réseau laisse les
  données déjà écrites et le statut `aborted`.
- **Session expirée** : `mapPronoteError` marque le compte `expired`, l'UI propose de
  ressaisir les identifiants ; aucun écrasement des données existantes.

## Modèle de données (SQLite)

Tables principales et relations :

| Table | Rôle | Clés |
| --- | --- | --- |
| `accounts` | compte PRONOTE (URL, type, statut) | PK `id` |
| `sessions` | appareil PRONOTE + référence du jeton | FK `account_id` |
| `student_profile` | identité scolaire | FK `account_id` |
| `school_periods` | trimestres/semestres | FK `account_id` |
| `subjects` | matières (+ coefficient) | FK `account_id` |
| `grades` | notes, coefficients, appréciations | FK `period_id`, `subject_id` |
| `averages` | moyennes **publiées par PRONOTE** | FK `period_id`, `subject_id` |
| `report_cards` / `report_card_subjects` | bulletins | FK `period_id` |
| `evaluations` | évaluations par compétences | FK `period_id`, `subject_id` |
| `homework` | devoirs et cahier de textes | FK `subject_id` |
| `discussions` / `messages` / `attachments` | messagerie et pièces jointes | FK en cascade |
| `timetable` | emploi du temps (cours annulés inclus) | FK `account_id` |
| `events`, `school_news`, `absences`, `canteen_menus`, `documents` | vie scolaire | FK `account_id` |
| `conversations` / `chat_messages` | historique conversationnel | FK `conversation_id` |
| `ai_memories` | mémoire utilisateur / scolaire | FK `account_id`, unique `(account_id, scope, mem_key)` |
| `search_index` | index FTS5 (notes, messages, documents, actualités, chat, mémoire) | pas de FK, purgé explicitement |
| `sync_history` / `sync_state` | journal et curseurs | FK `account_id` |
| `settings` | préférences locales | clé/valeur |

Règles :

- dates stockées en ISO 8601 UTC ; les dates « jour » restent `YYYY-MM-DD` ;
- `content_hash` sur chaque table synchronisée ;
- suppression d'un compte : cascade SQL + purge explicite de `search_index` ;
- migrations numérotées, appliquées dans une transaction, jamais modifiées après
  livraison (`SCHEMA_VERSION` = nombre de migrations).

## Chiffrement

- La base est ouverte avec `PRAGMA key` après vérification de `PRAGMA cipher_version`.
  Sans SQLCipher, `EncryptionUnavailableError` est levée et l'application refuse de
  démarrer : jamais de repli en clair.
- La clé (32 octets hexadécimaux) est générée par `expo-crypto` et conservée dans
  SecureStore (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`).
- Les secrets (clé OpenAI, jeton PRONOTE, UUID d'appareil) ne touchent jamais SQLite.

## Erreurs et modes dégradés

`src/core/pronote/errors.ts` normalise les erreurs (identifiants, session expirée,
double authentification, réseau, quota, serveur indisponible, onglet non autorisé) et
indique si une réauthentification est nécessaire. Côté IA, les codes
`consent_required`, `missing_api_key`, `quota_exceeded`, `rate_limited`, `network_error`
sont affichés avec une action concrète. Hors ligne, chat et écrans École lisent la base.

## Décisions assumées

- **Pawnote plutôt que Papillon** : Papillon est une application complète (GPL-3.0) ;
  Pawnote en est la bibliothèque, plus facile à intégrer. `@blockshub/pawnote-lts` est un
  fork maintenu (GPL-3.0-or-later), sans dépendance à des modules Node natifs.
- **Pas de SQLCipher web** : la cible est Android/iOS. L'export web n'est pas supporté.
- **Pas d'extraction automatique de mémoire** : les fiches de mémoire sont saisies par
  l'utilisateur, jamais devinées par le modèle.
