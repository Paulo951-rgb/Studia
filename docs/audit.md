# Audit technique — 21 novembre 2026

Audit réalisé sur l'état du dépôt au commit `56a8f70`. Chaque constat renvoie au code réel.
Les vérifications exécutées sont indiquées ; rien n'est déclaré testé sans commande correspondante.

## 1. Ce qui a été vérifié, et comment

| Vérification | Commande | Résultat |
| --- | --- | --- |
| Typage strict | `npx tsc --noEmit` | OK |
| Suite de tests | `npm test` | 86 tests, 86 OK |
| Bundle Android | `npx expo export -p android` | OK (1292 modules) |
| Bundle iOS | `npx expo export -p ios` | OK (1297 modules) |
| Connexion PRONOTE réelle | — | **non exécutée** (aucun identifiant) |
| Appel OpenAI réel | — | **non exécuté** (aucune clé) |
| SQLCipher sur appareil | — | **non exécuté** (pas de build natif) |

## 2. Constats P0 — bugs et risques avérés

### P0-1. Le repli non-streaming du client OpenAI ne peut pas fonctionner
`src/providers/ai/openai.ts:261`. La requête est envoyée avec `stream: true`. Si le `fetch`
n'expose pas de corps lisible (`response.body` sans `getReader`), le code appelle
`response.json()` sur un flux SSE : l'analyse échoue systématiquement et l'utilisateur voit
« Réponse illisible ». Le repli doit **renvoyer la requête avec `stream: false`**.
Impact : sur toute implémentation `fetch` sans streaming (cas possible hors `expo/fetch`),
l'assistant est inutilisable.

### P0-2. Les fragments d'arguments de fonction sont indexés sur deux clés différentes
`openai.ts:98` enregistre l'appel sous `item.call_id`, alors que `openai.ts:107` cherche les
deltas sous `item_id`. Les fragments créent une entrée orpheline (nom vide) et les arguments
ne sont corrects que parce que `response.output_item.done` réécrit l'entrée finale. Un flux
interrompu entre `added` et `done` produit un appel d'outil aux arguments vides.
Impact : appels d'outils perdus en cas de coupure réseau, donc réponses incomplètes.

### P0-3. Le quota OpenAI est signalé comme une simple limitation de débit
`openai.ts:46`. Un HTTP 429 avec `error.code = "insufficient_quota"` est mappé sur
`rate_limited` (« réessayez dans un instant »), alors qu'il s'agit d'un quota épuisé : le
message affiché est faux et l'utilisateur réessaie en boucle.

### P0-4. Aucun délai maximal sur les appels OpenAI
`openai.ts:210-225`. Sans `signal` fourni par l'appelant, une requête bloquée reste ouverte
indéfiniment. Le bouton « Arrêter » est la seule sortie. Un délai (120 s par défaut) est
nécessaire, combiné au signal d'annulation.

### P0-5. La limite de tours d'outils rend une réponse vide sans explication
`src/core/ai/provider.ts:160`. Quand `maxToolRounds` est atteint, la fonction renvoie
`errorCode: null` avec le texte partiel : l'UI affiche un message vide sans erreur.
Il faut un code d'erreur dédié (`tool_round_limit`) et un libellé explicite.

### P0-6. La troncature des sorties d'outils produit du JSON invalide
`src/core/ai/toolRunner.ts:651`. `serialized.slice(...)` coupe la chaîne JSON au milieu. Le
modèle reçoit alors un objet illisible. Il faut un enveloppement valide
(`{"truncated":true,"preview":"..."}`).

### P0-7. L'écran « Révisions et bilans » n'est pas déclaré dans la pile de navigation
`src/app/_layout.tsx:73-88` ne contient pas `school/revision`. La route existe mais s'ouvre
avec un en-tête générique (`school/revision`) en plus du titre interne, et sans titre traduit.

### P0-8. Les devoirs ne peuvent pas être marqués comme faits
`src/db/repositories/schoolWrite.ts:691` expose `setHomeworkDone`, mais
`src/app/school/homework.tsx` n'appelle jamais cette méthode : aucune action dans l'écran.
La fonctionnalité est annoncée (et le schéma la stocke) sans interface.

### P0-9. Le verrouillage biométrique est déclaré mais absent
`src/platform/secureStore.ts:67-74` définit `setAppLock` / `isAppLockEnabled`, jamais
appelés. `app.json` déclare `NSFaceIDUsageDescription` et `USE_BIOMETRIC`, et
`docs/privacy-policy.md` mentionne le verrouillage. Aucun écran de verrouillage n'existe :
la promesse est fausse en l'état.

### P0-10. `maybeSyncOnOpen` n'est pas protégé
`src/state/appStore.ts:237-255`. Si `syncAccount` ou `accounts.list()` lève, la promesse
rejetée n'est pas gérée et `syncRunning` peut rester bloqué à `true`, ce qui désactive le
bouton d'actualisation jusqu'au redémarrage.

## 3. Constats P1 — qualité, performance, fonctionnalités manquantes

### P1-1. Synchronisation non incrémentale sur les messages
`src/core/sync/engine.ts:305`. Chaque synchronisation récupère les messages des 25 premières
discussions, soit jusqu'à 26 requêtes, même si rien n'a changé. Les compteurs
(`messageCount`, `unreadCount`, `lastMessageAt`) déjà stockés permettent de ne récupérer que
les discussions modifiées.

### P1-2. Pas de reprise ciblée des ressources en échec
`engine.ts:118` lance toujours toutes les ressources. Le schéma `sync_state` et l'historique
existent, mais l'utilisateur ne peut pas relancer uniquement ce qui a échoué (budget épuisé,
erreur réseau partielle).

### P1-3. Recalcul des moyennes en N+1 requêtes
`engine.ts:461`. Pour chaque période × matière, une requête `listGrades` est exécutée
(3 périodes × 15 matières = 45 requêtes SQL par synchronisation). Une requête par période
suffit.

### P1-4. Aucun suivi de consommation IA
`src/core/ai/provider.ts:108` jette l'`usage` renvoyé par l'API. L'utilisateur ne peut pas
savoir combien de tokens il consomme ni estimer son coût, alors que la clé est la sienne.

### P1-5. Outils IA manquants pour les questions fréquentes
Les 19 outils couvrent les données brutes, mais pas : contrôles à venir, progression par
matière, matières les plus fragiles, note nécessaire pour atteindre un objectif.

### P1-6. Table `sync_history` : pas de purge
L'historique de synchronisation grossit sans limite. Une purge (200 entrées par compte)
évite la dérive de la base sur plusieurs années.

### P1-7. Index manquants
`canteen_menus` (recherche par date), `documents` (tri par date), `messages` (recherche par
date), `ai_memories` (compte). Impact mesurable seulement sur de gros volumes, mais les
requêtes existent déjà dans `schoolRead.ts`.

## 4. Constats P2 — améliorations ultérieures

- Tableau de bord dédié (moyenne générale, prochains devoirs, prochains contrôles) : l'écran
  École agrège déjà des compteurs, mais pas une vue « aujourd'hui ».
- Extraction de texte PDF : Pawnote ne fournit que titre/lien. Nécessiterait un décodeur PDF
  local (`pdfjs` n'est pas compatible RN sans adaptation) — hors périmètre sans preuve.
- ENT/CAS : non implémenté par Pawnote ; nécessiterait un flux OAuth par établissement.
- OCR local : dépendance lourde (`mlkit`) non évaluée ; à traiter séparément.
- Notifications push : impossibles sans serveur, sauf notifications locales planifiées.

## 5. Sécurité — points vérifiés et points à surveiller

Vérifiés dans le code :
- clé OpenAI et jetons PRONOTE uniquement dans `expo-secure-store` (`platform/secureStore.ts`) ;
- refus de démarrer sans chiffrement (`db/expoDriver.ts`, `EncryptionUnavailableError`) ;
- `store: false` systématique (`openai.ts:74`) ;
- consentement vérifié dans le service, pas dans l'UI (`providers/ai/service.ts:112`) ;
- contenus PRONOTE encadrés (`core/ai/toolRunner.ts:16`) et consigne système explicite ;
- HTTPS imposé pour l'établissement (`core/util/ids.ts:30`) ;
- aucune télémétrie, aucun réseau hors PRONOTE/OpenAI (`grep -r "fetch(" src`).

À surveiller :
- les messages d'erreur SQL remontent tels quels dans les sorties d'outils
  (`toolRunner.ts:659`) : pas de secret, mais à tronquer ;
- pas de limite de taille sur les réponses stockées (`chat_messages.content_text`) ;
- la purge complète doit aussi vider le cache d'images/pièces jointes (aucun cache
  persistant aujourd'hui, donc rien à faire).

## 6. Conclusion

L'ossature est saine : séparation `core` / `db` / `providers` / `app`, typage strict, tests
réels sur base SQLite en mémoire avec FTS5. Les défauts sont concentrés dans trois zones :
le client OpenAI (P0-1 à P0-6), quelques écrans incomplets (P0-7, P0-8), une promesse de
sécurité non tenue (P0-9) et la synchronisation (P1-1 à P1-3).

Le plan de traitement suit cet ordre : P0 d'abord, puis P1 mesurables, chaque lot livré avec
ses tests.

## 7. Traitement des constats (état au 2026-11-21)

Chaque lot a été livré avec ses tests ; `npm test` compte 109 tests, `tsc --noEmit` est
propre et les bundles Metro Android et iOS se construisent.

| Constat | Traitement | Vérification |
| --- | --- | --- |
| Fragments d'appels d'outils perdus si le flux est interrompu | clés par identifiant d'item | `tests/unit/openai-resilience.test.ts` |
| Flux refusé par le réseau → requête sans réponse | rejeu en JSON non streamé | idem |
| `insufficient_quota` classé en limite de débit | code `quota_exceeded` distinct | idem |
| Aucun délai maximal sur les appels OpenAI | 120 s combinés au signal de l'appelant | idem |
| Sortie d'outil tronquée au milieu d'une chaîne → JSON invalide | enveloppe JSON `truncated/preview` | `tests/integration/toolRunner.test.ts` |
| Coût et consommation invisibles | table `ai_usage`, barème local, carte de réglages | migration v2, `src/core/ai/cost.ts` |
| Écran `school/revision` non déclaré | enregistré dans la pile | `src/app/_layout.tsx` |
| Devoirs impossibles à cocher localement, coche perdue à la synchro | coche locale + préservation | `schoolWrite.ts` |
| Échec de synchro automatique bloquant le bouton d'actualisation | état toujours réinitialisé | `appStore.ts` |
| Verrouillage biométrique annoncé mais absent | verrou réel au démarrage et au retour au premier plan | `platform/appLock.ts`, `_layout.tsx` |
| Sync complète pour réessayer une seule ressource | option `only` + bouton « Réessayer » | `tests/integration/sync.test.ts` |
| Un appel `fetchMessages` par conversation à chaque synchro | uniquement si les compteurs ont bougé | idem |
| Recalcul des moyennes en N+1 | une requête par période | idem |

Restent ouverts, sans solution honnête à ce jour :

- vérification contre un établissement PRONOTE réel (identifiants indisponibles) ;
- SQLCipher et biométrie sur appareil physique (development build requis) ;
- notifications : seules des notifications locales planifiées sont possibles sans serveur.
