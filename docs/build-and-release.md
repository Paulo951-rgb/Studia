# Compilation et publication

## 1. Prérequis

- Node.js 24 (ou 22+), npm.
- Android : JDK 17+, Android SDK, un appareil ou émulateur.
- iOS : macOS, Xcode 16+, CocoaPods.
- Un compte Expo (gratuit) uniquement pour EAS Build, facultatif.

## 2. Installation et vérification

```bash
npm install
npm run verify     # tsc --noEmit + tsc -p tsconfig.test.json + 85 tests
```

Aucune étape de build n'est nécessaire pour lancer les tests : ils utilisent `node:sqlite`
(FTS5 inclus) et n'importent pas de module natif.

## 3. Development build (obligatoire)

Expo Go ne fournit ni SQLCipher, ni SecureStore biométrique, ni tâches de fond.

```bash
npm run prebuild        # expo prebuild --clean : génère android/ et ios/
npm run android         # build + installation
npm run ios             # macOS uniquement
```

Vérifications à faire au premier lancement :

1. `PRAGMA cipher_version` doit renvoyer une version (sinon l'app affiche
   « Stockage local indisponible » et refuse d'écrire — comportement voulu).
2. L'onglet École doit afficher « Aucune donnée synchronisée » avant toute connexion.
3. Le scan du QR code doit demander la permission caméra.

## 4. Build de production

### EAS Build

```bash
npm i -g eas-cli
eas login
eas build:configure
eas build -p android --profile production
eas build -p ios --profile production
```

`eas.json` n'est pas fourni : créez-le avec les profils souhaités. Pour Android, préférez
un build `app-bundle` (AAB) pour le Play Store.

### Build local

```bash
npx expo run:android --variant release
npx expo run:ios --configuration Release
```

## 5. Signature

- **Android** : générez un keystore (`keytool -genkeypair …`), conservez-le hors du dépôt,
  référencez-le via `eas credentials` ou `android/gradle.properties` (fichier ignoré par
  git). `android/` est dans `.gitignore` : il est régénéré par `expo prebuild`.
- **iOS** : certificat de distribution + provisioning profile via Xcode ou
  `eas credentials`.

## 6. Publication

1. **Play Store** : compte développeur, fiche de confidentialité (utiliser
   `docs/privacy-policy.md`), classification « Utilitaires », AAB signé, test interne
   d'abord. Déclarer l'absence de publicité et de suivi.
2. **App Store** : compte développeur, description, captures, politique de confidentialité
   hébergée (URL publique requise), justification de l'accès caméra (QR code) et Face ID.
   Apple exige une URL de politique de confidentialité : hébergez ce brouillon validé.
3. **GPL** : Pawnote est GPL-3.0-or-later. Publiez le code source correspondant et
   mentionnez-le dans la fiche du store.

## 7. Ce qu'il reste à tester avant publication

| Test | Pourquoi il n'est pas fait ici |
| --- | --- |
| Connexion PRONOTE réelle (QR + identifiants) | aucun identifiant d'établissement disponible |
| Synchronisation complète sur un vrai compte | idem |
| Appels OpenAI réels (streaming, outils, quotas) | aucune clé API disponible |
| SQLCipher sur appareil | nécessite une compilation native |
| Tâche de fond iOS/Android | nécessite un appareil et du temps système |
| Accessibilité, rotation, petits écrans | nécessite un appareil |

Un test de contrat est fourni pour la connexion réelle. Il ne s'exécute que si les
variables sont présentes, et il n'effectue aucune écriture :

```bash
PRONOTE_URL=https://0xxxxx.index-education.net/pronote \
PRONOTE_USERNAME=... PRONOTE_PASSWORD=... PRONOTE_KIND=student \
npm run test:contract
```

Ces tests doivent être exécutés et documentés avant toute déclaration de mise en
production.
