# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

--------------------------------------------------------------

## [1.0.4] (#22)

### Changed
- **Architecture Overhaul**: Refactored the entire codebase from a monolithic structure into a modular design.
    - Moved API client to `src/api/`.
    - Created dedicated tool handlers in `src/tools/` (separated by domain: container, stack, server, deployment).
    - Centralized configuration and validation in `src/config/`.
- **SDK Upgrade**: Updated to the latest `@modelcontextprotocol/sdk` using the `McpServer` class.
- **Logging**: Enforced strict usage of `stderr` for logging to ensure stability of the Stdio transport.

### Added
- **Input Validation**: Added Zod schemas for strict environment variable validation on startup.
- **Tool Registry**: Added a dynamic tool registry system to simplify adding new tools in the future.

### Removed
- **Legacy Code**: Removed deprecated `Server` class usage and monolithic tool definitions.

--------------------------------------------------------------

## [1.0.5] (#23)

### Security
- **Hardening**: Added CodeQL (SAST) and OpenSSF Scorecard workflows to ensure code security and best practices.
- **Dependency Review**: Added automated dependency review for Pull Requests to block vulnerable packages.
- **Docker Security**: Added `apk upgrade` to Dockerfile to fix OS-level vulnerabilities in the base image.

### Changed
- **CI/CD Optimization**: Replaced Dependabot with Renovate for better dependency management and reduced noise.
- **Workflow Optimization**: Optimized PR checks to skip heavy tasks (like Docker builds) on Draft PRs and only run when relevant files change.
- **Dev Experience**: Generalized `.devcontainer` configuration for public use and added useful VS Code extensions.

