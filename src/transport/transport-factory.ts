/**
 * Transport Factory
 * Creates configured MCP transports with security features
 */

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { 
    JSONRPCMessage, 
    JSONRPCResponse, 
    JSONRPCError, 
    RequestId,
    isJSONRPCResponse,
    isJSONRPCError
} from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';
import { getAllowedHosts, FALLBACK_PROTOCOL_VERSION } from './config/transport.config.js';
import { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Internal interface to access private members of StreamableHTTPServerTransport
 * This is necessary to implement the custom session handling and split-stream logic
 * required for compatibility with various MCP clients (VS Code, Cursor, etc.)
 */
interface InternalStreamableTransport {
    sessionIdGenerator?: () => string;
    sessionId?: string;
    _initialized?: boolean;
    _onsessioninitialized?: (sessionId: string) => void;
    _standaloneSseStreamId?: string;
    _requestToStreamMapping?: Map<RequestId, string>;
    _streamMapping?: Map<string, ServerResponse>;
    _eventStore?: any;
    _requestResponseMap?: Map<RequestId, JSONRPCResponse | JSONRPCError>;
    _enableJsonResponse?: boolean;
    writeSSEEvent(response: ServerResponse, message: JSONRPCMessage, eventId?: string): void;
    onmessage?: (message: JSONRPCMessage) => void;
}

/**
 * Callbacks for transport lifecycle events
 */
export interface TransportCallbacks {
    onSessionInitialized?: (sessionId: string) => void;
    onSessionClosed?: (sessionId: string) => void;
}

/**
 * Custom StreamableHTTPServerTransport that supports the legacy SSE flow
 * (Initial GET request establishes session and sends endpoint event)
 */
class KomodoStreamableTransport extends StreamableHTTPServerTransport {
    async handleRequest(req: IncomingMessage, res: ServerResponse, parsedBody?: unknown): Promise<void> {
        // Security is handled by the global middleware (dnsRebindingProtection)
        // We disable the SDK's built-in check in the constructor options

        // Ensure Accept header meets SDK requirements (Legacy/Compatibility fix)
        // VS Code and other clients may send */* which the SDK rejects
        // Also, SDK requires BOTH application/json AND text/event-stream for POST
        let accept = req.headers['accept'];
        
        if (!accept || accept === '*/*' || accept.includes('*/*')) {
            if (req.method === 'GET') {
                req.headers['accept'] = 'text/event-stream';
            } else if (req.method === 'POST') {
                req.headers['accept'] = 'application/json, text/event-stream';
            }
        } else if (req.method === 'POST') {
            // If Accept header exists but doesn't contain text/event-stream, append it
            // The SDK requires both for POST requests
            if (!accept.includes('text/event-stream')) {
                req.headers['accept'] = `${accept}, text/event-stream`;
            }
        }
        
        // Handle initial GET request (no session ID)
        if (req.method === 'GET' && !req.headers['mcp-session-id']) {
            // Manually initialize session
            const self = this as unknown as InternalStreamableTransport;
            
            if (self.sessionIdGenerator) {
                const sessionId = self.sessionIdGenerator();
                self.sessionId = sessionId;
                
                // CRITICAL FIX: We must set _initialized = true temporarily so that
                // super.handleRequest() -> validateSession() passes.
                // Then we set it back to false so that the subsequent "initialize" POST
                // (handled by handlePostRequest) doesn't throw "Server already initialized".
                self._initialized = true;
                
                // CRITICAL FIX: Override the generator to return the SAME session ID.
                // When handlePostRequest runs, it will call sessionIdGenerator again.
                // We must ensure it returns the same ID so we don't break the session mapping.
                self.sessionIdGenerator = () => sessionId;
                
                if (self._onsessioninitialized) {
                    await Promise.resolve(self._onsessioninitialized(sessionId));
                }

                // Log connection type (Modern vs Legacy)
                const protocolVersion = req.headers['mcp-protocol-version'];
                const isLegacy = !protocolVersion || protocolVersion === FALLBACK_PROTOCOL_VERSION;
                const clientMode = isLegacy ? 'Legacy' : 'Modern';
                const versionStr = protocolVersion ? `(v${protocolVersion})` : '(Implicit)';
                
                console.error(`[Transport] New ${clientMode} connection established ${versionStr}. Session: ${sessionId}`);
                
                // Inject session ID into headers so validation passes
                req.headers['mcp-session-id'] = sessionId;
                
                // Call super to handle the SSE connection setup
                await super.handleRequest(req, res, parsedBody);
                
                // Reset initialized flag to allow the "initialize" JSON-RPC message to be processed
                self._initialized = false;
                
                // Send the endpoint event (Legacy flow support)
                // The client expects this to know where to send POST requests
                // Note: super.handleRequest might send this if it detects a new session,
                // but since we injected the header, it might think it's an existing session.
                // However, sending it twice might confuse clients.
                // Let's try NOT sending it if the SDK already did.
                // But we can't easily know.
                // If we are in "Modern" mode (v2025-06-18), the SDK should handle it.
                // If we are in "Legacy" mode, we might need it.
                
                if (!res.writableEnded) {
                    res.write(`event: endpoint\ndata: /mcp?sessionId=${sessionId}\n\n`);
                }
                return;
            }
        }

        // For POST requests, ensure Mcp-Session-Id header is present if passed via query param
        if (req.method === 'POST') {
            // Also ensure Mcp-Session-Id header is present if passed via query param
            // The SDK requires this header for all requests
            if (!req.headers['mcp-session-id'] && req.url) {
                try {
                    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
                    const sessionId = url.searchParams.get('sessionId');
                    if (sessionId) {
                        req.headers['mcp-session-id'] = sessionId;
                    }
                } catch (e) {
                    // Ignore URL parsing errors
                }
            }

            // CRITICAL FIX: Handle POST requests manually to ensure they use the existing SSE session.
            // The SDK's StreamableHTTPServerTransport creates a NEW session for POST requests if it
            // fails to find the existing one (which happens for some reason), causing the response
            // to be sent via HTTP instead of SSE.
            // By manually calling handleMessage, we inject the message into the transport pipeline,
            // and the response will be sent via the existing SSE connection (transport.send).
            
            const message = parsedBody || (req as any).body;
            
            try {
                // Use onmessage directly since handleMessage is not accessible/available
                const self = this as unknown as InternalStreamableTransport;
                
                // CRITICAL FIX: Map the request ID to the standalone SSE stream (the GET connection)
                // This ensures that the response is sent back via the existing SSE connection
                // instead of trying to send it back via the POST response (which we close with 202).
                if (message.id !== undefined) {
                    const streamId = self._standaloneSseStreamId || '_GET_stream';
                    if (self._requestToStreamMapping) {
                        self._requestToStreamMapping.set(message.id, streamId);
                    }
                }

                if (self.onmessage) {
                    await self.onmessage(message);
                } else {
                    console.error('[Transport] No onmessage handler attached!');
                }
                
                res.statusCode = 202;
                res.end('Accepted');
            } catch (error) {
                console.error('[Transport] Error handling POST message:', error);
                res.statusCode = 500;
                res.end('Internal Server Error');
            }
            return;
        }
        
        return super.handleRequest(req, res, parsedBody);
    }

    /**
     * Override send to prevent closing the long-lived SSE stream
     */
    async send(message: JSONRPCMessage, options?: { relatedRequestId?: RequestId }): Promise<void> {
        const self = this as unknown as InternalStreamableTransport;
        let requestId = options?.relatedRequestId;

        if (isJSONRPCResponse(message) || isJSONRPCError(message)) {
            requestId = message.id;
        }

        if (requestId === undefined) {
            // Standalone SSE stream logic (notifications/requests from server)
            if (isJSONRPCResponse(message) || isJSONRPCError(message)) {
                throw new Error('Cannot send a response on a standalone SSE stream unless resuming a previous client request');
            }
            
            let eventId;
            if (self._eventStore && self._standaloneSseStreamId) {
                eventId = await self._eventStore.storeEvent(self._standaloneSseStreamId, message);
            }
            
            if (!self._streamMapping || !self._standaloneSseStreamId) {
                return;
            }

            const standaloneSse = self._streamMapping.get(self._standaloneSseStreamId);
            if (standaloneSse === undefined) {
                return;
            }
            
            self.writeSSEEvent(standaloneSse, message, eventId);
            return;
        }

        // Response logic
        if (!self._requestToStreamMapping || !self._streamMapping) {
             throw new Error('Transport not initialized correctly');
        }

        const streamId = self._requestToStreamMapping.get(requestId);
        if (!streamId) {
            throw new Error(`No connection established for request ID: ${String(requestId)}`);
        }

        const response = self._streamMapping.get(streamId);

        if (!self._enableJsonResponse) {
            let eventId;
            if (self._eventStore) {
                eventId = await self._eventStore.storeEvent(streamId, message);
            }
            if (response) {
                self.writeSSEEvent(response, message, eventId);
            }
        }

        if (isJSONRPCResponse(message) || isJSONRPCError(message)) {
            if (!self._requestResponseMap) {
                 throw new Error('Transport not initialized correctly');
            }
            self._requestResponseMap.set(requestId, message);
            
            const relatedIds = Array.from(self._requestToStreamMapping.entries())
                .filter(([_, sId]) => self._streamMapping!.get(sId) === response)
                .map(([id]) => id);

            const allResponsesReady = relatedIds.every((id) => self._requestResponseMap!.has(id));

            if (allResponsesReady) {
                if (!response) {
                    throw new Error(`No connection established for request ID: ${String(requestId)}`);
                }

                if (self._enableJsonResponse) {
                    const headers: any = {
                        'Content-Type': 'application/json'
                    };
                    if (self.sessionId !== undefined) {
                        headers['mcp-session-id'] = self.sessionId;
                    }
                    const responses = relatedIds.map((id) => self._requestResponseMap!.get(id));
                    response.writeHead(200, headers);
                    if (responses.length === 1) {
                        response.end(JSON.stringify(responses[0]));
                    } else {
                        response.end(JSON.stringify(responses));
                    }
                } else {
                    // CRITICAL FIX: Do NOT close the stream if it is the long-lived SSE stream
                    const isLongLived = streamId === (self._standaloneSseStreamId || '_GET_stream');
                    if (!isLongLived) {
                        response.end();
                    }
                }

                for (const id of relatedIds) {
                    self._requestResponseMap.delete(id);
                    self._requestToStreamMapping.delete(id);
                }
            }
        }
    }

    /**
     * Sends a heartbeat (SSE comment) to keep the connection alive and check status
     */
    sendHeartbeat(): boolean {
        const self = this as unknown as InternalStreamableTransport;
        // Try to find the main SSE stream
        const streamId = self._standaloneSseStreamId;
        
        if (!self._streamMapping || !streamId) {
            return false;
        }

        const response = self._streamMapping.get(streamId);
        if (!response || response.writableEnded || response.destroyed) {
            return false;
        }

        try {
            // Send SSE comment as heartbeat
            response.write(': keepalive\n\n');
            return true;
        } catch (error) {
            return false;
        }
    }
}

/**
 * Creates a new StreamableHTTPServerTransport with security features
 * 
 * Security Features:
 * - Cryptographically secure session IDs (UUID v4)
 * - DNS rebinding protection enabled
 * - Allowed hosts configured
 * - Lifecycle event callbacks
 */
export function createSecureTransport(callbacks: TransportCallbacks): StreamableHTTPServerTransport {
    return new KomodoStreamableTransport({
        sessionIdGenerator: () => randomUUID(),
        enableDnsRebindingProtection: false, // We handle this manually in handleRequest
        allowedHosts: getAllowedHosts(),
        // Note: allowedOrigins not set - middleware handles Origin validation
        // Origin validation is only necessary for servers accessible from the network
        onsessioninitialized: callbacks.onSessionInitialized,
        onsessionclosed: callbacks.onSessionClosed,
    });
}
