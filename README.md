# Scolary

Application mobile (Android + iOS) qui réunit un assistant conversationnel et les données
scolaires PRONOTE. Tout s'exécute sur le téléphone : aucune infrastructure serveur à
maintenir, aucune base centrale, aucune télémétrie.

- **Assistant** : API OpenAI Responses, clé fournie par l'utilisateur, stockée dans le
  keychain/keystore, Function Calling vers 23 outils locaux, coût estimé sur l'appareil.
- **PRONOTE** : connecteur TypeScript (`@blockshub/pawnote-lts`, Pawnote 1.6.4) exécuté dans
  l'application, sans relais.
- **Base locale** : SQLite chiffrée (SQLCipher) + FTS5 pour la recherche, secrets dans
  SecureStore.
- **Hors ligne** : les données déjà synchronisées et l'historique des conversations restent
  consultables sans réseau.

## État réel du projet

Ce dépôt ne contient que ce qui est démontrable. Vérifié à ce jour :

| Élément | Statut |
| --- | --- |
| TypeScript strict (`tsc --noEmit` + config tests) | ✅ passe |
| 109 tests automatisés (`npm test`) | ✅ passent |
| Bundle Metro Android et iOS (`expo export -p android` / `-p ios`) | ✅ se construisent |
| Écran de chat, écrans École, réglages, connexion PRONOTE | ✅ implémentés |
| Verrouillage biométrique (`expo-local-authentication`) | ⚠️ code et bundle OK, à valider sur appareil |
| Connecteur PRONOTE contre un vrai établissement | ❌ **non testé** (aucun identifiant réel disponible) — test de contrat prêt : `npm run test:contract` |
| Appels OpenAI réels | ❌ **non testés** (aucune clé API disponible) |
| SQLCipher sur appareil | ❌ **non testé** (nécessite un development build) |
| Tests sur appareils physiques | ❌ **non réalisés** |

Les tests couvrent la logique pure et la base (moteur de synchronisation, calculs de
moyennes, outils IA, mapping PRONOTE, FTS5, migrations, cascades). Ils ne remplacent pas
un essai sur appareil ni une connexion réelle à PRONOTE.

## Démarrage

```bash
npm install
npm run verify        # typecheck strict + tests unitaires et d'intégration
npm start             # Expo dev client (nécessite un development build)
```

Le projet utilise `expo-dev-client` : Expo Go ne suffit pas, car SQLCipher, SecureStore
biométrique et les tâches de fond demandent du code natif.

```bash
npm run prebuild      # génère android/ et ios/ (expo prebuild)
npm run android       # compile et installe sur un appareil/émulateur
npm run ios           # idem sur iOS (macOS requis)
```

## Documentation

- [Architecture](docs/architecture.md) — couches, flux de données, moteur de synchronisation.
- [Connecteur PRONOTE](docs/pronote-connector.md) — audit des projets existants, capacités réelles, limites.
- [Outils IA](docs/ai-tools.md) — catalogue des outils, schémas, garde-fous.
- [Dépendances et licences](docs/dependencies.md).
- [Compilation et publication](docs/build-and-release.md).
- [Politique de confidentialité (brouillon à faire valider)](docs/privacy-policy.md).

## Fonctions scolaires

| Fonction | Nature | Où |
| --- | --- | --- |
| Notes, coefficients, moyennes PRONOTE | données telles que publiées | École › Notes |
| Moyenne pondérée locale | **calcul exact** (`coefficients` ou `points`), méthode affichée | École › Notes, outil `calculate_average` |
| Simulation de note | **estimation** explicitement étiquetée | outil `simulate_grade` |
| Progression, comparaison des périodes | graphiques sur données réelles (`react-native-svg`) | École › Notes |
| Bulletins et appréciations | données PRONOTE | École › Bulletins |
| Recherche des remarques des professeurs | FTS5 local | outil `search_teacher_feedback`, École › Recherche |
| Synthèse des messages | données PRONOTE + lecture IA | École › Messages, outils `search_messages` |
| Planification des devoirs, fiches, QCM, flashcards, bilan hebdo | **généré par l'IA** à partir des données locales | École › Révisions et bilans |
| Contrôles à venir | données PRONOTE (évaluations datées, cours « contrôle ») | outil `get_upcoming_tests` |
| Progression par matière entre périodes | **calcul exact** sur les moyennes stockées | outil `get_subject_progress` |
| Note nécessaire pour viser une moyenne | **calcul exact**, pas une prévision | outil `simulate_average_target` |
| Matières les plus fragiles | **calcul exact** (écart à la moyenne générale locale) | outil `get_weak_subjects` |
| Coût OpenAI estimé | barème local, indicatif, jamais envoyé | Réglages › Assistant |

## Ce que l'application ne fait pas

- Aucune connexion ENT/CAS : Pawnote ne l'expose pas (voir la matrice de capacités).
- Aucun contournement de CAPTCHA, de double authentification ou de restriction d'onglet.
- Aucune extraction du texte des PDF PRONOTE : le connecteur ne fournit que titre,
  description et lien.
- Aucune donnée inventée : un écran vide dit « aucune donnée synchronisée ».

## Licence

GPL-3.0-or-later. Le connecteur Pawnote est distribué sous GPL-3.0-or-later ; toute
application qui l'intègre doit respecter cette licence. Voir `LICENSE`.
