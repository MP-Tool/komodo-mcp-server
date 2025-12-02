/**
 * Transport Factory
 * Creates configured MCP transports with security features
 */

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'node:crypto';
import { getAllowedHosts } from './config/transport.config.js';
import { IncomingMessage, ServerResponse } from 'node:http';

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
        // Handle initial GET request (no session ID)
        if (req.method === 'GET' && !req.headers['mcp-session-id']) {
            // Manually initialize session
            const self = this as any;
            
            if (self.sessionIdGenerator) {
                const sessionId = self.sessionIdGenerator();
                self.sessionId = sessionId;
                self._initialized = true;
                
                if (self._onsessioninitialized) {
                    await Promise.resolve(self._onsessioninitialized(sessionId));
                }
                
                // Inject session ID into headers so validation passes
                req.headers['mcp-session-id'] = sessionId;
                
                // Call super to handle the SSE connection setup
                await super.handleRequest(req, res, parsedBody);
                
                // Send the endpoint event (Legacy flow support)
                // The client expects this to know where to send POST requests
                res.write(`event: endpoint\ndata: /mcp?sessionId=${sessionId}\n\n`);
                return;
            }
        }
        
        return super.handleRequest(req, res, parsedBody);
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
        enableDnsRebindingProtection: true,
        allowedHosts: getAllowedHosts(),
        // Note: allowedOrigins not set - middleware handles Origin validation
        // Origin validation is only necessary for servers accessible from the network
        onsessioninitialized: callbacks.onSessionInitialized,
        onsessionclosed: callbacks.onSessionClosed,
    });
}
