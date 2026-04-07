# GitControl - IIS Deployment Guide

## Prerequisites

1. **IIS with required features**:
   - Internet Information Services
   - World Wide Web Services
   - Application Development Features → ASP.NET (optional for static content)
   - URL Rewrite Module 2.1 (required for SPA routing)

2. **PowerShell with Administrator privileges**

## Quick Deployment (Automated)

1. **Build the project** (already done):
   ```powershell
   npm run build
   ```

2. **Run the deployment script as Administrator**:
   ```powershell
   # Example deployment to wwwroot
   .\deploy-iis.ps1 -SiteName "GitControl" -PhysicalPath "C:\inetpub\wwwroot\GitControl" -Port 8080

   # Example deployment to custom directory
   .\deploy-iis.ps1 -SiteName "GitControl" -PhysicalPath "D:\WebSites\GitControl" -Port 80
   ```

## Manual Deployment

If you prefer manual deployment:

### Step 1: Copy Files
```powershell
# Copy the dist folder contents to your web directory
Copy-Item -Path ".\dist\*" -Destination "C:\inetpub\wwwroot\GitControl" -Recurse -Force
```

### Step 2: IIS Manager Configuration
1. Open IIS Manager
2. Create a new Application Pool:
   - Name: `GitControlPool`
   - .NET CLR Version: `No Managed Code`
3. Create a new Website:
   - Site name: `GitControl`
   - Application pool: `GitControlPool`
   - Physical path: `C:\inetpub\wwwroot\GitControl`
   - Port: `80` (or your preferred port)

## Important Notes

### URL Rewrite Module
The `web.config` file is configured to handle client-side routing. Install the URL Rewrite Module:
- Download from: https://www.iis.net/downloads/microsoft/url-rewrite
- Or install via Web Platform Installer

### Security Considerations
1. **HTTPS**: Configure SSL certificate for production
2. **CORS**: Update your GitLab API calls if needed for cross-origin requests
3. **Authentication**: Consider IIS authentication if needed

### Troubleshooting

**404 Errors on Refresh**:
- Ensure URL Rewrite Module is installed
- Verify `web.config` is in the root directory
- Check IIS logs at `C:\inetpub\logs\LogFiles`

**Static Files Not Loading**:
- Check MIME types in IIS
- Verify file permissions on the physical directory
- Ensure the Application Pool identity has read access

**GitLab API Connection Issues**:
- Check CORS settings on your GitLab instance
- Verify network connectivity from the IIS server
- Update API endpoints if needed for your environment

## Directory Structure After Deployment
```
C:\inetpub\wwwroot\GitControl\
├── index.html
├── web.config
├── vite.svg
└── assets/
    ├── index-[hash].css
    └── index-[hash].js
```

## Access Your Application
- Local: `http://localhost:[port]`
- Network: `http://[server-ip]:[port]`

## Production Recommendations
1. Enable HTTPS with SSL certificate
2. Configure proper backup procedures
3. Set up monitoring and logging
4. Consider using IIS URL Rewrite for additional security headers
5. Regular security updates for IIS and Windows Server