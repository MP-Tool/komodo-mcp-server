/**
 * Environment Configuration Fuzzing Tests
 * 
 * This test suite verifies that the environment variable parsing logic (Zod schema)
 * is robust against malformed, missing, or unexpected input values.
 * It ensures that the application fails gracefully (with a validation error)
 * rather than crashing when encountering invalid configuration.
 */
import { describe, it } from 'vitest';
import fc from 'fast-check';
import { envSchema } from '../../src/config/env';
import { z } from 'zod';

describe('Environment Configuration Fuzzing', () => {
  it('should handle arbitrary environment variables without crashing', () => {
    fc.assert(
      fc.property(
        fc.record({
          VERSION: fc.string(),
          NODE_ENV: fc.string(),
          MCP_BIND_HOST: fc.string(),
          MCP_PORT: fc.string(),
          MCP_TRANSPORT: fc.string(),
          MCP_ALLOWED_ORIGINS: fc.string(),
          MCP_ALLOWED_HOSTS: fc.string(),
          KOMODO_URL: fc.string(),
          KOMODO_USERNAME: fc.string(),
          KOMODO_PASSWORD: fc.string(),
          // Simulate extra unknown environment variables
          EXTRA_VAR: fc.string()
        }, { withDeletedKeys: true } as any), 
        (env) => {
          try {
            // We are testing that parse() doesn't throw an unexpected error (crash).
            // ZodError is expected for invalid inputs.
            envSchema.parse(env);
            return true;
          } catch (error: any) {
            // If it's a ZodError, that's fine (validation failed as expected)
            if (error instanceof z.ZodError) {
              return true;
            }
            // Any other error is a crash/bug
            return false;
          }
        }
      ),
      {
        numRuns: 1000
      }
    );
  });

  it('should specifically handle MCP_PORT fuzzing', () => {
     fc.assert(
        fc.property(fc.string(), (portStr) => {
            try {
                // We only care about MCP_PORT here
                const schema = z.object({
                    MCP_PORT: envSchema.shape.MCP_PORT
                });
                
                const result = schema.safeParse({ MCP_PORT: portStr });
                
                // If it parses, it must be a number (due to transform)
                if (result.success) {
                    return typeof result.data.MCP_PORT === 'number' && !isNaN(result.data.MCP_PORT);
                }
                return true;
            } catch (e) {
                return false;
            }
        })
     );
  });

  it('should specifically handle MCP_ALLOWED_ORIGINS fuzzing', () => {
    fc.assert(
       fc.property(fc.string(), (originsStr) => {
           try {
               const schema = z.object({
                MCP_ALLOWED_ORIGINS: envSchema.shape.MCP_ALLOWED_ORIGINS
               });
               
               const result = schema.safeParse({ MCP_ALLOWED_ORIGINS: originsStr });
               
               if (result.success) {
                   const origins = result.data.MCP_ALLOWED_ORIGINS;
                   // It should be undefined or an array of strings
                   if (origins === undefined) return true;
                   return Array.isArray(origins) && origins.every(o => typeof o === 'string');
               }
               return true;
           } catch (e) {
               console.error('Crash in MCP_ALLOWED_ORIGINS fuzzing:', e);
               return false;
           }
       })
    );
 });
});
