@echo off
REM This script will backup the data uploaded from admin to firebase storage to local
REM It includes webapp/resources/data/* and webapp/resources/images/*
REM It will also remove any unreferenced images from local images folder

cd /d "%~dp0.."
python "%~dp0backup.py" %*
timeout /t 10