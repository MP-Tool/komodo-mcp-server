/**
 * Tool Schema Fuzzing Tests
 * 
 * This test suite iterates over all registered MCP tools and fuzzes their input schemas.
 * It ensures that the Zod schemas defined for each tool can safely handle arbitrary
 * input data without throwing unexpected exceptions (crashes).
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { toolRegistry } from '../../src/tools/base.js';
import { registerTools } from '../../src/tools/index.js';

// Register tools immediately so we can generate tests for them
try {
  registerTools();
} catch (e) {
  // Ignore if already registered
}

describe('Tool Schema Fuzzing', () => {
  const tools = toolRegistry.getTools();

  if (tools.length === 0) {
    it('should have tools registered', () => {
      expect(tools.length).toBeGreaterThan(0);
    });
  }

  tools.forEach((tool) => {
    it(`should safely parse arbitrary inputs for tool: ${tool.name}`, () => {
      fc.assert(
        fc.property(fc.anything(), (input) => {
          try {
            // The schema should never throw, only return success: false
            // But Zod schemas *can* throw if they are malformed, or if safeParse is not used.
            // We use safeParse here.
            tool.schema.safeParse(input);
            
            // If it succeeds, the data should match the schema (implicit)
            // If it fails, it should be a ZodError (implicit in safeParse)
            return true;
          } catch (error) {
            return false;
          }
        })
      );
    });
  });
});
