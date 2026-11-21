@echo off
chcp 65001 >nul
title Studia - Tests
cd /d "%~dp0"
setlocal

echo ============================================================
echo   STUDIA - Verification du projet (types + tests)
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto no_node
if not exist "node_modules" goto no_modules

echo Etape 1/2 : verification des types TypeScript...
echo.
call npx tsc --noEmit
if errorlevel 1 goto typecheck_failed
call npx tsc -p tsconfig.test.json
if errorlevel 1 goto typecheck_failed
echo Types OK.
echo.

echo Etape 2/2 : execution des tests (unites, integration, securite)...
echo.
call npm test
if errorlevel 1 goto tests_failed

echo.
echo ============================================================
echo   TOUT EST VERT : types OK et tests OK.
echo ============================================================
echo.
echo Ces tests tournent sur ce PC, sans telephone. Ils ne remplacent pas
echo un essai sur un vrai appareil : voir docs/GUIDE_TESTS.md.
echo.
pause
exit /b 0

:typecheck_failed
echo.
echo [ECHEC] La verification des types a signale une erreur.
echo Lisez le message ci-dessus : il indique le fichier et la ligne.
echo.
pause
exit /b 1

:tests_failed
echo.
echo [ECHEC] Au moins un test a echoue.
echo Lisez les lignes precedees de "not ok" pour identifier le test concerne.
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
