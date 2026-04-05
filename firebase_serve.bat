start /b "" cmd /c "timeout /t 8 > nul && start chrome http://localhost:5000 http://localhost:5000/admin"
firebase.cmd serve --only hosting
