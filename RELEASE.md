# Release Process

This document describes the automated release process for Komodo MCP Server.

## 🎯 Overview

Releases are **fully automated** via GitHub Actions when the version in `package.json` changes on the `main` branch.

## 🚀 Quick Release Guide

### Step-by-Step

1. **Create Feature Branch**
   ```bash
   git checkout main
   git pull
   git checkout -b feature/my-awesome-feature
   ```

2. **Develop Your Feature**
   ```bash
   # Make changes
   npm run build        # Test compilation
   npm run dev          # Test locally
   ```

3. **Bump Version**
   ```bash
   # Choose the appropriate version bump:
   npm version patch    # 1.0.0 -> 1.0.1 (bug fixes)
   npm version minor    # 1.0.0 -> 1.1.0 (new features)
   npm version major    # 1.0.0 -> 2.0.0 (breaking changes)
   ```
   
   This automatically:
   - Updates `package.json`
   - Creates a git commit
   - Creates a git tag

4. **Push Changes**
   ```bash
   git push origin feature/my-awesome-feature
   git push --tags
   ```

5. **Create Pull Request**
   - Go to GitHub and create PR to `main`
   - PR checks will run automatically
   - Review the **Version Comparison** in PR summary
   - Shows exactly what release will be created

6. **Merge PR**
   - After approval, merge to `main`
   - 🎉 **Release workflow triggers automatically!**

7. **Automatic Release** (happens in ~5-10 minutes)
   - ✅ Docker images built for amd64 and arm64
   - ✅ Published to `ghcr.io/MP-Tool/komodo-mcp-server`
   - ✅ GitHub Release created with notes
   - ✅ Catalog updated with new version
   - ✅ Tags created: `1.0.0`, `1.0`, `1`, `latest`

## 📦 What Gets Released

After merge to main with version bump:

### Docker Images
```bash
# Version-specific tags
ghcr.io/mp-tool/komodo-mcp-server:1.2.3
ghcr.io/mp-tool/komodo-mcp-server:1.2
ghcr.io/mp-tool/komodo-mcp-server:1

# Latest tag (always points to newest)
ghcr.io/mp-tool/komodo-mcp-server:latest
```

### GitHub Release
- Release notes with changelog
- Git tag `v1.2.3`
- Pull instructions
- Links to documentation

### Updated Catalog
- `komodo-mcp-catalog.yaml` updated with new version
- Docker Desktop MCP discovery catalog

## 🔄 Version Strategy

We use [Semantic Versioning](https://semver.org/):

### MAJOR.MINOR.PATCH (e.g., 2.1.3)

| Type | When to Use | Example | Command |
|------|-------------|---------|---------|
| **PATCH** | Bug fixes, small improvements | 1.0.0 → 1.0.1 | `npm version patch` |
| **MINOR** | New features, backward compatible | 1.0.0 → 1.1.0 | `npm version minor` |
| **MAJOR** | Breaking changes | 1.0.0 → 2.0.0 | `npm version major` |

### Examples

**Patch (1.0.0 → 1.0.1)**
- Fix container startup bug
- Improve error messages
- Update documentation

**Minor (1.0.0 → 1.1.0)**
- Add new MCP tool
- Add support for new Komodo API
- Add new configuration option

**Major (1.0.0 → 2.0.0)**
- Change MCP protocol version
- Remove deprecated tools
- Change authentication method

## 🎯 Release Checklist

Before creating a PR:

- [ ] Code changes tested locally
- [ ] `npm run build` succeeds
- [ ] Version bumped in package.json
- [ ] Changes documented (README if needed)
- [ ] Docker image builds locally
- [ ] Clear commit messages

After PR created:

- [ ] PR checks pass (green)
- [ ] Version comparison looks correct
- [ ] Review approved
- [ ] Ready to merge

After merge:

- [ ] Monitor GitHub Actions workflow
- [ ] Verify release created
- [ ] Test published Docker image
- [ ] Check Docker Desktop catalog

## 📊 Monitoring Releases

### GitHub Actions
Watch the release workflow:
```
https://github.com/MP-Tool/komodo-mcp-server/actions
```

### Container Registry
Check published images:
```
https://github.com/MP-Tool/komodo-mcp-server/pkgs/container/komodo-mcp-server
```

### Latest Release
View releases:
```
https://github.com/MP-Tool/komodo-mcp-server/releases
```

## 🛑 Emergency: Stop a Release

If you need to stop a release in progress:

1. Go to [Actions](https://github.com/MP-Tool/komodo-mcp-server/actions)
2. Click on running workflow
3. Click "Cancel workflow"
4. Delete the tag if created:
   ```bash
   git tag -d v1.0.0
   git push origin :refs/tags/v1.0.0
   ```

## 🔧 Troubleshooting

### "Release not triggered after merge"

**Cause**: Version not changed in package.json

**Fix**: Check version diff
```bash
git diff HEAD~1 HEAD package.json
```

### "Docker build failed"

**Cause**: Build error in Dockerfile or TypeScript

**Fix**: Test locally first
```bash
npm run docker:build
```

### "Version already exists"

**Cause**: Tag already published

**Fix**: Bump version again
```bash
npm version patch
git push
```

## 🎓 Examples

### Example 1: Bug Fix Release

```bash
# Found a bug, let's fix it
git checkout -b fix/container-restart-bug

# Make fix
vim src/index.ts

# Test
npm run build
npm run dev

# Bump patch version
npm version patch  # 1.2.0 -> 1.2.1

# Push and create PR
git push origin fix/container-restart-bug

# After PR merged -> Release v1.2.1 automatically created!
```

### Example 2: New Feature Release

```bash
# New feature branch
git checkout -b feature/add-stack-deploy

# Implement feature
vim src/index.ts

# Test
npm run build

# Bump minor version
npm version minor  # 1.2.1 -> 1.3.0

# Push and create PR
git push origin feature/add-stack-deploy

# After PR merged -> Release v1.3.0 automatically created!
```

### Example 3: Documentation Update (No Release)

```bash
# Update docs
git checkout -b docs/improve-readme

# Make changes
vim README.md

# NO version bump needed!
git add README.md
git commit -m "docs: improve installation instructions"

# Push and create PR
git push origin docs/improve-readme

# After PR merged -> No release (version unchanged)
```

## 📝 Release Notes

Release notes are **automatically generated** from commit messages. Follow these conventions:

### Commit Message Format
```
type(scope): subject

body (optional)
```

### Types
- `feat`: New feature → shows in release notes
- `fix`: Bug fix → shows in release notes
- `docs`: Documentation → may show in release notes
- `chore`: Maintenance → usually hidden
- `refactor`: Code refactoring → may show in release notes

### Examples
```bash
git commit -m "feat: add deployment status monitoring"
git commit -m "fix: resolve container restart timeout issue"
git commit -m "docs: update Docker Desktop integration guide"
```

## 🔒 Security

- No manual secrets required
- Uses GitHub's automatic `GITHUB_TOKEN`
- Builds run in isolated environments
- Images scanned during build

## 🌟 Best Practices

1. **One feature per PR** - Easier to review and track
2. **Meaningful version bumps** - Follow semver strictly  
3. **Test before bumping** - Avoid broken releases
4. **Clear commit messages** - They become release notes
5. **Monitor workflows** - Check if release succeeded
6. **Update docs** - Keep README in sync with features

## 🆘 Need Help?

- Check [GitHub Actions logs](https://github.com/MP-Tool/komodo-mcp-server/actions)
- Review [Workflow README](.github/workflows/README.md)
- Open an issue with `release` label

---

**Remember**: The version in `package.json` is the single source of truth for releases! 🎯
