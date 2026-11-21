# AGENTS.md

Mémoire du dépôt pour les sessions futures.

## Projet

Scolary : application Expo/React Native (SDK 58, RN 0.88, React 19) qui combine un
assistant OpenAI et un connecteur PRONOTE (`@blockshub/pawnote-lts`). Local First,
aucun backend. Licence GPL-3.0-or-later (imposée par Pawnote).

## Commandes

```bash
npm run verify        # typecheck (app + tests) puis tous les tests
npm run typecheck     # tsc --noEmit && tsc -p tsconfig.test.json
npm test              # node --import tsx --test tests/unit/*.test.ts tests/integration/*.test.ts
npm run test:unit
npm run test:integration
npx expo export -p android --output-dir /tmp/x   # valide le bundle Metro (rapide, hors appareil)
```

Les tests utilisent `node:test`, `tsx` et `node:sqlite` (FTS5 disponible). Aucun mock de
SQLite : les dépôts tournent sur une vraie base en mémoire.

## Conventions

- TypeScript strict (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`), alias `@/*` -> `src/*`.
- `src/core` ne doit jamais importer `react-native` ni `expo-*` (testable sous Node).
- Toute donnée PRONOTE passe par `src/core/pronote/mappers.ts` puis par les dépôts.
- Tout texte venant de PRONOTE affiché au modèle doit être encadré par `fenceUntrusted()`.
- Aucun secret dans SQLite ni dans les logs ; SecureStore uniquement.
- Pas de bouton factice : si une capacité manque, l'UI doit l'expliquer.

## Pièges connus

- `expo-sqlite` sans SQLCipher : `openExpoDatabase` lève `EncryptionUnavailableError`
  (voulu : pas de repli en clair). L'export web échoue à cause du worker wasm de
  `expo-sqlite` — la cible est Android/iOS, ne pas chercher à le corriger.
- `tsconfig.json` exclut `tests/` (types Node absents) ; les tests sont typés par
  `tsconfig.test.json` (`types: ["node"]`, `moduleResolution: node10`).
- Le budget de requêtes du moteur de sync est un arrêt définitif : ne pas réinitialiser
  `aborted` ni réenregistrer une ressource après `request_budget_exceeded`.
- `search_index` n'a pas de clé étrangère : le purger explicitement lors d'une suppression
  de compte (`repos.accounts.remove`).
- L'index chat doit être associé à `account_id` de la conversation, sinon la recherche
  filtrée par compte ne trouve rien.
- `runSync({ only })` ajoute toujours `profile` et `periods` : les autres ressources
  résolvent leur périmètre à travers elles. Ne pas retirer cette inclusion.
- Les messages ne sont retéléchargés que si `messageCount`, `unreadCount` ou
  `lastMessageAt` d'une discussion ont changé ; une discussion absente du cache est
  toujours récupérée.
- Le verrou (`platform/appLock.ts`) est un verrou d'affichage : il ne rechiffre rien. Le
  réglage refuse de s'activer si la biométrie n'est pas configurée, pour ne pas enfermer
  l'utilisateur dehors.
- Les outils dérivés (`get_upcoming_tests`, `get_subject_progress`,
  `simulate_average_target`, `get_weak_subjects`) vivent dans `core/school/insights.ts` et
  doivent rester purs, donc testables sous Node.

## État

- 109 tests passent, typecheck strict OK, bundles Android et iOS OK.
- Non testé faute de moyens : connexion PRONOTE réelle, appels OpenAI réels, SQLCipher,
  verrou biométrique et tâche de fond sur appareil. Voir `docs/build-and-release.md` §7.
- Constats de l'audit et leur traitement : `docs/audit.md` §7.
