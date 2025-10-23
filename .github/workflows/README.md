# GitHub Workflows

This directory contains automated workflows for CI/CD, releases, and quality checks.

## 📋 Available Workflows

### 1. Release (`release.yml`)

**Trigger**: Automatic on `main` branch when `package.json` version changes

**What it does**:
- ✅ Detects version changes in `package.json`
- 🐳 Builds multi-platform Docker images (amd64, arm64)
- 📦 Publishes to GitHub Container Registry (ghcr.io)
- 🏷️ Creates version tags (`1.0.0`, `1.0`, `1`, `latest`)
- 📝 Generates GitHub Release with notes
- 🔄 Updates `komodo-mcp-catalog.yaml`

**Image Tags**:
```bash
ghcr.io/mp-tool/komodo-mcp-server:1.0.0  # Exact version
ghcr.io/mp-tool/komodo-mcp-server:1.0    # Minor version
ghcr.io/mp-tool/komodo-mcp-server:1      # Major version
ghcr.io/mp-tool/komodo-mcp-server:latest # Always newest
```

**Manual Trigger**: Available via workflow_dispatch

### 2. PR Checks (`pr-check.yml`)

**Trigger**: Automatic on Pull Requests to `main`

**What it does**:
- ✅ TypeScript compilation check
- 🐳 Docker build test
- 📋 Version format validation
- 🔍 Version bump detection
- 📊 PR summary with release preview

**Benefits**:
- Early detection of build issues
- Validates version bumps before merge
- Shows what will be released

## 🚀 Release Process

### Standard Release (Version Bump)

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make Changes**
   ```bash
   # Edit code
   npm run build  # Test locally
   ```

3. **Bump Version**
   ```bash
   # Update package.json version
   # Example: 1.0.0 -> 1.1.0
   npm version minor  # or patch, major
   ```

4. **Commit & Push**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   git push origin feature/my-feature
   ```

5. **Create Pull Request**
   - PR checks will run automatically
   - Version comparison will show in PR summary
   - ✅ Review and merge

6. **Automatic Release**
   - On merge to `main`, release workflow triggers
   - Docker images built and published
   - GitHub Release created
   - Catalog updated

### Quick Fix (No Version Bump)

If you merge a PR **without** version bump:
- ❌ No release created
- ❌ No Docker images built
- ℹ️ Changes go to `main` but not published

**Use this for**:
- Documentation updates
- CI/CD fixes
- Internal tooling changes

## 🔒 Required Secrets

No additional secrets required! Workflows use:
- `GITHUB_TOKEN` (automatic, provided by GitHub)

## 🏷️ Version Guidelines

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): New features (backward compatible)
- **PATCH** (1.0.0 → 1.0.1): Bug fixes

```bash
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0
```

## 📊 Workflow Status

Check workflow status:
- [Actions Tab](../../actions)
- [Latest Release](../../releases/latest)
- [Container Registry](../../pkgs/container/komodo-mcp-server)

## 🛠️ Troubleshooting

### Release Not Triggered

**Problem**: Merged to main but no release

**Solution**: Check if version changed in package.json
```bash
git log --oneline --all -10 | grep -i version
```

### Docker Build Fails

**Problem**: Build fails in CI

**Solution**: Test locally first
```bash
npm run docker:build
docker run -i komodo-mcp-server:latest
```

### Version Conflict

**Problem**: Version already exists

**Solution**: Bump version again
```bash
npm version patch
git push
```

## 📝 Best Practices

1. **Always bump version** for releases
2. **Test Docker build** locally before PR
3. **Write clear commit messages** (used in release notes)
4. **Review PR checks** before merging
5. **Monitor workflow runs** in Actions tab

## 🔗 Related Files

- `.github/workflows/release.yml` - Release automation
- `.github/workflows/pr-check.yml` - PR validation
- `package.json` - Version source of truth
- `Dockerfile` - Image build definition
- `komodo-mcp-catalog.yaml` - Docker Desktop catalog
