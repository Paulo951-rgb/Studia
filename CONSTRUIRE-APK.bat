@echo off
chcp 65001 >nul
title Studia - Construction de l'APK
cd /d "%~dp0"
setlocal

echo ============================================================
echo   STUDIA - Construction d'une application Android (APK)
echo ============================================================
echo.
echo Cette operation utilise le service gratuit Expo EAS : votre code est
echo envoye aux serveurs d'Expo pour etre compile, puis vous recevez un lien
echo de telechargement de l'APK. Aucun identifiant PRONOTE ni cle OpenAI
echo n'est present dans le code : rien de personnel n'est envoye.
echo.

where node >nul 2>nul
if errorlevel 1 goto no_node
if not exist "node_modules" goto no_modules

echo Verification de la connexion au compte Expo...
echo.
call npx --yes eas-cli@latest whoami >nul 2>nul
if errorlevel 1 goto not_logged

echo Connecte. Verification du projet EAS...
findstr /c:"projectId" app.json >nul 2>nul
if errorlevel 1 goto need_init
goto do_build

:need_init
echo.
echo Premiere utilisation : le projet doit etre relie a un compte Expo.
echo Repondez "Y" (oui) aux questions proposees.
echo.
call npx --yes eas-cli@latest init
if errorlevel 1 goto init_failed

:do_build
echo.
echo Lancement de la compilation (profil "preview", APK installable).
echo La premiere compilation prend souvent 10 a 20 minutes.
echo Vous pouvez fermer la fenetre : la compilation continue chez Expo.
echo.
call npx --yes eas-cli@latest build --platform android --profile preview
if errorlevel 1 goto build_failed

echo.
echo ============================================================
echo   COMPILATION TERMINEE
echo ============================================================
echo.
echo 1. Le lien de telechargement de l'APK est affiche ci-dessus.
echo    Vous le retrouvez aussi sur https://expo.dev (Builds).
echo 2. Telechargez le fichier .apk sur le telephone Android.
echo 3. Ouvrez-le et autorisez l'installation depuis cette source.
echo 4. Cet APK preview fonctionne de facon autonome, sans serveur Metro.
echo    Pour recharger le code a chaud, construisez le profil development :
echo    npx eas-cli@latest build -p android --profile development
echo.
pause
exit /b 0

:not_logged
echo.
echo [ACTION REQUISE] Vous n'etes pas connecte a un compte Expo.
echo.
echo 1. Creez un compte gratuit sur https://expo.dev/signup
echo 2. Dans cette fenetre, lancez la commande suivante puis revenez ici :
echo.
echo     npx eas-cli@latest login
echo.
echo 3. Relancez CONSTRUIRE-APK.bat.
echo.
pause
exit /b 1

:init_failed
echo.
echo [ECHEC] La creation du projet EAS a echoue.
echo Verifiez votre connexion Internet et votre compte Expo, puis relancez.
echo.
pause
exit /b 1

:build_failed
echo.
echo [ECHEC] La compilation a echoue.
echo.
echo Causes les plus frequentes :
echo   - quota gratuit EAS atteint : attendez la reinitialisation ou passez
echo     a une compilation locale (voir docs/GUIDE_INSTALLATION_WINDOWS.md) ;
echo   - connexion Internet interrompue ;
echo   - jeton Expo expire : relancez "npx eas-cli@latest login".
echo Le detail de l'erreur est affiche ci-dessus et sur https://expo.dev.
echo.
pause
exit /b 1

:no_node
echo [ERREUR] Node.js est introuvable. Installez-le : https://nodejs.org/fr
echo.
pause
exit /b 1

:no_modules
echo [ERREUR] Les dependances ne sont pas installees.
echo Double-cliquez d'abord sur INSTALLER-STUDIA.bat.
echo.
pause
exit /b 1
