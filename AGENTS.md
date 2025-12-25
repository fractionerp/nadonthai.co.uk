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
Website for Nadon Thai restaurant chain (Morpeth, Newcastle, Durham).

## Access
- **Production**: https://nadonthai.co.uk
- **Local Dev**: http://localhost:8080/nadonthai

## Build Commands
```bash
# Build for local development
docker compose exec jekyll jekyll build --config _config.yml,_config_dev.yml

# Watch mode
docker compose exec jekyll jekyll build --config _config.yml,_config_dev.yml --watch
```

## Key Info
- Restaurant locations: Morpeth, Newcastle, Durham
- Social: Facebook, Instagram
