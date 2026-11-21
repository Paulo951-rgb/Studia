# Lancer Studia sur votre PC (Windows)

Objectif : voir l'application tourner dans une fenêtre sur votre PC, sans téléphone.

## À lire avant de commencer

Studia ne peut pas tourner dans un navigateur web. Deux raisons vérifiées :

1. `expo-sqlite` en web passe par un worker WebAssembly, et l'export web échoue ;
2. SQLCipher (le chiffrement de la base) n'existe pas dans un navigateur, et
   l'application refuse explicitement de démarrer sans chiffrement.

Il n'y a donc qu'une seule façon de la voir tourner sur PC : un émulateur Android.

| Route | Ce qu'il faut installer | Durée | Recommandation |
| --- | --- | --- | --- |
| A. Émulateur Android Studio et compilation locale | Android Studio (environ 10 Go) | 45 à 75 minutes la première fois | Recommandée : tout est natif, rechargement à chaud inclus |
| B. Émulateur tiers et APK fabriqué par EAS | BlueStacks et un compte Expo | 30 à 45 minutes | Dépannage seulement : logiciel tiers, non testé ici |

La suite décrit la route A. La route B est résumée au paragraphe 8.

---

## 1. Vérifier les prérequis (2 minutes)

Ouvrez PowerShell : touche Windows, tapez `powershell`, appuyez sur Entrée.

```powershell
node -v
npm -v
```

Attendu : `v20.x` ou plus, et `10.x` ou plus. Si `node` n'est pas reconnu, installez
Node.js LTS avec `winget install OpenJS.NodeJS.LTS`, fermez toutes les fenêtres de
terminal, puis rouvrez-en une.

Vérifiez l'espace disque libre :

```powershell
Get-PSDrive C | Select-Object Used,Free
```

Il faut au moins 10 Go libres : Android Studio, l'image système de l'émulateur et les
dépendances Gradle prennent beaucoup de place.

### Virtualisation matérielle

L'émulateur est inutilisable sans elle. Ouvrez le Gestionnaire des tâches, onglet
Performances, section Processeur, et lisez la ligne Virtualisation : elle doit indiquer
Activée. Si elle indique Désactivée, activez VT-x ou AMD-V dans le BIOS ou l'UEFI.

Activez ensuite la plateforme d'hyperviseur de Windows. Dans PowerShell ouvert en
administrateur :

```powershell
dism /online /enable-feature /featurename:HypervisorPlatform /all /norestart
dism /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
```

Redémarrez le PC après ces deux commandes.

---

## 2. Installer Android Studio (15 à 25 minutes)

1. Ouvrez <https://developer.android.com/studio>.
2. Téléchargez Android Studio pour Windows (fichier `.exe`).
3. Lancez l'installateur et gardez les options par défaut. À l'écran du type
   d'installation, choisissez Standard et non Custom : cela installe le JDK, le SDK,
   l'émulateur et `adb`.
4. Au premier démarrage, Android Studio propose un assistant. Acceptez les licences et
   laissez-le télécharger les composants : une barre de progression s'affiche en bas de
   la fenêtre. Ne fermez pas la fenêtre pendant cette étape.

Le SDK est installé par défaut dans :

```
C:\Users\<VotreNom>\AppData\Local\Android\Sdk
```

Vérifiez que `adb` est présent :

```powershell
dir "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
```

Si le fichier apparaît dans la liste, l'installation est correcte.

### Déclarer le SDK pour les commandes en ligne

Dans PowerShell :

```powershell
setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk"
```

Fermez toutes les fenêtres de terminal, rouvrez-en une, puis vérifiez :

```powershell
echo $env:ANDROID_HOME
adb version
```

Attendu : le chemin du SDK, puis une ligne `Android Debug Bridge version 1.0.4x`.

Sans cette variable, `npx expo run:android` échoue avec le message
« Failed to resolve the Android SDK location ».

---

## 3. Créer un émulateur (10 à 20 minutes, téléchargement compris)

1. Dans Android Studio, ouvrez le Device Manager : écran d'accueil, bouton More Actions,
   puis Virtual Device Manager. Le menu Tools puis Device Manager fonctionne aussi.
2. Cliquez sur Create Virtual Device, ou sur l'icône `+`.
3. Choisissez un modèle : Pixel 7 ou Pixel 8. Cliquez sur Next.
4. Choisissez une image système :
   - onglet x86_64 Images, pas ARM ;
   - API 35 ou API 36 ;
   - colonne Google APIs, qui suffit pour tout, y compris l'empreinte simulée.
5. Cliquez sur Next, puis sur Finish. L'image se télécharge (1 à 2 Go).
6. Démarrez l'émulateur avec le bouton de lecture. Le premier démarrage prend 2 à
   5 minutes et affiche l'écran d'accueil d'Android.

Laissez l'émulateur ouvert pendant toute la suite.

---

## 4. Préparer le projet (5 à 10 minutes la première fois)

Dans PowerShell :

```powershell
cd "$env:USERPROFILE\Documents\Studia"
npm install
```

Si vous avez déjà lancé `INSTALLER-STUDIA.bat`, cette étape est inutile : le script fait
exactement la même chose.

Vérifiez que le chiffrement de la base est bien configuré avant de compiler :

```powershell
node -e "const c=require('./app.json').expo;console.log(JSON.stringify(c.plugins.filter(p=>JSON.stringify(p).includes('sqlite'))))"
```

Attendu : `[["expo-sqlite",{"enableFTS":true,"useSQLCipher":true}]]`.

Si la sortie est vide, la base ne serait pas chiffrée : ne compilez pas et signalez-le.

---

## 5. Compiler et lancer (10 à 20 minutes la première fois)

L'émulateur doit être démarré. Dans le dossier du projet :

```powershell
npm run android
```

Cette commande fait trois choses, dans cet ordre :

1. `expo prebuild` génère le dossier natif `android/` (il est ignoré par Git, c'est
   normal) ;
2. Gradle télécharge ses dépendances, environ 1,5 Go, puis compile : c'est l'étape
   longue ;
3. l'APK est installé dans l'émulateur et l'application s'ouvre.

### Ce que vous devez voir

À la fin, dans le terminal :

```
BUILD SUCCESSFUL in 4m 12s
Installing APK...
Opening on Pixel_7_API_35...
```

Et dans l'émulateur : l'écran d'accueil de Studia, avec le message « Bonjour. », les trois
onglets Assistant, École et Réglages, et la barre de statut « Jamais synchronisé ».

Si la compilation réussit mais que l'application ne s'ouvre pas, lancez-la à la main :

```powershell
adb shell monkey -p app.studia.mobile 1
```

### Si Gradle s'arrête sur « OutOfMemory »

Ouvrez le fichier `android\gradle.properties` et repérez la ligne qui commence par
`org.gradle.jvmargs=`. Remplacez-la par :

```
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m
```

Relancez ensuite `npm run android`. Attention : le dossier `android/` est régénéré par
`npm run prebuild`, donc cette modification est perdue si vous régénérez le dossier.

---

## 6. Utiliser l'application au quotidien (30 secondes)

Après la première compilation, ne recompilez plus. Gardez l'émulateur ouvert et lancez :

```powershell
npm start
```

Attendu :

```
Metro waiting on http://localhost:8081
```

Appuyez ensuite sur la touche `a` dans le terminal Metro : l'application s'ouvre dans
l'émulateur et se connecte automatiquement, car Expo redirige le port 8081 vers
l'émulateur avec `adb reverse`. Rien à configurer.

| Touche dans le terminal Metro | Effet |
| --- | --- |
| `r` | recharge l'application |
| `a` | ouvre l'application sur Android |
| `j` | ouvre le débogueur |
| `Ctrl+C` | arrête Metro |

Une modification de fichier est appliquée en une seconde, c'est le Fast Refresh. Vous ne
recompilez que si vous ajoutez une dépendance native, c'est-à-dire un paquet `expo-*`.

---

## 7. Vérifier en cinq points que tout fonctionne

| # | Quoi faire | Résultat attendu |
| --- | --- | --- |
| 1 | Regarder l'écran d'accueil | « Bonjour. » et trois onglets, pas d'écran blanc. |
| 2 | Chercher un bandeau d'erreur | Aucun bandeau « Stockage local indisponible » : SQLCipher est actif. |
| 3 | Onglet Réglages, puis Assistant IA | Le champ de clé API est présent, la clé n'est jamais réaffichée en clair. |
| 4 | Poser une question sans clé API | Le message reste affiché, un bandeau indique qu'aucune clé n'est enregistrée, rien n'est envoyé. |
| 5 | Arrêter Metro avec `Ctrl+C`, relancer `npm start` puis `a` | La conversation précédente est toujours là : la base locale persiste. |

Pour la biométrie sur émulateur, en option : dans l'émulateur, ouvrez Paramètres puis
Sécurité puis Empreinte digitale, définissez un code PIN et ajoutez une empreinte. Pour
simuler un toucher, utilisez `adb -e emu finger touch 1`, le numéro dépendant de l'image.

---

## 8. Route B : sans Android Studio (dépannage)

Si vous ne voulez pas installer Android Studio :

1. Fabriquez un APK avec EAS, voir `docs/GUIDE_INSTALLATION_WINDOWS.md` paragraphe D.
2. Installez un émulateur tiers capable d'installer des APK, par exemple BlueStacks.
3. Glissez l'APK dans l'émulateur.

Limites de cette route, non testées ici :

- logiciel tiers, avec publicités dans sa version gratuite ;
- pas de rechargement à chaud : chaque modification demande un nouvel APK ;
- la caméra (QR code PRONOTE) et la biométrie sont souvent inutilisables ;
- les performances dépendent de la version d'Android simulée.

Préférez la route A dès que possible.

---

## 9. Dépannage

| Message | Cause | Solution |
| --- | --- | --- |
| `Failed to resolve the Android SDK location` | `ANDROID_HOME` absente | Paragraphe 2, puis ouvrez un nouveau terminal. |
| `No devices found` ou `INSTALL_FAILED_NO_DEVICE` | émulateur arrêté | Démarrez l'émulateur, attendez l'écran d'accueil, relancez. |
| `Unsupported class file major version 65` | JDK trop récent pour Gradle | Dans Android Studio, Settings puis Build, Execution, Deployment puis Build Tools puis Gradle : choisissez le JDK 17 fourni par Android Studio. |
| `SDK location not found` | `local.properties` manquant | Relancez `npm run android`, Expo le régénère. |
| Gradle reste bloqué sur `Downloading` | réseau lent ou proxy | Attendez, ne coupez pas. Un VPN peut bloquer les dépôts Gradle. |
| `OutOfMemory` ou `Java heap space` | RAM insuffisante | Paragraphe 5, augmentez `-Xmx`. |
| Émulateur très lent | Hyper-V désactivée | Paragraphe 1. |
| Écran blanc dans l'application | Metro non joignable | Lancez `npm start` puis `a`, et gardez le terminal Metro ouvert. |
| `Stockage local indisponible` | build sans SQLCipher, dossier `android/` ancien | `npm run prebuild -- --clean` puis `npm run android`. |
| `Unable to resolve module` | dépendance native ajoutée sans recompilation | Recompilez avec `npm run android`. |
| `Port 8081 is running another process` | Metro déjà lancé ailleurs | Fermez l'autre fenêtre, ou lancez `npx expo start --port 8082`. |

---

## 10. Récapitulatif des commandes

```powershell
# une seule fois
setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk"
cd "$env:USERPROFILE\Documents\Studia"
npm install
npm run android          # 10 à 20 minutes, émulateur démarré

# tous les jours
npm start                # puis touche "a" dans le terminal
```

---

## 11. Ce que vous ne pourrez pas tester sur émulateur

- une vraie connexion PRONOTE : il faut les identifiants d'un établissement ;
- de vrais appels OpenAI : il faut votre clé et votre consentement ;
- la caméra réelle pour le QR code : l'émulateur simule une caméra, le résultat est
  aléatoire ;
- le déclenchement des tâches de fond : Android décide lui-même du calendrier.
