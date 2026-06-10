# expose_network.ps1 - Expose Moroccan Dama to Local Network
# IMPORTANT: Run this script in an Administrator PowerShell window!

# The current WSL2 IP address we retrieved
$wslIp = "172.23.14.222"
$localIp = "192.168.80.203"

Write-Host "=============================================" -ForegroundColor Green
Write-Host "   EXPOSING WSL PORTS TO WINDOWS LOCAL LAN   " -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host "Target WSL IP: $wslIp" -ForegroundColor Yellow
Write-Host "Your Host IP: $localIp" -ForegroundColor Yellow
Write-Host ""

# 1. Set up Port Proxying (Forward traffic from Windows to WSL)
Write-Host "[1/2] Setting up port proxying..." -ForegroundColor Cyan
netsh interface portproxy add v4tov4 listenport=5173 listenaddress=0.0.0.0 connectport=5173 connectaddress=$wslIp
netsh interface portproxy add v4tov4 listenport=8090 listenaddress=0.0.0.0 connectport=8090 connectaddress=$wslIp
Write-Host "✔ Port proxy configured: 5173 and 8090 mapped to WSL." -ForegroundColor Green
Write-Host ""

# 2. Add Inbound Firewall Rules
Write-Host "[2/2] Setting up Windows Firewall rules..." -ForegroundColor Cyan
# Clean up old rules if they exist
Remove-NetFirewallRule -DisplayName "Dama Game Vite" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "Dama Game Docker" -ErrorAction SilentlyContinue

# Add new rules
New-NetFirewallRule -DisplayName "Dama Game Vite" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow -Enabled True | Out-Null
New-NetFirewallRule -DisplayName "Dama Game Docker" -Direction Inbound -LocalPort 8090 -Protocol TCP -Action Allow -Enabled True | Out-Null
Write-Host "✔ Firewall rules added to allow inbound local traffic on 5173 and 8090." -ForegroundColor Green
Write-Host ""

Write-Host "=============================================" -ForegroundColor Green
Write-Host "Setup Completed! You can now access the game from other devices on your Wi-Fi:" -ForegroundColor Green
Write-Host "👉 Dev Server URL  : http://$($localIp):5173/" -ForegroundColor Yellow
Write-Host "👉 Docker App URL  : http://$($localIp):8090/" -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Green
