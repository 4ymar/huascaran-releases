@echo off
title Huascaran V1 - Iniciando...
color 0A

where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo  ERROR: Node.js no esta instalado.
    echo  Instale desde https://nodejs.org/
    pause
    exit /b 1
)

if not exist "%~dp0server\package.json" (
    color 0C
    echo  ERROR: No se encontro server\package.json
    pause
    exit /b 1
)

if not exist "%~dp0client\package.json" (
    color 0C
    echo  ERROR: No se encontro client\package.json
    pause
    exit /b 1
)

echo  Iniciando aplicacion de escritorio...
cd /d "%~dp0"
start "" wscript.exe "%~dp0launcher_invisible.vbs"
exit