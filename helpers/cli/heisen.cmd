@echo off
setlocal DisableDelayedExpansion
set "HEISEN_NODE="
for %%N in ("%ProgramFiles%\nodejs\node.exe" "%ProgramFiles(x86)%\nodejs\node.exe" "%LOCALAPPDATA%\Programs\nodejs\node.exe" "%APPDATA%\npm\node.exe") do (
  if exist "%%~N" (
    "%%~N" -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)" >nul 2>nul
    if not errorlevel 1 (
      set "HEISEN_NODE=%%~N"
      goto run
    )
  )
)
echo Node.js 22 이상이 필요합니다. https://nodejs.org 1>&2
exit /b 4
:run
"%HEISEN_NODE%" "%~dp0heisen.mjs" %*
exit /b %errorlevel%
