@echo off
rem Sobe o JARVIS inteiro: servidor de voz (janela separada) + painel em http://localhost:3100
rem Uso: duplo clique, ou  .\jarvis.cmd  no terminal.
cd /d "%~dp0"
set "PATH=%LOCALAPPDATA%\Programs\nodejs;%APPDATA%\npm;%PATH%"
npm.cmd run jarvis
