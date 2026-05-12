@echo off
setlocal
cd /d "%~dp0"

echo ===========================================================
echo  Sistema Presenze - avvio locale offline
echo ===========================================================

where node >nul 2>nul
if errorlevel 1 (
  echo ERRORE: Node.js non risulta installato o non e' nel PATH.
  echo Installa Node.js 18 o superiore, poi riapri questo file.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installazione dipendenze in corso...
  call npm install
  if errorlevel 1 (
    echo ERRORE: npm install non riuscito.
    pause
    exit /b 1
  )
)

echo Configuro, se possibile, il firewall Windows per la porta 3001...
netsh advfirewall firewall show rule name="Presenze Offline 3001" >nul 2>nul
if errorlevel 1 (
  netsh advfirewall firewall add rule name="Presenze Offline 3001" dir=in action=allow protocol=TCP localport=3001 >nul 2>nul
  if errorlevel 1 (
    echo ATTENZIONE: firewall non modificato. Se il tablet va in timeout, esegui questo file come Amministratore.
  ) else (
    echo Firewall OK: porta 3001 aperta in ingresso.
  )
) else (
  echo Firewall OK: regola gia' presente.
)

echo.
echo Avvio applicazione. NON chiudere questa finestra.
echo Quando compare "Presenze server attivo", apri:
echo   - questo PC: http://localhost:3001/
echo   - tablet: usa uno degli URL LAN stampati dal server
echo.
call npm start

echo.
echo Server terminato.
pause