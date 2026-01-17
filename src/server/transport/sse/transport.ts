/**
 * SSE Transport Implementation
 *
 * This is a custom implementation of the deprecated HTTP+SSE transport
 * from MCP protocol version 2024-11-05. It provides backwards compatibility
 * for older MCP clients that don't support the modern Streamable HTTP transport.
 *
 * Protocol Flow:
 * 1. Client connects via GET to SSE endpoint
 * 2. Server sends 'endpoint' event with URL for POSTing messages (includes sessionId)
 * 3. Client POSTs JSON-RPC messages to that URL
 * 4. Server responds via the SSE stream
 *
 * This replaces the deprecated SSEServerTransport from @modelcontextprotocol/sdk
 * with a clean, maintainable implementation.
 *
 * @module server/transport/sse/transport
 */

import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { Response, Request } from 'express';
import { randomUUID } from 'node:crypto';
import { TransportError } from '../../errors/index.js';

/**
 * Response object that may have a flush method added by middleware.
 * Some Express middleware (like compression) add this method.
 */
interface FlushableResponse extends Response {
  flush?: () => void;
}

/**
 * Custom SSE Transport for backwards compatibility with MCP 2024-11-05 clients.
 *
 * Implements the Transport interface from the MCP SDK without using
 * the deprecated SSEServerTransport class.
 */
export class SseTransport implements Transport {
  private _sessionId: string;
  private _res: Response;
  private _messageEndpoint: string;
  private _started = false;
  private _closed = false;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  /**
   * Creates a new SSE Transport
   *
   * @param messageEndpoint - The endpoint path where clients should POST messages
   *                          (e.g., '/mcp/message' or '/sse/message')
   * @param res - Express Response object for the SSE stream
   */
  constructor(messageEndpoint: string, res: Response) {
    this._sessionId = randomUUID();
    this._messageEndpoint = messageEndpoint;
    this._res = res;
  }

  /**
   * Get the session ID for this transport
   */
  get sessionId(): string {
    return this._sessionId;
  }

  /**
   * Start the SSE transport.
   *
   * Sets up SSE headers and sends the 'endpoint' event with the message URL.
   * This method is idempotent - calling it multiple times has no effect after
   * the first call. This is necessary because mcpServer.connect() calls start()
   * internally, but we need to call it before connect() to send the endpoint event.
   */
  async start(): Promise<void> {
    // Idempotent: if already started, just return silently
    // This is needed because mcpServer.connect() calls start() internally
    if (this._started) {
      return;
    }
    if (this._closed) {
      throw TransportError.closed();
    }

    this._started = true;

    // Set SSE headers
    this._res.setHeader('Content-Type', 'text/event-stream');
    this._res.setHeader('Cache-Control', 'no-cache, no-transform');
    this._res.setHeader('Connection', 'keep-alive');
    this._res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    this._res.flushHeaders();

    // Send the endpoint event with the message URL
    // This tells the client where to POST messages
    const endpointUrl = `${this._messageEndpoint}?sessionId=${this._sessionId}`;
    this._sendSseEvent('endpoint', endpointUrl);
  }

  /**
   * Send a JSON-RPC message to the client via SSE
   */
  async send(message: JSONRPCMessage): Promise<void> {
    if (this._closed) {
      throw TransportError.closed();
    }
    if (!this._started) {
      throw TransportError.notStarted();
    }

    this._sendSseEvent('message', JSON.stringify(message));
  }

  /**
   * Close the transport
   */
  async close(): Promise<void> {
    if (this._closed) return;

    this._closed = true;

    // End the SSE stream
    if (!this._res.writableEnded) {
      this._res.end();
    }

    this.onclose?.();
  }

  /**
   * Handle an incoming POST message from the client.
   *
   * This should be called by the Express route handler when a POST
   * is received at the message endpoint.
   *
   * @param req - Express Request object
   * @param res - Express Response object for the POST response
   * @param body - Parsed JSON-RPC message body
   */
  async handlePostMessage(req: Request, res: Response, body: JSONRPCMessage): Promise<void> {
    if (this._closed) {
      res.status(400).json({ error: 'Transport is closed' });
      return;
    }

    // Notify the MCP server of the incoming message
    try {
      this.onmessage?.(body);

      // For requests (with id), send 202 Accepted - response will come via SSE
      // For notifications (no id), send 204 No Content
      if ('id' in body && body.id !== undefined) {
        res.status(202).json({ status: 'accepted' });
      } else {
        res.status(204).end();
      }
    } catch (error) {
      this.onerror?.(error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Send an SSE event to the client
   */
  private _sendSseEvent(event: string, data: string): void {
    if (this._res.writableEnded) return;

    this._res.write(`event: ${event}\n`);
    this._res.write(`data: ${data}\n\n`);

    // Flush to ensure immediate delivery (some Express middleware add flush)
    this._flushResponse();
  }

  /**
   * Flushes the response buffer if the response supports it.
   * Some middleware (like compression) add a flush method to the response.
   */
  private _flushResponse(): void {
    const res = this._res as FlushableResponse;
    if (typeof res.flush === 'function') {
      res.flush();
    }
  }
}

// Backwards compatibility alias
export { SseTransport as LegacySseTransport };
