winget install Schniz.fnm
# restart powershell 

fnm env --use-on-cd | Out-String | Invoke-Expression
fnm use --install-if-missing 20
npm audit fix --force
npm install firebase
npm install -g firebase-tools

Get-ExecutionPolicy -List
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

firebase login

pause
