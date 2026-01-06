/**
 * MCP Transport Layer - Split Stream Transport Tests
 * 
 * DEPRECATED: These tests verify the legacy "split stream" transport pattern where 
 * the SSE connection (GET) and message sending (POST) are handled separately.
 * 
 * This pattern was used in MCP protocol version 2024-11-05 (HTTP+SSE transport).
 * The modern Streamable HTTP transport (2025-03-26) uses a different pattern:
 * - POST /mcp with InitializeRequest (no session) → Creates session
 * - Subsequent POST /mcp with Mcp-Session-Id header → Uses existing session
 * - Optional GET /mcp with Mcp-Session-Id → SSE stream for server notifications
 * 
 * The legacy split-stream pattern (GET creates session, POST with ?sessionId query)
 * is no longer supported. These tests are skipped.
 * 
 * @see https://modelcontextprotocol.io/specification/2025-03-26/basic/transports
 */

import { describe, it, vi } from 'vitest';

// Mock config
vi.mock('../../src/config/env.js', () => import('./mocks/env.js'));

describe.skip('MCP Transport Layer - Split Stream Transport (DEPRECATED)', () => {
  /**
   * @deprecated Legacy HTTP+SSE transport pattern is no longer supported.
   * 
   * The modern Streamable HTTP transport uses:
   * 1. POST /mcp with InitializeRequest → Creates session (Mcp-Session-Id in response header)
   * 2. POST /mcp with Mcp-Session-Id header → Send JSON-RPC messages
   * 3. Server responds with SSE stream (text/event-stream) or JSON (application/json)
   */
  it('should maintain SSE connection open after multiple POST requests', async () => {
    // This test is skipped because the legacy split-stream pattern
    // (GET /mcp establishes session, POST /mcp?sessionId=xxx sends messages)
    // is no longer supported in the modern Streamable HTTP transport.
  });
});
