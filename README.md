# Studia

Application mobile Android et iOS qui réunit un assistant conversationnel et vos données
scolaires PRONOTE. Tout s'exécute sur le téléphone : aucun serveur à maintenir, aucune base
centrale, aucune télémétrie.

- **Assistant** : API OpenAI Responses avec votre propre clé, stockée dans le coffre du
  système, 23 outils locaux appelés par le modèle (Function Calling).
- **PRONOTE** : connecteur TypeScript (`@blockshub/pawnote-lts`) exécuté dans
  l'application, sans relais intermédiaire.
- **Base locale** : SQLite chiffrée (SQLCipher) et recherche plein texte (FTS5).
- **Hors ligne** : les données déjà synchronisées et l'historique des conversations
  restent consultables sans réseau.

## Vous débutez ? Commencez ici

👉 **[Installer et tester sur Windows](docs/GUIDE_INSTALLATION_WINDOWS.md)** — guide pas à
pas, de l'installation de Node.js jusqu'à l'APK sur votre téléphone.

👉 **[Tester les fonctionnalités](docs/GUIDE_TESTS.md)** — 30 vérifications avec le
résultat attendu pour chacune.

## Démarrage rapide

```bash
npm install
npm run verify     # types + 113 tests, sans téléphone
```

Puis, sur Windows, quatre scripts à double-cliquer :

| Script | Rôle |
| --- | --- |
| `INSTALLER-STUDIA.bat` | Vérifie Node.js et installe les dépendances. |
| `TESTER-STUDIA.bat` | Vérifie les types et lance les 113 tests. |
| `CONSTRUIRE-APK.bat` | Fabrique un APK installable via Expo EAS (compte Expo gratuit requis). |
| `LANCER-STUDIA.bat` | Démarre Metro pour recharger l'application à chaud (build `development`). |

## Pourquoi pas de version web

Studia repose sur SQLCipher, un chiffrement natif qui n'existe pas dans un navigateur.
L'application refuse explicitement de démarrer sans chiffrement plutôt que d'écrire vos
notes en clair. `expo start --web` ne fonctionne donc pas, et ce n'est pas un bug à
corriger : la cible est Android et iOS.

## État réel du projet

Ce dépôt ne contient que ce qui est démontrable. Vérifié à ce jour :

| Élément | Statut |
| --- | --- |
| TypeScript strict (`npm run typecheck`) | ✅ passe |
| 113 tests automatisés (`npm test`) | ✅ passent |
| `expo-doctor` (20 contrôles) | ✅ 20/20 |
| Bundles Metro Android et iOS (`expo export`) | ✅ se construisent |
| Intégration continue GitHub Actions | ✅ configurée (types, tests, deux bundles) |
| Écrans chat, École, Réglages, connexion PRONOTE | ✅ implémentés |
| Compilation EAS (APK) | ⏳ jamais exécutée ici — aucune compilation native possible dans cet environnement |
| Connecteur PRONOTE face à un vrai établissement | ⏳ non testé — aucun identifiant réel disponible |
| Appels OpenAI réels | ⏳ non testés — aucune clé API disponible |
| SQLCipher, biométrie, caméra, tâche de fond sur appareil | ⏳ non testés — aucun appareil disponible |

Détail complet, fonctionnalité par fonctionnalité : `docs/COMPATIBILITE_ANDROID_IOS.md`.

## Fonctions scolaires

| Fonction | Nature | Où |
| --- | --- | --- |
| Notes, coefficients, moyennes publiées | données PRONOTE telles quelles | École › Notes |
| Moyenne pondérée locale | **calcul exact**, méthode affichée | École › Notes, outil `calculate_average` |
| Simulation de note | **estimation** explicitement étiquetée | outil `simulate_grade` |
| Progression par période | barres construites sur les moyennes réelles | École › Notes |
| Contrôles à venir | évaluations datées + cours « contrôle » | outil `get_upcoming_tests` |
| Note nécessaire pour viser une moyenne | **calcul exact**, pas une prévision | outil `simulate_average_target` |
| Matières les plus fragiles | **calcul exact** (écart à la moyenne locale) | outil `get_weak_subjects` |
| Bulletins et appréciations | données PRONOTE | École › Bulletins |
| Recherche des remarques des professeurs | FTS5 local | outil `search_teacher_feedback` |
| Synthèse des messages | données PRONOTE + lecture IA | École › Messages |
| Fiches, QCM, flashcards, bilan hebdo | **générés par l'IA** à partir des données locales | École › Révisions |
| Coût OpenAI estimé | barème local, indicatif, jamais envoyé | Réglages › Assistant IA |

## Ce que l'application ne fait pas

- Aucune connexion ENT/CAS : Pawnote ne l'expose pas (voir la matrice de capacités).
- Aucun contournement de CAPTCHA, de double authentification ou de restriction d'onglet.
- Aucune extraction du texte des PDF PRONOTE : le connecteur fournit titre, description et
  lien, jamais le contenu.
- Aucune pièce jointe dans le chat : la fonction n'existe pas, donc aucun bouton ne
  l'affiche.
- Aucune notification push : elle exigerait un serveur, interdit par l'architecture.
- Aucune donnée inventée : un écran vide dit « aucune donnée synchronisée ».

## Sécurité et vie privée

- Clé OpenAI et jetons PRONOTE uniquement dans SecureStore (Keystore / Keychain).
- Base chiffrée ; refus de démarrer si SQLCipher est absent.
- Aucun envoi à OpenAI sans consentement explicite, vérifié dans le service et pas
  seulement dans l'interface.
- Les textes venant de PRONOTE sont traités comme des données non fiables, jamais comme
  des consignes : une injection de prompt dans un message scolaire reste du texte.
- `store: false` demandé à l'API ; aucune télémétrie, aucune publicité.
- Une clé stockée sur un téléphone reste extractible par la personne qui contrôle
  l'appareil : ce n'est pas un secret inviolable, et l'application ne prétend pas le
  contraire.

Politique de confidentialité (brouillon à faire valider) :
`docs/privacy-policy.md`.

## Documentation

- [Lancer l'application sur votre PC](docs/LANCER_SUR_PC.md) — émulateur Android, de A à Z.
- [Guide Windows](docs/GUIDE_INSTALLATION_WINDOWS.md) — installation de A à Z.
- [Guide de tests](docs/GUIDE_TESTS.md) — automatiques et manuels.
- [Compatibilité Android / iOS](docs/COMPATIBILITE_ANDROID_IOS.md) — matrice vérifiée.
- [Audit](docs/audit.md) — constats, corrections, points ouverts.
- [Architecture](docs/architecture.md) — couches, flux, moteur de synchronisation.
- [Connecteur PRONOTE](docs/pronote-connector.md) — capacités réelles et limites.
- [Outils IA](docs/ai-tools.md) — catalogue des 23 outils et garde-fous.
- [Dépendances et licences](docs/dependencies.md).
- [Compilation et publication](docs/build-and-release.md).

## Commandes utiles

| Commande | Effet |
| --- | --- |
| `npm run verify` | Types (app + tests) puis tous les tests. |
| `npm run typecheck` | Vérification TypeScript seule. |
| `npm test` | Tests unitaires et d'intégration. |
| `npm run test:contract` | Test de contrat PRONOTE (identifiants requis). |
| `npx expo export -p android` | Vérifie que le bundle Android se construit. |
| `npx eas-cli@latest build -p android --profile preview` | Fabrique un APK. |

## Licence

GPL-3.0-or-later. Le connecteur Pawnote est distribué sous GPL-3.0-or-later ; toute
application qui l'intègre doit respecter cette licence. Voir `LICENSE`.
