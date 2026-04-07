# GitControl IIS Deployment Script
# Run this script as Administrator

param(
    [Parameter(Mandatory=$true)]
    [string]$SiteName = "GitControl",
    
    [Parameter(Mandatory=$true)] 
    [string]$PhysicalPath,
    
    [Parameter(Mandatory=$false)]
    [int]$Port = 80,
    
    [Parameter(Mandatory=$false)]
    [string]$ApplicationPool = "GitControlPool"
)

# Check if running as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "This script must be run as Administrator. Please run PowerShell as Administrator and try again."
    exit 1
}

# Import WebAdministration module
Import-Module WebAdministration -ErrorAction SilentlyContinue
if (-not (Get-Module WebAdministration)) {
    Write-Error "IIS WebAdministration module not found. Please ensure IIS is installed."
    exit 1
}

Write-Host "Starting IIS deployment for GitControl..." -ForegroundColor Green

try {
    # Create Application Pool if it doesn't exist
    $appPool = Get-IISAppPool -Name $ApplicationPool -ErrorAction SilentlyContinue
    if (-not $appPool) {
        Write-Host "Creating Application Pool: $ApplicationPool" -ForegroundColor Yellow
        New-WebAppPool -Name $ApplicationPool -Force
        Set-ItemProperty -Path "IIS:\AppPools\$ApplicationPool" -Name processModel.identityType -Value ApplicationPoolIdentity
        Set-ItemProperty -Path "IIS:\AppPools\$ApplicationPool" -Name managedRuntimeVersion -Value ""  # No Managed Code for static content
    } else {
        Write-Host "Application Pool $ApplicationPool already exists" -ForegroundColor Yellow
    }

    # Stop the application pool (with better error handling)
    Write-Host "Stopping Application Pool: $ApplicationPool" -ForegroundColor Yellow
    $appPoolState = Get-WebAppPoolState -Name $ApplicationPool -ErrorAction SilentlyContinue
    if ($appPoolState -and $appPoolState.Value -ne "Stopped") {
        Stop-WebAppPool -Name $ApplicationPool -ErrorAction SilentlyContinue
        # Wait a moment for the app pool to fully stop
        Start-Sleep -Seconds 2
    }

    # Remove existing site if it exists
    if (Get-Website -Name $SiteName -ErrorAction SilentlyContinue) {
        Write-Host "Removing existing site: $SiteName" -ForegroundColor Yellow
        Remove-Website -Name $SiteName
    }

    # Create the physical directory if it doesn't exist
    if (-not (Test-Path $PhysicalPath)) {
        Write-Host "Creating directory: $PhysicalPath" -ForegroundColor Yellow
        New-Item -ItemType Directory -Path $PhysicalPath -Force
    }

    # Copy built files to deployment directory
    $SourcePath = Join-Path (Get-Location) "dist"
    if (Test-Path $SourcePath) {
        Write-Host "Copying files from $SourcePath to $PhysicalPath" -ForegroundColor Yellow
        Copy-Item -Path "$SourcePath\*" -Destination $PhysicalPath -Recurse -Force
    } else {
        Write-Error "Build directory not found at $SourcePath. Please run 'npm run build' first."
        exit 1
    }

    # Create the website
    Write-Host "Creating IIS Site: $SiteName" -ForegroundColor Yellow
    New-Website -Name $SiteName -PhysicalPath $PhysicalPath -Port $Port -ApplicationPool $ApplicationPool

    # Start the application pool (with better error handling)
    Write-Host "Starting Application Pool: $ApplicationPool" -ForegroundColor Yellow
    try {
        Start-WebAppPool -Name $ApplicationPool -ErrorAction Stop
        # Wait a moment and verify it started
        Start-Sleep -Seconds 2
        $finalState = Get-WebAppPoolState -Name $ApplicationPool -ErrorAction SilentlyContinue
        Write-Host "Application Pool final state: $($finalState.Value)" -ForegroundColor Green
    } catch {
        Write-Warning "Could not start application pool automatically: $($_.Exception.Message)"
        Write-Host "You may need to start it manually in IIS Manager" -ForegroundColor Yellow
    }

    Write-Host "Deployment completed successfully!" -ForegroundColor Green
    Write-Host "Site URL: http://localhost:$Port" -ForegroundColor Cyan
    Write-Host "Physical Path: $PhysicalPath" -ForegroundColor Cyan

} catch {
    Write-Error "Deployment failed: $($_.Exception.Message)"
    exit 1
}