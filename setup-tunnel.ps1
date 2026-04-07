# GitControl Cloudflare Tunnel Setup Script
# Run this script as Administrator

param(
    [Parameter(Mandatory=$true)]
    [string]$TunnelName = "gitcontrol-tunnel",
    
    [Parameter(Mandatory=$false)]
    [string]$Domain = "",
    
    [Parameter(Mandatory=$false)]
    [switch]$InstallCloudflared = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$QuickSetup = $false
)

Write-Host "GitControl Cloudflare Tunnel Setup" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green

# Check if running as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "Please run this script as Administrator!"
    exit 1
}

# Install cloudflared if requested
if ($InstallCloudflared) {
    Write-Host "Installing cloudflared..." -ForegroundColor Yellow
    
    # Check if Chocolatey is installed
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        choco install cloudflared -y
    } else {
        Write-Host "Chocolatey not found. Please install cloudflared manually from:" -ForegroundColor Red
        Write-Host "https://github.com/cloudflare/cloudflared/releases" -ForegroundColor Red
        exit 1
    }
}

# Quick setup with temporary tunnel
if ($QuickSetup) {
    Write-Host "Starting quick setup with temporary tunnel..." -ForegroundColor Yellow
    Write-Host "This will give you a temporary URL to share immediately." -ForegroundColor Yellow
    
    # Start the application
    Write-Host "Starting GitControl application..." -ForegroundColor Blue
    Start-Process powershell -ArgumentList "-Command", "cd '$PWD'; npm run tunnel:dev" -WindowStyle Normal
    
    # Wait a bit for the app to start
    Start-Sleep -Seconds 5
    
    # Start temporary tunnel
    Write-Host "Starting Cloudflare tunnel..." -ForegroundColor Blue
    Write-Host "A temporary URL will be displayed. Share this with your peers." -ForegroundColor Green
    cloudflared tunnel --url http://localhost:3000
    
    exit 0
}

# Full setup
Write-Host "Starting full Cloudflare Tunnel setup..." -ForegroundColor Yellow

# Check if cloudflared is installed
if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Error "cloudflared is not installed. Run with -InstallCloudflared flag or install manually."
    exit 1
}

# Authenticate with Cloudflare
Write-Host "Please authenticate with Cloudflare..." -ForegroundColor Blue
cloudflared tunnel login

if ($LASTEXITCODE -ne 0) {
    Write-Error "Authentication failed. Please check your Cloudflare account."
    exit 1
}

# Create tunnel
Write-Host "Creating tunnel '$TunnelName'..." -ForegroundColor Blue
$tunnelOutput = cloudflared tunnel create $TunnelName
$tunnelId = ($tunnelOutput | Select-String -Pattern "Created tunnel .* with id (.{8}-.{4}-.{4}-.{4}-.{12})").Matches.Groups[1].Value

if (-not $tunnelId) {
    Write-Error "Failed to create tunnel. Please check the output above."
    exit 1
}

Write-Host "Tunnel created successfully with ID: $tunnelId" -ForegroundColor Green

# Setup DNS if domain provided
if ($Domain) {
    Write-Host "Setting up DNS for domain '$Domain'..." -ForegroundColor Blue
    cloudflared tunnel route dns $TunnelName $Domain
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "DNS configured successfully for $Domain" -ForegroundColor Green
    } else {
        Write-Warning "DNS setup failed. You may need to configure it manually in Cloudflare Dashboard."
    }
}

# Update configuration file
Write-Host "Updating tunnel configuration..." -ForegroundColor Blue

$configPath = "$env:USERPROFILE\.cloudflared"
if (-not (Test-Path $configPath)) {
    New-Item -ItemType Directory -Force -Path $configPath | Out-Null
}

$configContent = @"
tunnel: $tunnelId
credentials-file: $configPath\$tunnelId.json

ingress:
  - hostname: $(if ($Domain) { $Domain } else { "YOUR_DOMAIN_HERE" })
    service: http://localhost:3000
  - service: http_status:404
"@

$configContent | Out-File -FilePath "$configPath\config.yml" -Encoding UTF8

Write-Host "Configuration saved to: $configPath\config.yml" -ForegroundColor Green

# Create start script
$startScript = @"
@echo off
echo Starting GitControl with Cloudflare Tunnel...
echo.
echo Starting application...
start "GitControl App" powershell -Command "cd /d '$PWD' && npm run tunnel:prod"
echo.
echo Starting tunnel...
timeout /t 5 > nul
cloudflared tunnel run $TunnelName
"@

$startScript | Out-File -FilePath "start-tunnel.bat" -Encoding ASCII

Write-Host "Created start-tunnel.bat for easy launching" -ForegroundColor Green

# Display next steps
Write-Host "`nSetup completed successfully!" -ForegroundColor Green
Write-Host "=========================" -ForegroundColor Green
Write-Host "Tunnel ID: $tunnelId" -ForegroundColor White
Write-Host "Configuration: $configPath\config.yml" -ForegroundColor White

if ($Domain) {
    Write-Host "URL: https://$Domain" -ForegroundColor White
} else {
    Write-Host "Please update your DNS settings in Cloudflare Dashboard" -ForegroundColor Yellow
}

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Run: npm run tunnel:prod (in one terminal)" -ForegroundColor White
Write-Host "2. Run: cloudflared tunnel run $TunnelName (in another terminal)" -ForegroundColor White
Write-Host "   OR use the created start-tunnel.bat file" -ForegroundColor White

if (-not $Domain) {
    Write-Host "`nTo configure DNS manually:" -ForegroundColor Yellow
    Write-Host "1. Go to Cloudflare Dashboard → DNS" -ForegroundColor White
    Write-Host "2. Add CNAME record: yourdomain.com → $tunnelId.cfargotunnel.com" -ForegroundColor White
}

Write-Host "`nFor immediate testing with temporary URL:" -ForegroundColor Cyan
Write-Host "Run: .\setup-tunnel.ps1 -QuickSetup" -ForegroundColor White