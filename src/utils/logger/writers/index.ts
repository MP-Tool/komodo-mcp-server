/**
 * Writers Module
 *
 * Log output writers for different destinations.
 * Each writer handles a specific output target (console, file, MCP).
 *
 * Note: TransportMode type should be imported from '../core/constants.js'
 *
 * @module logger/writers
 */

// Base Writer
export { BaseLogWriter } from './base-writer.js';

// Console Writer
export { ConsoleWriter, type ConsoleWriterConfig } from './console-writer.js';

// File Writer
export { FileWriter, type FileWriterConfig } from './file-writer.js';

// MCP Writer
export { McpLogWriter, mcpLogWriter } from './mcp-writer.js';

// Composite Writer
export { CompositeWriter } from './composite-writer.js';
