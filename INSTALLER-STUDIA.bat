@echo off
chcp 65001 >nul
title Studia - Installation
cd /d "%~dp0"
setlocal

echo ============================================================
echo   STUDIA - Installation des dependances
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto no_node
where npm >nul 2>nul
if errorlevel 1 goto no_npm

for /f "tokens=1 delims=v." %%a in ('node -v') do set NODE_MAJOR=%%a

echo Node.js : 
node -v
echo npm     : 
call npm -v
echo.

if not defined NODE_MAJOR goto no_node
if %NODE_MAJOR% LSS 20 goto node_old

if exist "node_modules" goto have_modules
echo Aucun dossier node_modules : installation complete des dependances.
echo Cela peut prendre quelques minutes la premiere fois.
echo.
call npm install --no-audit --no-fund
if errorlevel 1 goto install_failed
goto install_done

:have_modules
echo Dependances deja presentes : verification rapide (sans tout reinstaller).
echo.
call npm install --prefer-offline --no-audit --no-fund
if errorlevel 1 goto install_failed

:install_done
echo.
echo ============================================================
echo   Installation terminee.
echo ============================================================
echo.
echo Prochaines etapes :
echo   1. Double-cliquez sur TESTER-STUDIA.bat pour verifier le projet.
echo   2. Double-cliquez sur CONSTRUIRE-APK.bat pour obtenir une application
echo      Android installable sur votre telephone.
echo   3. Une fois l'APK installe, LANCER-STUDIA.bat demarre le serveur de
echo      developpement pour recharger l'application a chaud.
echo.
echo Aucune donnee personnelle n'a ete demandee ni envoyee.
echo.
pause
exit /b 0

:no_node
echo [ERREUR] Node.js n'est pas installe ou n'est pas accessible.
echo.
echo Installez Node.js version LTS depuis https://nodejs.org/fr
echo Cochez "Add to PATH" pendant l'installation, puis redemarrez ce script.
echo.
pause
exit /b 1

:no_npm
echo [ERREUR] npm est introuvable alors que Node.js semble present.
echo.
echo Reinstallez Node.js depuis https://nodejs.org/fr (npm est inclus).
echo.
pause
exit /b 1

:node_old
echo [ERREUR] Node.js est trop ancien (version detectee : major %NODE_MAJOR%).
echo.
echo Studia demande Node.js 20 ou plus recent. Installez la version LTS :
echo https://nodejs.org/fr
echo.
pause
exit /b 1

:install_failed
echo.
echo [ERREUR] L'installation des dependances a echoue.
echo.
echo Verifiez votre connexion Internet, puis relancez ce script.
echo Si le message parle de "EACCES" ou de droits d'administrateur,
echo ouvrez le dossier dans un terminal et lancez : npm install
echo.
pause
exit /b 1
