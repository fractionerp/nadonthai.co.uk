# AI Agent Instructions

## Git Workflow

**MANDATORY: Check for uncommitted changes at the START of each new task:**
```bash
git status --short
```

If uncommitted changes exist from a previous task:
1. **Same topic**: Continue working, commit when fully complete
2. **New topic**: Ask user whether to commit, stash, or discard previous changes

**Commit only when complete:**
- Fix is **verified working** (tested)
- Feature is **complete** (not partial)
- Tests pass (if applicable)

**Commit command:**
```bash
git add -A && git commit -m "prefix: description" && git push
```

**Commit prefixes:**
- `fix:` - Bug fixes
- `feat:` - New features
- `refactor:` - Code improvements
- `style:` - UI/CSS changes
- `docs:` - Documentation
- `test:` - Test changes

**Commit message format:**
- Use imperative mood ("add feature" not "added feature")
- Keep first line under 72 characters
- Include summary of what changed and why

---

# Nadon Thai Restaurant Site - Jekyll

## Overview
Website for Nadon Thai restaurant chain (Morpeth, Newcastle, Durham). Built with Jekyll, deployed to GitHub Pages.

## Access
- **Production**: https://nadonthai.co.uk
- **Local Dev**: https://tenx.fraction.app/nadonthai.co.uk/
- **Build Output**: `/home/dev/tenx/apps/websites/nadonthai.co.uk/_site/`

## Important: Two Configuration Files

### `_config.yml` (Production) - DO NOT modify for local dev
- `url: "https://nadonthai.co.uk"`
- `baseurl: ""`

### `_config_dev.yml` (Development) - Use for local dev
- `url: "https://tenx.fraction.app"`
- `baseurl: "/nadonthai.co.uk"`

## Building the Site

**IMPORTANT: After making ANY changes, you MUST rebuild:**

```bash
# Build with dev config for local testing
docker exec websites_jekyll bash -c "cd /srv/nadonthai.co.uk && jekyll build --config _config.yml,_config_dev.yml"

# Verify build
curl -I https://tenx.fraction.app/nadonthai.co.uk/
```

## Key Info
- Restaurant locations: Morpeth, Newcastle, Durham
- Social: Facebook, Instagram
- Use `{{ site.baseurl }}/assets/...` for all asset paths
