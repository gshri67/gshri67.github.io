# Cloudflare Tunnel Setup for GitControl

This guide will help you configure Cloudflare Tunnel to share your GitControl application with peers securely.

## Prerequisites

1. A Cloudflare account (free tier is sufficient)
2. A domain managed by Cloudflare (or use Cloudflare's free subdomain)
3. PowerShell with Administrator privileges

## Step 1: Install Cloudflare Tunnel (cloudflared)

### Option A: Using Chocolatey (Recommended)
```powershell
# Install Chocolatey if not already installed
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install cloudflared
choco install cloudflared
```

### Option B: Manual Installation
1. Download cloudflared from: https://github.com/cloudflare/cloudflared/releases
2. Extract to a folder in your PATH (e.g., `C:\Program Files\cloudflared\`)
3. Add the folder to your system PATH

## Step 2: Authenticate with Cloudflare

```powershell
# This will open a browser window to authenticate
cloudflared tunnel login
```

## Step 3: Create a Tunnel

```powershell
# Replace 'gitcontrol-tunnel' with your preferred tunnel name
cloudflared tunnel create gitcontrol-tunnel
```

**Save the Tunnel ID** that is displayed - you'll need it later.

## Step 4: Configure DNS

### Option A: Using Cloudflare Dashboard
1. Go to Cloudflare Dashboard → DNS
2. Add a CNAME record:
   - Name: `gitcontrol` (or your preferred subdomain)
   - Target: `YOUR_TUNNEL_ID.cfargotunnel.com`
   - Proxy status: Proxied (orange cloud)

### Option B: Using CLI
```powershell
# Replace with your domain and tunnel ID
cloudflared tunnel route dns gitcontrol-tunnel gitcontrol.yourdomain.com
```

## Step 5: Update Configuration File

1. Edit `cloudflare-tunnel.yml` in this project directory
2. Replace the placeholder values:
   - `YOUR_TUNNEL_ID_HERE` → Your actual tunnel ID
   - `YOUR_DOMAIN_HERE.YOUR_SUBDOMAIN.workers.dev` → Your chosen domain/subdomain
   - Update the credentials file path to match your system

## Step 6: Copy Configuration to Cloudflare Directory

```powershell
# Create cloudflared config directory if it doesn't exist
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.cloudflared"

# Copy your configuration
Copy-Item ".\cloudflare-tunnel.yml" "$env:USERPROFILE\.cloudflared\config.yml"
```

## Step 7: Start Your Application and Tunnel

### For Development (with hot reload):
```powershell
# Terminal 1: Start the application
npm run tunnel:dev

# Terminal 2: Start the tunnel
cloudflared tunnel run gitcontrol-tunnel
```

### For Production:
```powershell
# Terminal 1: Build and serve the application
npm run tunnel:prod

# Terminal 2: Start the tunnel
cloudflared tunnel run gitcontrol-tunnel
```

## Step 8: Install Tunnel as Windows Service (Optional)

To run the tunnel automatically on system startup:

```powershell
# Run as Administrator
cloudflared service install
```

## Accessing Your Application

Once configured, your GitControl application will be accessible at:
- `https://gitcontrol.yourdomain.com` (or your configured subdomain)

## Security Considerations

1. **Authentication**: Consider adding Cloudflare Access for additional security
2. **Rate Limiting**: Configure rate limiting in Cloudflare Dashboard
3. **Firewall Rules**: Set up firewall rules to block unwanted traffic

## Troubleshooting

### Common Issues:

1. **Tunnel not connecting:**
   ```powershell
   # Check tunnel status
   cloudflared tunnel info gitcontrol-tunnel
   ```

2. **DNS not resolving:**
   - Verify DNS records in Cloudflare Dashboard
   - Wait up to 5 minutes for DNS propagation

3. **Application not accessible:**
   - Ensure your app is running on `localhost:3000`
   - Check Windows Firewall settings
   - Verify the tunnel configuration file

### Useful Commands:

```powershell
# List all tunnels
cloudflared tunnel list

# Check tunnel status
cloudflared tunnel info TUNNEL_NAME

# Test tunnel configuration
cloudflared tunnel ingress validate

# View tunnel logs
cloudflared tunnel run --loglevel debug TUNNEL_NAME
```

## Alternative: Quick Setup with Free Cloudflare Domain

If you don't have your own domain, you can use Cloudflare's free `trycloudflare.com` subdomain:

```powershell
# Start application
npm run tunnel:dev

# In another terminal - this gives you a temporary URL
cloudflared tunnel --url http://localhost:3000
```

This will provide a temporary URL like: `https://random-words.trycloudflare.com`

## Sharing with Peers

Once configured, share the URL with your team members. They'll be able to access your GitControl application from anywhere with internet access.

**Note**: Make sure to configure your GitLab settings appropriately since peers will be using your GitLab access tokens through the application.