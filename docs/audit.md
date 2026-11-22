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

## 8. Audit du 2026-11-21 (mise en service du dépôt Studia)

### 8.1 Constat de départ

Le dépôt `Paulo951-rgb/Studia` ne contenait qu'un `README.md` de 8 octets. L'application
existait uniquement en local. Rien n'était donc téléchargeable, testable ni publiable.

### 8.2 Corrigé

| Problème | Correction | Preuve |
| --- | --- | --- |
| Dépôt vide, aucun code publié | fusion de l'historique local dans `main` (sans `--force`, sans réécriture) | 113 fichiers sur `main`, arbre distant vérifié |
| `app.json` invalide pour le SDK 58 : `android.edgeToEdgeEnabled` et `newArchEnabled` rejetés par le schéma | champs retirés (edge-to-edge et nouvelle architecture sont déjà par défaut) | `expo-doctor` : 20/20 |
| Nom du produit incohérent avec le dépôt (Scolary / Studia) | renommage complet avant toute publication : nom affiché, slug, schéma d'URL, `app.studia.mobile`, clés SecureStore, fichier de base, tâche de fond | `npm run verify` et `expo export` après renommage |
| Message de l'utilisateur perdu si le consentement ou la clé API manque | la question est enregistrée avant le contrôle | `src/providers/ai/service.ts`, règle testée dans `tests/unit/gate.test.ts` |
| Interface figée sur « Réflexion… » si le fournisseur lève une exception | `try/catch` autour du tour de chat, état `streaming` toujours réinitialisé | `src/state/appStore.ts` |
| Bouton d'actualisation bloqué si la synchronisation lève | `try/catch` dans `syncNow` | `src/state/appStore.ts` |
| Bouton « ＋ » de pièce jointe qui n'ouvrait qu'un message « non implémenté » | bouton supprimé : aucune fonction factice | `src/app/(tabs)/index.tsx` |
| Documentation affirmant des graphiques `react-native-svg` alors que la progression est dessinée en `View` | docs corrigées | `README.md`, `docs/dependencies.md` |
| Aucune intégration continue | workflow GitHub Actions : types, tests, bundles Android et iOS | `.github/workflows/ci.yml` |
| Aucune méthode de test simple sous Windows | profils EAS, quatre scripts `.bat`, guide détaillé | `eas.json`, `*.bat`, `docs/GUIDE_INSTALLATION_WINDOWS.md` |

### 8.3 Constats laissés ouverts (assumés)

| Constat | Raison | Suite proposée |
| --- | --- | --- |
| 10 dépendances installées mais inutilisées (`react-native-svg`, `expo-print`, `expo-sharing`, `expo-document-picker`, `expo-file-system`, `expo-haptics`, `expo-network`, `expo-constants`, `expo-system-ui`, `react-native-web`) | les retirer modifie la compilation native, qui n'a pas pu être testée ici | retirer une par une, avec un build de contrôle après chaque retrait |
| `expo export --platform web` échoue | SQLCipher et le worker wasm de `expo-sqlite` sont incompatibles avec un navigateur | hors périmètre : la cible est mobile |
| Aucune pièce jointe dans le chat | l'API Responses accepte des fichiers, mais l'implémentation demande un sélecteur natif et ne peut pas être vérifiée ici | implémenter avec `expo-document-picker` puis tester sur appareil |
| Aucune notification | les notifications push exigent un serveur ; seules des notifications locales seraient possibles | notifications locales planifiées pour les contrôles à venir |
| Messages du chat rendus dans une `ScrollView` | correct jusqu'à quelques centaines de messages | passer à `FlatList` inversée au-delà |
| Aucun test sur appareil, aucun appel réel PRONOTE/OpenAI | environnement sans appareil, sans identifiant, sans clé | exécuter `docs/GUIDE_TESTS.md` §2 sur un téléphone |

### 8.4 Vérifications réellement exécutées

| Vérification | Résultat |
| --- | --- |
| `npm run verify` (typecheck app + tests, 113 tests) | ✅ 113 / 113 |
| `expo-doctor` (20 contrôles) | ✅ 20 / 20 |
| `npx expo export -p android` | ✅ bundle produit |
| `npx expo export -p ios` | ✅ bundle produit |
| `npx expo start --dev-client` (démarrage de Metro) | ✅ `packager-status:running` |
| Compilation native, installation sur appareil, PRONOTE réel, OpenAI réel | ❌ non réalisables dans cet environnement |


## 9. Corrections complémentaires — 22 novembre 2026

Les corrections suivantes ont été poussées sur `main` après une nouvelle lecture ciblée du code. Elles ne remplacent pas les tests natifs ni les tests avec un établissement réel.

| Zone | Modification |
| --- | --- |
| OpenAI Responses avec `store:false` | L'historique de chaque tour retransmet désormais les éléments assistant `function_call` avant les résultats `function_call_output`. Le sérialiseur conserve les deux types. |
| Injection via données PRONOTE | `fenceUntrusted` neutralise maintenant les marqueurs de début/fin présents dans le texte externe avant de l'encadrer. |
| Messages PRONOTE | Un échec sur un fil de discussion n'est plus écrasé par un statut global « ok ». |
| Réseau PRONOTE | Un délai maximal de 25 secondes est appliqué à chaque requête du fetcher. |
| Tâche de fond | Le module déclarant la tâche Expo est importé depuis le layout racine au démarrage. |
| Windows | Le script d'installation exige Node 22.5+ (requis par `node:sqlite`). |
| Scripts APK | Les instructions distinguent le profil EAS `preview` (autonome) du profil `development` (nécessite Metro). |
| Prévisualisation PC | Ajout de `pc-preview/index.html` et `DEMARRER-STUDIA-PC.bat` : démo locale, interactive et sans installation, avec données fictives. |
| Documentation | Correction des mentions erronées de dépôt privé et d'absence de `eas.json`, ajout du parcours PC Preview. |

### Limites et vérifications encore nécessaires

- La démo PC est une **maquette interactive** : elle ne lance pas le code React Native réel, ne teste pas SQLCipher, ne contacte pas PRONOTE et n'appelle pas OpenAI.
- Le nom d'utilisateur PRONOTE n'est pas encore persisté comme champ indépendant dans le modèle de compte ; le mécanisme de reprise de session doit être confirmé avec le contrat Pawnote et un vrai compte avant toute migration de schéma.
- La synchronisation des notes, bulletins et évaluations reste limitée au périmètre de période implémenté ; il faut confirmer le comportement multi-période sur plusieurs comptes PRONOTE.
- Le traitement des parcours de double authentification PRONOTE dépend des capacités réelles exposées par Pawnote et n'est pas validé contre un établissement.
- Le délai réseau est appliqué au fetcher, mais les retries doivent rester prudents et ne sont pas ajoutés automatiquement.
- La limite de 25 discussions par synchronisation reste en place pour maîtriser le nombre de requêtes.
- Aucun résultat CI vert ne doit être annoncé tant que le workflow correspondant au dernier commit n'est pas terminé avec succès. Aucun test sur appareil physique ni authentification PRONOTE/OpenAI réelle n'a été exécuté dans cet audit.
