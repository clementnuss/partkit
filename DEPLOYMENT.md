# Deployment Guide

## Quick Start

1. **Push to GitHub**
```bash
git add .
git commit -m "Add GitHub Pages deployment"
git push origin main
```

2. **Enable GitHub Pages**
   - Go to: https://github.com/clementnuss/music-pdf-toolkit/settings/pages
   - Under "Source", select: **GitHub Actions**
   - The workflow will run automatically on push

3. **Wait for deployment** (~1-2 minutes)
   - Check workflow status: https://github.com/clementnuss/music-pdf-toolkit/actions
   - Once complete, your site will be live at:
     **https://clementnuss.github.io/music-pdf-toolkit/**

## Custom Domain Setup (music.n8r.ch)

### Step 1: Configure GitHub Pages

1. Go to repository settings → Pages
2. Under "Custom domain", enter: `music.n8r.ch`
3. Click "Save"

### Step 2: Configure DNS

Add a CNAME record in your DNS provider (wherever n8r.ch is hosted):

```
Type:  CNAME
Name:  music
Value: clementnuss.github.io
TTL:   3600 (or Auto)
```

**Example for common DNS providers:**

**Cloudflare:**
```
Type:     CNAME
Name:     music
Target:   clementnuss.github.io
Proxy:    DNS only (gray cloud)
```

**AWS Route 53:**
```
Record name: music.n8r.ch
Record type: CNAME
Value:       clementnuss.github.io
```

### Step 3: Wait for DNS propagation

- Usually takes 5-30 minutes
- Check status: `dig music.n8r.ch` or https://www.whatsmydns.net/

### Step 4: Enable HTTPS

1. Once DNS propagates, GitHub will show "DNS check successful"
2. Check "Enforce HTTPS" (GitHub auto-provisions SSL certificate)
3. Wait ~15 minutes for certificate to activate

Your site will now be live at: **https://music.n8r.ch** 🎉

## Troubleshooting

### Build fails
- Check workflow logs: https://github.com/clementnuss/music-pdf-toolkit/actions
- Ensure `package.json` and `vite.config.js` are committed
- Try building locally: `npm run build`

### 404 errors on GitHub Pages
- Ensure "Source" is set to "GitHub Actions" (not "Deploy from a branch")
- Check that workflow completed successfully
- Clear browser cache

### Custom domain not working
- Verify CNAME record: `dig music.n8r.ch`
- Ensure CNAME points to `clementnuss.github.io` (NOT `clementnuss.github.io/music-pdf-toolkit`)
- Wait longer for DNS propagation (can take up to 48h in rare cases)

### HTTPS certificate pending
- Ensure DNS is fully propagated first
- GitHub needs to verify domain ownership before issuing certificate
- Can take up to 24h in some cases

## Manual Build & Preview

```bash
# Build locally
npm run build

# Preview the production build
npx vite preview
```

## Updating the Site

Just push to main:

```bash
git add .
git commit -m "Update features"
git push origin main
```

GitHub Actions will automatically rebuild and redeploy! ✨
