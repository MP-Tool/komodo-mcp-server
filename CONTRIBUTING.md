# Contributing to Komodo MCP Server

Thank you for your interest in contributing to Komodo MCP Server! 🎉

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Coding Standards](#coding-standards)
- [Testing](#testing)

## 🤝 Code of Conduct

Be respectful, inclusive, and constructive. We're all here to build great software together!

## 🚀 Getting Started

### Prerequisites

- Node.js 22+
- Docker (for testing containers)
- Komodo Server instance (for testing MCP tools)
- Git

### Fork and Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/komodo-mcp-server.git
cd komodo-mcp-server

# Add upstream remote
git remote add upstream https://github.com/MP-Tool/komodo-mcp-server.git
```

### Install Dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

### Run Locally

```bash
npm run dev
```

## 📂 Project Structure

The project follows a modular architecture:

- `src/api/` - Komodo API client and type definitions
- `src/config/` - Configuration and environment validation (Zod)
- `src/tools/` - MCP tool definitions (Controllers)
  - `base.ts` - Tool interface and registry
  - `container/` - Container management tools
  - `stack/` - Stack management tools
  - `server/` - Server management tools
- `src/index.ts` - Server entry point and setup

## 💻 Development Workflow

### 1. Create Feature Branch

```bash
git checkout main
git pull upstream main
git checkout -b feature/your-feature-name
```

### 2. Make Changes

- Follow [Coding Standards](#coding-standards)
- Write clean, documented code
- Test your changes

### 3. Test Locally

```bash
# TypeScript compilation
npm run build

# Docker build test
npm run docker:build

# Manual testing
npm run dev
```

### 4. Commit Changes

Use conventional commit messages:

```bash
git commit -m "feat: add new MCP tool for stack deployment"
git commit -m "fix: resolve container restart timeout"
git commit -m "docs: improve installation guide"
```

**Commit Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `refactor`: Code refactoring
- `test`: Testing
- `chore`: Maintenance
- `style`: Formatting

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## 🔍 Pull Request Guidelines

### Before Creating PR

- [ ] Code builds successfully (`npm run build`)
- [ ] Docker image builds (`npm run docker:build`)
- [ ] Changes tested locally
- [ ] Documentation updated (if needed)
- [ ] Commit messages follow convention
- [ ] Branch up to date with main

### PR Title Format

```
type(scope): brief description

Examples:
- feat(tools): add deployment monitoring tool
- fix(client): resolve authentication timeout
- docs(readme): update Docker installation steps
```

### PR Description

Include:
- **What**: Brief description of changes
- **Why**: Reason for the change
- **How**: Technical approach (if complex)
- **Testing**: How you tested the changes
- **Screenshots**: If UI/output changes

### PR Checks

Our CI will automatically:
- ✅ Build TypeScript
- ✅ Build Docker image
- ✅ Validate version format
- ✅ Show version comparison
- ✅ Preview release (if version changed)

### Review Process

1. Automated checks must pass
2. Maintainer review required
3. Address feedback
4. Approved → Ready to merge

## 🎨 Coding Standards

### TypeScript

- Use **TypeScript** for all code
- Enable strict mode
- Define types for all functions
- Use interfaces for complex objects
- Avoid `any` type

### Code Style

```typescript
// ✅ Good
interface KomodoContainer {
  name: string;
  state: string;
  image?: string;
}

// Tools receive the client as context
const handler = async (args: { server: string }, { client }: ToolContext) => {
  if (!client) throw new Error('Client not initialized');
  await client.startContainer(args.server);
}

// ❌ Bad
function start(s: any, c: any) {
  const client = getGlobalClient(); // Avoid global state
  client.start(s, c);
}
```

### MCP Tools

We use the `Tool` interface and **Zod** for schema validation. Follow this structure:

```typescript
import { z } from 'zod';
import { Tool } from '../base.js';

export const myTool: Tool = {
  name: 'komodo_tool_name',
  description: 'Clear, concise description of what the tool does',
  schema: z.object({
    server: z.string().describe('Server ID or name'),
    count: z.number().optional().describe('Number of items')
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error('Komodo client not initialized');
    
    // Your implementation here
    return {
      content: [{ type: 'text', text: 'Result' }]
    };
  }
};
```

### Error Handling

```typescript
// ✅ Use McpError for MCP tools
throw new McpError(
  ErrorCode.InvalidRequest,
  'Server not found: ' + server
);

// ✅ Wrap API errors with context
catch (error) {
  throw new McpError(
    ErrorCode.InternalError,
    `Failed to start container: ${error.message}`
  );
}
```

### Documentation

```typescript
/**
 * Start a Docker container on specified server.
 * 
 * @param server - Server ID or name
 * @param container - Container name
 * @throws McpError if server/container not found
 */
async function startContainer(server: string, container: string): Promise<void>
```

## 🧪 Testing

### Manual Testing

1. **Build and Run**
   ```bash
   npm run dev
   ```

2. **Test with Claude Desktop**
   - Configure MCP connection
   - Try each tool
   - Verify responses

3. **Test with Docker**
   ```bash
   docker build -t komodo-mcp-server:test .
   docker run -i -e KOMODO_URL=$URL -e KOMODO_USERNAME=$USER -e KOMODO_PASSWORD=$PASS komodo-mcp-server:test
   ```

### Test Checklist

- [ ] All MCP tools work
- [ ] Error handling works
- [ ] Docker image builds
- [ ] Multi-platform support (if touching Dockerfile)

## 📚 Documentation

### When to Update Docs

- Configuration changes → Update examples
- Breaking changes → Update RELEASE.md
- New features → Update feature list

### Documentation Files

- `README.md` - Main documentation
- `SECURITY.md` - Security policy
- `examples/*/README.md` - Integration guides

## 🐛 Bug Reports

### Found a Bug?

1. Check [existing issues](https://github.com/MP-Tool/komodo-mcp-server/issues)
2. Create new issue with:
   - Clear title
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Environment (OS, Node version, Docker version)
   - Logs/screenshots

### Example

```markdown
**Title**: Container start fails with timeout error

**Description**: When starting a container through komodo_start_container, 
the operation times out after 30 seconds.

**Steps to Reproduce**:
1. Configure MCP with komodo_configure
2. Run komodo_start_container with server="prod" container="web"
3. Wait 30 seconds

**Expected**: Container starts successfully
**Actual**: Timeout error

**Environment**:
- OS: macOS 14
- Node: 22.0.0
- Docker: 24.0.0
- Komodo: v1.19.5
```

## 💡 Feature Requests

Have an idea? Open an issue with:
- **Feature**: What you have in mind?
- **Problem**: What problem does this solve?
- **Solution**: How should it work?
- **Alternatives**: Other approaches considered?
- **Use Case**: Real-world scenario

## 🆘 Need Help?

- 📖 Read the [README](README.md)
- 🐛 Report bugs in [Issues](https://github.com/MP-Tool/komodo-mcp-server/issues)
- 💬 Ask in [Discussions](https://github.com/MP-Tool/komodo-mcp-server/discussions)

## 🌟 Recognition

Contributors are recognized in:
- GitHub contributors page
- Release notes (for significant contributions)
- Project acknowledgments

Thank you for contributing! 🙏
