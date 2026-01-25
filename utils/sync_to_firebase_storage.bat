REM this script will upload missing data/site-data.json, data/places.json and featured-images/* to Firebase Storage
REM it will also scan index.html for featured images and prompt to delete any files under featured-images/ that are not referenced (asks per-file confirmation)

@echo off

REM Ensure Google Cloud credentials are available
echo Checking Google Cloud credentials...
if defined GOOGLE_APPLICATION_CREDENTIALS (
  echo Using GOOGLE_APPLICATION_CREDENTIALS=%GOOGLE_APPLICATION_CREDENTIALS%
) else (
  if exist "%~dp0..\service-account.json" (
    echo Found service account at "%~dp0..\service-account.json"
    set "GOOGLE_APPLICATION_CREDENTIALS=%~dp0..\service-account.json"
  ) else (
    REM If ADC (Application Default Credentials) file exists, skip interactive login/setup
    set "ADC=%APPDATA%\gcloud\application_default_credentials.json"
    if exist "%ADC%" (
      echo Found ADC at %ADC%; skipping interactive login/setup.
    ) else (
      if exist "%~dp0service-account.json" (
        echo Found service account at "%~dp0service-account.json"
        set "GOOGLE_APPLICATION_CREDENTIALS=%~dp0service-account.json"
      ) else (
        where gcloud >nul 2>&1
        if %ERRORLEVEL%==0 (
          echo No service account found. Running 'gcloud auth application-default login' to set up credentials...
          call gcloud auth application-default login
        ) else (
          echo.
          echo 'gcloud' not found. Attempting to download and run the Google Cloud SDK installer...
          powershell -NoProfile -Command "(New-Object System.Net.WebClient).DownloadFile('https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe', \"$env:Temp\\GoogleCloudSDKInstaller.exe\")"
          start /wait "" "%Temp%\GoogleCloudSDKInstaller.exe"
          where gcloud >nul 2>&1
          if %ERRORLEVEL%==0 (
            echo 'gcloud' installed successfully. Running 'gcloud auth application-default login'...
            call gcloud auth application-default login
          ) else (
            echo.
            echo WARNING: Failed to install gcloud. Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON file or install Google Cloud SDK and run 'gcloud auth application-default login'.
            pause
          )
        )
      )
    )
  )
)

REM Verify Application Default Credentials are available
set "ADC=%APPDATA%\gcloud\application_default_credentials.json"
if exist "%ADC%" (
  echo Found ADC at %ADC%
) else (
  echo Checking with 'gcloud auth application-default print-access-token'...
  call gcloud auth application-default print-access-token >nul 2>&1
  if %ERRORLEVEL%==0 (
    echo Application Default Credentials appear to be available.
  ) else (
    echo ERROR: Application Default Credentials not found. Please run 'gcloud auth application-default login' and try again.
    pause
    exit /b 1
  )
)

REM Ensure required Python packages are installed
echo Checking for required Python packages...
python -c "import importlib.util,sys; sys.exit(0 if importlib.util.find_spec('google.cloud.storage') else 1)"
if %ERRORLEVEL%==0 (
  echo google-cloud-storage already installed; skipping installation.
) else (
  echo Installing google-cloud-storage...
  python -m pip install --upgrade pip
  python -m pip install google-cloud-storage
)

REM Upload missing data/site-data.json, data/places.json and featured-images/* to Firebase Storage
REM Upload missing data/site-data.json, data/places.json and featured-images/* to Firebase Storage
python "%~dp0sync_static_files_to_firebase_storage.py"

REM Upload bird/insect data (only changed files unless -f is passed)
echo.
echo Syncing bird/insect data...
python "%~dp0sync_dynamic_files_to_firebase_storage.py" %*
