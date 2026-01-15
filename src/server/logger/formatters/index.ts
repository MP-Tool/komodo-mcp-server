/**
 * Formatters Module
 *
 * Log formatting utilities for different output formats.
 * Supports text (human-readable) and JSON (structured) formats.
 *
 * @module logger/formatters
 */

// Schema & Builder
export { createLogEntry, LogEntryBuilder, type StructuredLogEntry } from './schema.js';

// Text Formatter
export { TextFormatter, textFormatter, type TextFormatterConfig } from './text-formatter.js';

// JSON Formatter
export { JsonFormatter, type JsonFormatterConfig } from './json-formatter.js';
