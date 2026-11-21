# Compatibilité Android et iOS

Ce document décrit ce qui est **vérifié**, ce qui est **compatible sous conditions** et ce
qui n'a **pas encore été testé**. Il ne promet aucune compatibilité non constatée.

## Comment chaque ligne a été vérifiée

Trois niveaux de preuve, toujours distingués :

| Niveau | Signification |
| --- | --- |
| **Vérifié** | Le code compile en TypeScript strict, le bundle Metro Android **et** iOS se construisent (`expo export -p android` / `-p ios`), et les tests automatisés passent. |
| **Sous conditions** | Fonctionne si une configuration précise est respectée (development build, permission accordée, matériel présent). Le bundle le confirme, l'appareil ne l'a pas confirmé. |
| **Non testé** | Aucun appareil physique ni émulateur n'était disponible. Le code existe, rien ne prouve son comportement réel. |

Aucun test sur appareil physique n'a été réalisé à ce jour : ni Android, ni iOS, ni Mac
disponible. Les lignes marquées « non testé » le sont pour cette raison, pas par prudence
excessive.

## Fonctionnalités de l'application

| Fonctionnalité | Android | iOS | Détail |
| --- | --- | --- | --- |
| Écran de chat, historique, réglages | Vérifié | Vérifié | Composants React Native purs, bundle des deux plateformes produit. |
| Base SQLite chiffrée (SQLCipher) | Sous conditions | Sous conditions | Exige un development build avec `useSQLCipher: true`. Expo Go ne l'a pas : l'app refuse de démarrer (voulu). Non testé sur appareil. |
| Recherche plein texte (FTS5) | Sous conditions | Sous conditions | `enableFTS: true` dans le plugin `expo-sqlite`. Fourni par la même compilation que SQLCipher. Non testé sur appareil. |
| Clé OpenAI et jetons PRONOTE dans le coffre système | Vérifié | Vérifié | `expo-secure-store` (Keystore Android / Keychain iOS). Non testé sur appareil. |
| Verrouillage biométrique | Sous conditions | Sous conditions | `expo-local-authentication`. Android : empreinte/visage via BiometricPrompt. iOS : Face ID / Touch ID, `NSFaceIDUsageDescription` déclaré. Non testé sur appareil. |
| Connexion PRONOTE par QR code | Sous conditions | Sous conditions | `expo-camera` + permission `CAMERA` (Android) et `NSCameraUsageDescription` (iOS). Non testé face à un vrai établissement. |
| Connexion PRONOTE par identifiants | Vérifié | Vérifié | Réseau HTTPS pur, aucun module natif. Non testé face à un vrai établissement. |
| Synchronisation manuelle et à l'ouverture | Vérifié | Vérifié | Moteur en TypeScript, testé sur base SQLite réelle en mémoire. |
| Tâche de fond opportuniste | Sous conditions | Sous conditions | `expo-background-task` + `expo-task-manager`. Android : WorkManager. iOS : BGTaskScheduler, fréquence décidée par le système, jamais garantie. Non testé sur appareil. |
| Assistant IA (API Responses, streaming) | Vérifié | Vérifié | `expo/fetch` + lecture SSE maison, testée avec un faux serveur HTTP. Aucun appel réel effectué (pas de clé). |
| 23 outils locaux (Function Calling) | Vérifié | Vérifié | Logique pure testée sous Node sur une vraie base. |
| Calculs de moyennes, simulation, progression | Vérifié | Vérifié | Arithmétique pure, testée. Les barres de progression sont des `View`, pas du SVG. |
| Copier une réponse | Vérifié | Vérifié | `expo-clipboard`. |
| Export / impression | Non disponible | Non disponible | `expo-print` et `expo-sharing` sont installés mais **aucun écran ne les utilise**. Ne pas s'attendre à un bouton d'export. |
| Pièces jointes dans le chat | Non disponible | Non disponible | Volontairement absent : aucun envoi de fichier n'est implémenté, donc aucun bouton n'est affiché. `expo-document-picker` est installé mais inutilisé. |
| Notifications | Non disponible | Non disponible | Aucune notification push : elle exigerait un serveur, interdit par l'architecture. Seules des notifications locales planifiées seraient possibles, elles ne sont pas implémentées. |
| Version web | Non compatible | Non compatible | `expo-sqlite` en web passe par un worker wasm et SQLCipher n'existe pas côté navigateur. L'export web échoue : ce n'est pas un bug à corriger, la cible est mobile. |

## Dépendances et licences

Toutes les versions viennent de `package.json` et du `package-lock.json` réellement installé.

| Paquet | Version | Licence | Utilisé dans le code | Note |
| --- | --- | --- | --- | --- |
| `expo` | ~58.0.26 | MIT | oui | SDK 58. |
| `react-native` | 0.88.1 | MIT | oui | Nouvelle architecture activée par défaut. |
| `react` / `react-dom` | 19.3.0 | MIT | oui | |
| `expo-router` | ~58.0.32 | MIT | oui | Navigation par fichiers. |
| `expo-sqlite` | ~58.0.18 | MIT | oui | SQLCipher et FTS5 via le plugin. |
| `expo-secure-store` | ~58.0.3 | MIT | oui | Secrets. |
| `expo-local-authentication` | ~58.0.3 | MIT | oui | Verrou biométrique. |
| `expo-camera` | ~58.0.14 | MIT | oui | QR code PRONOTE. |
| `expo-clipboard` | ~58.0.4 | MIT | oui | Copier une réponse. |
| `expo-crypto` | ~58.0.8 | MIT | oui | Aléa cryptographique. |
| `expo-linking` | ~58.0.17 | MIT | oui | Liens internes. |
| `expo-background-task` | ~58.0.13 | MIT | oui | Synchronisation opportuniste. |
| `expo-task-manager` | ~58.0.14 | MIT | oui | Support des tâches de fond. |
| `expo-status-bar` | ~58.0.5 | MIT | oui | Barre d'état. |
| `expo-dev-client` | ~58.0.21 | MIT | oui | Development build. |
| `@blockshub/pawnote-lts` | ^1.6.4 | **GPL-3.0-or-later** | oui | Connecteur PRONOTE. Impose la licence GPL du projet. |
| `zustand` | ^5.1.0 | MIT | oui | État applicatif. |
| `react-native-safe-area-context` | ~5.11.1 | MIT | oui | Encoches et zones sûres. |
| `react-native-screens` | ~4.30.1 | MIT | indirect | Requis par `expo-router`. |
| `react-native-gesture-handler` | ~3.3.0 | MIT | indirect | Requis par la navigation. |
| `react-native-reanimated` | 4.7.1 | MIT | indirect | Requis par la navigation. |
| `react-native-worklets` | 0.13.0 | MIT | indirect | Requis par Reanimated. |
| `react-native-web` | ~0.21.4 | MIT | non | Cible web non prise en charge. |
| `react-native-svg` | 15.16.0 | MIT | **non** | Installé mais inutilisé : les graphiques sont des `View`. À retirer après un test de build natif. |
| `expo-document-picker` | ~58.0.5 | MIT | **non** | Réservé à une future pièce jointe. |
| `expo-file-system` | ~58.0.14 | MIT | **non** | Inutilisé aujourd'hui. |
| `expo-print` | ~58.0.9 | MIT | **non** | Inutilisé aujourd'hui. |
| `expo-sharing` | ~58.0.23 | MIT | **non** | Inutilisé aujourd'hui. |
| `expo-haptics` | ~58.0.8 | MIT | **non** | Inutilisé aujourd'hui. |
| `expo-network` | ~58.0.5 | MIT | **non** | Inutilisé aujourd'hui. |
| `expo-constants` | ~58.0.16 | MIT | **non** | Inutilisé aujourd'hui. |
| `expo-system-ui` | ~58.0.7 | MIT | **non** | Inutilisé aujourd'hui. |
| `expo-splash-screen` | ~58.0.14 | MIT | config | Utilisé via le plugin `app.json`, pas par un import. |

Les paquets marqués **non** sont volontairement laissés en place : les retirer modifie la
compilation native, et aucune compilation native n'a pu être testée ici. La liste est
fournie pour qu'un retrait puisse être fait et vérifié sur un appareil.

## Différences Android / iOS à connaître

| Sujet | Android | iOS |
| --- | --- | --- |
| Installation d'un APK de test | Fichier `.apk` installable, autoriser « sources inconnues » | Pas d'équivalent : TestFlight, ou build via un Mac. |
| Biométrie | `USE_BIOMETRIC` / `USE_FINGERPRINT`, plusieurs capteurs possibles | Face ID / Touch ID, texte `NSFaceIDUsageDescription` obligatoire. |
| Tâche de fond | WorkManager, intervalle minimal imposé | BGTaskScheduler, exécution non garantie, plus restrictive. |
| Clavier | `KeyboardAvoidingView` sans `behavior` (le système redimensionne) | `behavior="padding"` obligatoire pour que le champ reste visible. |
| Coffre de secrets | Keystore, sauvegarde Android possible selon l'appareil | Keychain, accessible après le premier déverrouillage. |
| Permission caméra | `CAMERA` dans le manifeste | `NSCameraUsageDescription` dans `Info.plist`. |

## Préparation à la publication

État réel des éléments de configuration :

| Élément | Android | iOS | Statut |
| --- | --- | --- | --- |
| Identifiant d'application | `app.studia.mobile` | `app.studia.mobile` | Défini, jamais publié. |
| Icône | `assets/images/icon.png` + icônes adaptatives | même fichier | Présent. |
| Splash screen | plugin `expo-splash-screen` | idem | Présent. |
| Permissions déclarées | INTERNET, CAMERA, USE_BIOMETRIC, USE_FINGERPRINT | caméra, Face ID | Déclarées. |
| Textes de permission en français | oui | oui | Rédigés. |
| Version | `0.1.0` | `0.1.0` | À incrémenter à chaque envoi. |
| Profils EAS | `development`, `preview`, `production` | idem | `eas.json` fourni. |
| Build de production (AAB) | configuré, jamais exécuté | configuré, jamais exécuté | Non vérifié. |
| Politique de confidentialité | brouillon | brouillon | `docs/privacy-policy.md`, à faire valider. |
| Compte développeur | — | — | À créer (25 $ une fois pour Google Play, 99 $/an pour Apple). |
| Fiche store (captures, description) | — | — | À produire. |
| Test sur appareil | — | — | À faire avant toute publication. |

**Studia n'est pas prête à être publiée.** Aucun build de production n'a été exécuté, aucun
test sur appareil n'a eu lieu, et la politique de confidentialité est un brouillon. Les
étapes restantes sont listées dans `docs/build-and-release.md` et ci-dessous.

### Étapes restantes avant publication

1. Générer un build `preview` et le tester sur un Android réel (installation, SQLCipher,
   biométrie, caméra, sync).
2. Tester sur un iPhone via TestFlight (compte Apple Developer requis, Mac ou EAS Build).
3. Faire valider la politique de confidentialité (obligatoire : données de mineurs).
4. Remplacer les icônes et le splash par des visuels définitifs.
5. Incrémenter la version et exécuter `eas build --profile production`.
6. Remplir les fiches Google Play et App Store, y compris la section « sécurité des
   données » et la déclaration « suivi » (aucun suivi ici).
7. Vérifier la conformité GPL : le code source doit rester disponible pour les
   utilisateurs de l'application distribuée.
