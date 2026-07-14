# Launching primetime-org on GitHub Pages

This folder is a ready-to-push static site for the already-created, empty repo
`jeremiah9980/primetime-org`.

## 1. Push this folder to the repo

From inside this folder on your machine:

```bash
cd primetime-org
git init
git add .
git commit -m "Initial Primetime org site"
git branch -M main
git remote add origin https://github.com/jeremiah9980/primetime-org.git
git push -u origin main
```

If `git push` asks for credentials and you use HTTPS, authenticate with a GitHub personal
access token (Settings → Developer settings → Personal access tokens) instead of your
password. If you have the GitHub CLI (`gh`) installed and logged in, you can instead run
`gh repo clone jeremiah9980/primetime-org` first and copy these files into that clone.

## 2. Turn on GitHub Pages

Two options — pick one:

**A. Actions-based (recommended, already wired up):**
This repo ships `.github/workflows/pages.yml`. After your first push:
1. Go to the repo → **Settings → Pages**
2. Under "Build and deployment", set **Source** to **GitHub Actions**
3. Push to `main` (or re-run the workflow from the **Actions** tab) — it deploys automatically.

**B. Branch-based (simpler, no Actions):**
1. Go to the repo → **Settings → Pages**
2. Under "Build and deployment", set **Source** to **Deploy from a branch**
3. Branch: `main`, folder: `/ (root)` → **Save**

Either way, GitHub will give you a URL like `https://jeremiah9980.github.io/primetime-org/`.

## 3. Before you share the link

- [ ] Edit `config/org.config.json` — real location, contact emails, board names
- [ ] Edit `config/teams.config.json` — real coaches, GameChanger URLs, and rosters (the
      roster pages render straight from this file)
- [ ] Replace placeholder copy (marked in *italics*) on `board.html`, `bylaws.html`,
      `finances.html`, `policies.html`, `about.html`
- [ ] Drop a logo into `public/images/logos/` and swap the "PT" badge in the header/hero
      markup for an `<img>` tag pointing to it (search each HTML file for `pt-logo` /
      `mock-badge` and follow the pattern already used)
- [ ] Add real contact emails/social links (search for `[ENTER ...]` placeholders across
      the repo — every one should be replaced before going live)

## 4. Optional custom domain

If you want `primetimesoftball.com` (or similar) instead of the `github.io` URL:
1. Add a `CNAME` file at the repo root containing just your domain
2. Point your domain's DNS at GitHub Pages (A records to GitHub's IPs, or a CNAME record to
   `jeremiah9980.github.io`)
3. In **Settings → Pages**, enter the custom domain and check **Enforce HTTPS**
