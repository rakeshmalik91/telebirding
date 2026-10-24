winget install Schniz.fnm
# restart powershell 

fnm env --use-on-cd | Out-String | Invoke-Expression
fnm use --install-if-missing 20
Push-Location webapp
npm audit fix --force
npm install firebase
Pop-Location
npm install -g firebase-tools

Get-ExecutionPolicy -List
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

firebase login

pause
