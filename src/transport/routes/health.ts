/**
 * Health check route
 */

import { Router } from 'express';
import { config } from '../../config/env.js';
import type { TransportSessionManager } from '../session-manager.js';

export function createHealthRouter(sessionManager: TransportSessionManager): Router {
  const router = Router();

  /**
   * Health check endpoint
   * Returns server status and active session count
   */
  router.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      version: config.VERSION,
      sessions: sessionManager.size,
    });
  });

  return router;
}
