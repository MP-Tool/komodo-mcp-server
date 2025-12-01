# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
