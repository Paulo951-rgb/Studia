# Installer et tester Studia sur Windows

Guide écrit pour quelqu'un qui n'a jamais utilisé Node.js, Expo, Git ni Android Studio.
Suivez les étapes dans l'ordre. Chaque commande est prête à copier-coller.

Temps total estimé : 30 à 45 minutes, dont 10 à 20 minutes d'attente pendant la
compilation de l'application.

---

## 0. Ce que vous allez obtenir

Studia est une application mobile. Elle ne peut pas s'exécuter dans un navigateur web :
elle a besoin d'une base de données chiffrée (SQLCipher) qui n'existe que sur un
téléphone. Vous allez donc :

1. installer les outils sur votre PC (Node.js, Git) ;
2. télécharger le projet ;
3. laisser un service en ligne gratuit (Expo EAS) fabriquer un fichier `.apk` ;
4. installer ce fichier sur votre téléphone Android ;
5. (facultatif) recharger l'application à chaud depuis votre PC pendant que vous
   développez.

Vous n'avez **pas** besoin d'Android Studio pour cette méthode.

### Trois mots de vocabulaire

| Mot | Ce que c'est |
| --- | --- |
| **Node.js** | Le programme qui exécute les outils du projet sur votre PC. |
| **npm** | Le gestionnaire de paquets livré avec Node.js ; il télécharge les bibliothèques. |
| **APK** | Le fichier d'installation d'une application Android. |
| **Metro** | Le serveur qui envoie le code de l'application au téléphone pendant le développement. |
| **EAS** | Le service de compilation d'Expo : il fabrique l'APK sur ses serveurs, sans rien installer sur votre PC. |

---

## A. Préparer Windows

### A.1 Matériel et logiciels requis

| Élément | Minimum | Recommandé |
| --- | --- | --- |
| Windows | Windows 10 64 bits | Windows 11 |
| RAM | 4 Go | 8 Go |
| Espace disque libre | 3 Go | 5 Go |
| Connexion Internet | oui | oui, stable (la compilation se fait en ligne) |
| Téléphone de test | Android 8 ou plus | Android 12 ou plus |
| Compte | GitHub (vous l'avez déjà) | + compte Expo gratuit |

Un iPhone ne peut pas installer un APK. Pour tester sur iPhone, il faut un compte Apple
Developer et TestFlight : voir `docs/COMPATIBILITE_ANDROID_IOS.md`.

### A.2 Ouvrir un terminal

Deux possibilités, au choix :

- **PowerShell** : touche Windows, tapez `powershell`, appuyez sur Entrée.
- **Invite de commandes** : touche Windows, tapez `cmd`, appuyez sur Entrée.

Toutes les commandes de ce guide fonctionnent dans les deux.

### A.3 Installer Node.js

**Méthode 1 — la plus rapide (winget)**

Dans le terminal :

```powershell
winget install OpenJS.NodeJS.LTS
```

Acceptez les conditions si Windows le demande. Fermez ensuite le terminal et rouvrez-le
(obligatoire : le chemin de Node.js n'est chargé qu'au démarrage d'un terminal).

**Méthode 2 — l'installateur graphique**

1. Ouvrez <https://nodejs.org/fr> dans votre navigateur.
2. Téléchargez la version **LTS** (bouton de gauche).
3. Lancez le fichier `.msi`, cliquez « Next » partout en gardant les options par défaut.
4. À l'écran « Tools for Native Modules », **ne cochez rien** : ce n'est pas nécessaire ici.

**Vérifier l'installation**

```powershell
node -v
npm -v
```

Résultat attendu : deux numéros de version, par exemple `v22.20.0` et `10.9.3`.
Studia exige Node.js **20 ou plus récent**.

Si vous voyez `node : Le terme « node » n'est pas reconnu`, voir le dépannage §G.1.

### A.4 Installer Git

**Méthode 1 (winget)**

```powershell
winget install --id Git.Git -e
```

**Méthode 2 (installateur)**

<https://git-scm.com/download/win> → téléchargez, lancez, cliquez « Next » partout.

**Vérifier**

```powershell
git --version
```

Résultat attendu : `git version 2.4x.x`.

> Git n'est indispensable que pour la méthode « cloner ». Si vous téléchargez le ZIP,
> vous pouvez passer cette étape — mais elle ne coûte que deux minutes.

---

## B. Télécharger Studia

### B.1 Choisir un dossier

Créez un dossier simple, par exemple :

```
C:\Users\VotreNom\Documents\Studia
```

**À éviter absolument :**

- un dossier synchronisé OneDrive (les fichiers se verrouillent pendant l'installation) ;
- un chemin avec des accents ou des caractères spéciaux (`C:\Users\Léa\Bureau\école`) ;
- un chemin très long.

### B.2 Méthode 1 — télécharger le ZIP (aucune commande)

1. Ouvrez <https://github.com/Paulo951-rgb/Studia>.
2. Bouton vert **Code** → **Download ZIP**.
3. Clic droit sur le fichier téléchargé → **Extraire tout** → choisissez le dossier de
   l'étape B.1.
4. Vérifiez que `package.json`, `app.json` et `INSTALLER-STUDIA.bat` sont **directement**
   dans ce dossier. S'ils sont dans un sous-dossier `Studia-main`, déplacez le contenu.

> Le dépôt est privé : connectez-vous à GitHub avec votre compte avant de télécharger.

### B.3 Méthode 2 — cloner avec Git

```powershell
cd $env:USERPROFILE\Documents
git clone https://github.com/Paulo951-rgb/Studia.git
cd Studia
```

### B.4 Vérifier que vous êtes au bon endroit

Dans le terminal, placez-vous dans le dossier puis listez son contenu :

```powershell
cd C:\Users\VotreNom\Documents\Studia
dir
```

Vous devez voir au minimum : `package.json`, `app.json`, `src`, `docs`,
`INSTALLER-STUDIA.bat`.

Pour ouvrir un terminal **directement** dans le dossier : ouvrez le dossier dans
l'Explorateur, cliquez dans la barre d'adresse, tapez `powershell`, appuyez sur Entrée.

---

## C. Installer les dépendances

Les dépendances sont les bibliothèques (React Native, Expo, SQLite…) dont le projet a
besoin. Elles ne sont pas dans le dépôt : il faut les télécharger une fois.

### C.1 Méthode simple — le script

Double-cliquez sur **`INSTALLER-STUDIA.bat`**.

Le script vérifie Node.js, vérifie npm, puis lance l'installation. Il affiche :

```
Node.js : v22.20.0
npm     : 10.9.3
Aucun dossier node_modules : installation complete des dependances.
```

Puis, à la fin :

```
============================================================
  Installation terminee.
============================================================
```

La fenêtre reste ouverte : lisez le message, puis appuyez sur une touche.

### C.2 Méthode manuelle (équivalente)

```powershell
npm install
```

### C.3 Comment reconnaître une réussite

- Un dossier `node_modules` apparaît à la racine (il est volumineux, c'est normal).
- Le message final ne contient ni `npm ERR!` ni `ERESOLVE`.
- `npm install` affiche un décompte de paquets, puis rend la main.

Un avertissement `npm warn deprecated` est sans gravité : ce n'est pas une erreur.

### C.4 Vérifier que le projet est sain (recommandé, 1 minute)

Double-cliquez sur **`TESTER-STUDIA.bat`**, ou :

```powershell
npm run verify
```

Résultat attendu : `pass 113` (ou plus) et `fail 0`, plus aucun message d'erreur
TypeScript. Si vous voyez des échecs, ne continuez pas : voir §G.3.

---

## D. Fabriquer l'application Android (APK)

La compilation se fait sur les serveurs gratuits d'Expo. Rien à installer sur votre PC.

> **Ce qui est envoyé à Expo** : le code source du projet, pour le compiler. Aucune
> donnée personnelle n'y figure : votre clé OpenAI et vos identifiants PRONOTE sont
> saisis plus tard, sur le téléphone, et ne quittent jamais l'appareil.

### D.1 Créer un compte Expo (gratuit)

1. Allez sur <https://expo.dev/signup>.
2. Choisissez un nom d'utilisateur, une adresse e-mail, un mot de passe.
3. Validez l'e-mail si Expo le demande.

C'est gratuit. Le plan gratuit limite le nombre de compilations par mois et les place en
file d'attente : prévoyez de l'attente aux heures de pointe.

### D.2 Se connecter depuis le PC

```powershell
npx eas-cli@latest login
```

Saisissez l'e-mail (ou le nom d'utilisateur) puis le mot de passe. Le mot de passe n'est
pas enregistré dans le projet.

Vérifier :

```powershell
npx eas-cli@latest whoami
```

Résultat attendu : votre nom d'utilisateur Expo.

### D.3 Relier le projet à votre compte (une seule fois)

```powershell
npx eas-cli@latest init
```

Répondez `Y` quand Expo propose de créer le projet. Cette commande ajoute un identifiant
de projet dans `app.json`. Elle n'est à faire qu'une fois par copie du projet.

### D.4 Lancer la compilation

```powershell
npx eas-cli@latest build --platform android --profile preview
```

Ou double-cliquez sur **`CONSTRUIRE-APK.bat`**, qui enchaîne les étapes D.2 à D.4 et
explique chaque erreur.

Expo demande d'abord :

> Generate a new Android Keystore?

Répondez `Y`. Expo crée et conserve la clé de signature : gardez le même compte Expo pour
vos futures compilations, sinon Android refusera de mettre à jour l'application.

Puis la compilation démarre. Durée : 10 à 20 minutes. Vous pouvez fermer la fenêtre, la
compilation continue sur les serveurs d'Expo.

### D.5 Récupérer l'APK

À la fin, le terminal affiche une ligne du type :

```
https://expo.dev/accounts/<votre-compte>/projects/studia/builds/<identifiant>
```

Ouvrez ce lien, ou allez sur <https://expo.dev> → votre projet → **Builds** → le build
terminé → bouton **Install** / **Download**.

Vous obtenez un fichier `*.apk`.

### D.6 Installer l'APK sur le téléphone

1. Transférez le fichier sur le téléphone (câble USB, e-mail, Google Drive, WhatsApp…).
2. Ouvrez-le depuis l'application « Fichiers » du téléphone.
3. Android demande d'autoriser l'installation depuis cette source : acceptez.
4. Play Protect peut afficher « Application non vérifiée » : c'est normal pour une
   application hors Play Store, choisissez **Installer quand même**.

L'application apparaît sous le nom **Studia**. Elle fonctionne seule : pas besoin que
votre PC soit allumé.

### D.7 Deux profils de compilation, à ne pas confondre

| Profil | Commande | Ce que vous obtenez |
| --- | --- | --- |
| `preview` | `--profile preview` | Application autonome, code inclus. Idéale pour tester sans PC. |
| `development` | `--profile development` | Application qui a besoin de Metro (`LANCER-STUDIA.bat`) pour afficher le code. Sert à modifier le code et voir le résultat en 2 secondes. |
| `production` | `--profile production` | Fichier `.aab` pour le Play Store. Pas pour tester à la main. |

Pour un premier essai, utilisez **`preview`**.

---

## E. Tester sur PC

Trois possibilités, de la plus simple à la plus lourde.

### E.1 Téléphone Android en USB (sans Android Studio)

1. Sur le téléphone : **Paramètres → À propos du téléphone → Numéro de build**, tapez
   sept fois dessus pour activer le mode développeur.
2. **Paramètres → Système → Options pour les développeurs → Débogage USB** : activez.
3. Branchez le téléphone en USB, acceptez la demande « Autoriser le débogage USB ».
4. Sur le PC, vérifiez que le téléphone est vu :

```powershell
adb devices
```

Si `adb` n'est pas reconnu, il n'est pas installé (il vient avec Android Studio). Utilisez
alors la méthode E.2 ou transférez l'APK par e-mail.

### E.2 Émulateur Android (nécessite Android Studio)

Android Studio installe le SDK, l'émulateur et `adb`. Comptez 6 Go de téléchargement.

1. <https://developer.android.com/studio> → téléchargez et installez.
2. Dans Android Studio : **More Actions → Virtual Device Manager → Create device**,
   choisissez un Pixel récent et une image système récente.
3. Démarrez l'émulateur.
4. Dans le projet :

```powershell
npm run android
```

Cette commande compile en local (10 à 20 minutes la première fois) et installe
l'application dans l'émulateur. Elle nécessite Java (JDK 17), fourni avec Android Studio.

> L'émulateur ne dispose pas toujours d'un capteur biométrique. Le verrouillage Studia
> peut alors refuser de s'activer : c'est le comportement prévu, l'application reste
> utilisable sans verrou.

### E.3 Version web : impossible, et pourquoi

`npx expo start --web` ne fonctionnera pas. Deux raisons vérifiées :

- `expo-sqlite` en web passe par un worker WebAssembly, et l'export web échoue ;
- SQLCipher n'existe pas dans un navigateur : l'application refuse explicitement de
  démarrer sans chiffrement plutôt que d'écrire vos notes en clair.

Ce n'est pas un défaut à corriger : la cible est Android et iOS.

### E.4 Rechargement à chaud (facultatif)

Si vous avez installé le build **`development`** :

1. Double-cliquez sur **`LANCER-STUDIA.bat`** (ou `npx expo start --dev-client`).
2. Le téléphone et le PC doivent être sur le **même Wi-Fi**.
3. Ouvrez l'application Studia : elle se connecte au serveur et affiche votre code.
4. Modifiez un fichier : l'application se met à jour en une seconde.

Si la connexion échoue, essayez le mode tunnel :

```powershell
npx expo start --dev-client --tunnel
```

---

## F. Tester les fonctionnalités

La liste complète des vérifications, avec le résultat attendu pour chacune, se trouve
dans **`docs/GUIDE_TESTS.md`**. Les cinq premiers tests à faire après l'installation :

| # | Action | Résultat attendu |
| --- | --- | --- |
| 1 | Ouvrir Studia | Écran de chat avec le message d'accueil « Bonjour. », trois onglets : Assistant, École, Réglages. |
| 2 | Poser une question sans clé API | La question reste affichée, une bannière indique qu'aucune clé n'est enregistrée. Rien n'est envoyé. |
| 3 | Réglages → Assistant IA → saisir une clé, accepter le partage | La bannière disparaît, le badge passe à « Envoi IA autorisé ». |
| 4 | Fermer et rouvrir l'application | La conversation précédente est toujours là : la base locale fonctionne. |
| 5 | Réglages → Confidentialité → activer le verrouillage | Le téléphone demande l'empreinte au prochain passage en arrière-plan. |

---

## G. Dépannage

Chaque entrée indique si le problème a été **réellement rencontré** pendant la mise au
point du projet, ou s'il est **possible** sans avoir été reproduit ici.

### G.1 `node` n'est pas reconnu

*Possible, non rencontré ici.*

Cause : Node.js vient d'être installé et le terminal était déjà ouvert.
Solution : fermez **toutes** les fenêtres de terminal, rouvrez-en une, retapez `node -v`.
Si le problème persiste, réinstallez Node.js en cochant « Add to PATH ».

### G.2 `npm` n'est pas reconnu

*Possible.* npm est livré avec Node.js : si `node -v` fonctionne mais pas `npm -v`,
l'installation est incomplète. Réinstallez Node.js par-dessus.

### G.3 `npm install` échoue

*Possible.* Trois causes fréquentes :

| Message | Cause | Solution |
| --- | --- | --- |
| `EACCES` / `EPERM` | droits ou antivirus | Fermez l'éditeur, relancez en administrateur, ou excluez le dossier de l'antivirus. |
| `ETIMEDOUT` / `ENOTFOUND` | réseau, proxy | Vérifiez la connexion, désactivez un VPN, réessayez. |
| `ERESOLVE` | versions incohérentes | Supprimez `node_modules` et `package-lock.json` puis relancez `npm install`. |

Ne supprimez jamais `package-lock.json` pour « aller plus vite » : il garantit des
versions identiques à celles testées.

### G.4 `npm test` échoue

*Rencontré pendant le développement, corrigé.* Si vous voyez des échecs :

1. Notez le nom du test en échec (ligne `not ok`).
2. Vérifiez que vous êtes sur la dernière version : `git pull`.
3. Relancez `npm run verify`.

Les tests tournent sur une vraie base SQLite en mémoire, sans téléphone.

### G.5 `npx eas-cli@latest login` refuse la connexion

*Possible.* Vérifiez l'e-mail et le mot de passe sur <https://expo.dev>. Si vous vous êtes
inscrit avec GitHub, utilisez le bouton « Sign in with GitHub » sur le site, puis
`npx eas-cli@latest login` avec les identifiants du compte Expo (pas ceux de GitHub).

### G.6 `eas init` échoue

*Possible.* La commande exige d'être connecté : faites D.2 avant. Si le projet est déjà
relié à un autre compte, répondez `N` à la proposition de créer un nouveau projet et
choisissez « Skip ».

### G.7 La compilation EAS échoue

*Possible, non rencontré ici (aucune compilation n'a été lancée).*

| Message | Cause probable |
| --- | --- |
| `You've reached the limit of builds` | quota gratuit mensuel atteint : attendez ou utilisez la compilation locale (E.2). |
| `Invalid credentials` | jeton Expo expiré : `npx eas-cli@latest login`. |
| `Gradle build failed` | erreur de code ou de configuration : le journal complet est sur expo.dev. |
| `Unknown error` après 2 minutes | souvent réseau : relancez. |

### G.8 L'APK refuse de s'installer

*Possible.*

- « Application non installée » : une version précédente signée autrement existe déjà →
  désinstallez l'ancienne application.
- « Échec de l'analyse » : fichier incomplet → retéléchargez-le.
- Play Protect bloque : **Installer quand même**.
- Espace insuffisant : libérez de la place.

### G.9 Écran blanc au démarrage

*Possible.* Sur un build `development`, un écran blanc signifie que Metro n'est pas
joignable : lancez `LANCER-STUDIA.bat`, vérifiez le même Wi-Fi. Sur un build `preview`,
cela indique un plantage : branchez le téléphone en USB et lancez `adb logcat | findstr
AndroidRuntime` pour lire l'erreur.

### G.10 « Stockage local indisponible »

*Comportement voulu, pas un bug.* Le message exact est :

> SQLCipher n'est pas disponible dans cette compilation : la base serait écrite en clair.

Studia refuse de démarrer sans chiffrement. Cela arrive si l'application a été compilée
sans le plugin `expo-sqlite` configuré avec `useSQLCipher: true`, ou si vous essayez de
l'ouvrir dans Expo Go. Utilisez un build `preview` ou `development` généré par EAS.

### G.11 L'application se ferme immédiatement

*Possible.* Cause la plus fréquente : un module natif absent du build (par exemple un
build trop ancien après l'ajout d'une dépendance). Régénérez l'APK. Sinon, lisez
`adb logcat`.

### G.12 Metro ne se connecte pas au téléphone

*Possible.*

1. Même Wi-Fi, sans isolation client (les réseaux d'entreprise et certains hôtels bloquent).
2. Pare-feu Windows : autorisez Node.js sur le réseau privé.
3. Essayez `npx expo start --dev-client --tunnel`.
4. En dernier recours, branchez en USB et utilisez `npm run android`.

### G.13 La synchronisation PRONOTE échoue

*Possible, aucun test réel effectué (aucun identifiant disponible).*

| Message | Signification |
| --- | --- |
| `invalid_credentials` | identifiants refusés par l'établissement. |
| `session_expired` | la session a expiré : reconnectez-vous depuis l'écran Connexion. |
| `network_error` | réseau indisponible ou serveur PRONOTE inaccessible. |
| `unsupported` | la ressource demandée n'est pas exposée par ce connecteur. |

Les données déjà synchronisées restent consultables hors ligne.

---

## H. Mettre à jour, sauvegarder, désinstaller

### Mettre à jour le projet

```powershell
cd C:\Users\VotreNom\Documents\Studia
git pull
npm install
```

Puis recompilez un APK (`CONSTRUIRE-APK.bat`). Android acceptera la mise à jour si la
signature est la même (même compte Expo).

### Sauvegarder

Aucune sauvegarde n'est automatique. Les données vivent uniquement dans le téléphone,
chiffrées. Copier le fichier de base ne sert à rien sans la clé, elle-même dans le coffre
du système.

### Désinstaller

Désinstallez l'application depuis Android. Toutes les données locales disparaissent.
Pour tout effacer **sans** désinstaller : Réglages → Confidentialité → « Effacer toutes
les données ».

---

## Récapitulatif en cinq lignes

1. Installer Node.js LTS et Git.
2. Télécharger le ZIP de Studia et l'extraire dans `Documents\Studia`.
3. Double-cliquer sur `INSTALLER-STUDIA.bat`.
4. Créer un compte sur expo.dev, puis double-cliquer sur `CONSTRUIRE-APK.bat`.
5. Télécharger l'APK depuis le lien affiché, l'installer sur le téléphone, ouvrir Studia.
