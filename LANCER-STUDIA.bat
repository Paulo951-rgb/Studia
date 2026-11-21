@echo off
chcp 65001 >nul
title Studia - Demarrage
cd /d "%~dp0"
setlocal

echo ============================================================
echo   STUDIA - Demarrage du serveur de developpement
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto no_node
if not exist "node_modules" goto no_modules

echo Que voulez-vous faire ?
echo.
echo   [1] Demarrer le serveur Metro (l'APK de developpement est deja
echo       installe sur votre telephone). C'est le choix normal.
echo   [2] Compiler et installer directement sur un telephone branche en USB
echo       (necessite Android Studio et le SDK Android sur ce PC).
echo   [3] Quitter.
echo.
set /p CHOIX="Votre choix (1, 2 ou 3) : "

if "%CHOIX%"=="1" goto start_metro
if "%CHOIX%"=="2" goto run_usb
if "%CHOIX%"=="3" exit /b 0
echo Choix non reconnu.
goto end_pause

:start_metro
echo.
echo Demarrage de Metro. Gardez cette fenetre ouverte pendant les tests.
echo.
echo Sur le telephone : ouvrez l'application Studia installee par
echo CONSTRUIRE-APK.bat, elle se connecte au serveur automatiquement.
echo Si elle demande une adresse, utilisez celle affichee ci-dessous.
echo Pour arreter : Ctrl+C dans cette fenetre.
echo.
call npx expo start --dev-client
goto end_pause

:run_usb
echo.
echo Verification du telephone...
where adb >nul 2>nul
if errorlevel 1 goto no_adb
echo.
echo Compilation locale (la premiere fois prend 10 a 20 minutes).
echo Activez le debogage USB sur le telephone et acceptez la demande.
echo.
call npm run android
goto end_pause

:no_adb
echo [ERREUR] adb est introuvable : Android Studio / le SDK Android ne
echo semblent pas installes sur ce PC.
echo.
echo Utilisez plutot l'option 1 avec un APK genere par CONSTRUIRE-APK.bat,
echo ou installez Android Studio : https://developer.android.com/studio
echo.
goto end_pause

:no_node
echo [ERREUR] Node.js est introuvable. Installez-le : https://nodejs.org/fr
echo.
goto end_pause

:no_modules
echo [ERREUR] Les dependances ne sont pas installees.
echo.
echo Double-cliquez d'abord sur INSTALLER-STUDIA.bat.
echo.
goto end_pause

:end_pause
echo.
pause
exit /b 0
