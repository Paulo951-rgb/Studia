@echo off
chcp 65001 >nul
title Studia - Apercu PC
cd /d "%~dp0"
if not exist "pc-preview\index.html" (
  echo [ERREUR] Fichier pc-preview\index.html introuvable.
  pause
  exit /b 1
)
echo.
echo ================================================
echo   STUDIA - APERCU PC HORS LIGNE
echo ================================================
echo.
echo Cette version est une demonstration interactive.
echo Les donnees sont fictives : aucune connexion PRONOTE
echo ni aucun appel OpenAI n'est effectue.
echo.
start "" "%~dp0pc-preview\index.html"
exit /b 0
