/**
 * Health check route
 */

import { Router } from 'express';
import { config } from '../../config/index.js';
import type { TransportSessionManager } from '../session-manager.js';
import { getLegacySseSessionCount, isLegacySseEnabled } from './mcp.js';

export function createHealthRouter(sessionManager: TransportSessionManager): Router {
  const router = Router();

  /**
   * Health check endpoint
   * Returns server status and active session count
   */
  router.get('/health', (req, res) => {
    const response: Record<string, unknown> = {
      status: 'healthy',
      version: config.VERSION,
      sessions: {
        streamableHttp: sessionManager.size,
      },
    };

    // Include Legacy SSE session count if enabled
    if (isLegacySseEnabled()) {
      (response.sessions as Record<string, number>).legacySse = getLegacySseSessionCount();
    }

    res.status(200).json(response);
  });

  return router;
}
