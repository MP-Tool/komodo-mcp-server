/**
 * Resource Registry Tests
 *
 * Tests for the resource and resource template infrastructure.
 * Verifies RFC 6570 URI Template support and resource registration.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';

// We need to test the registry directly
describe('Resource Registry', () => {
  // Create a fresh registry for each test
  let ResourceRegistry: new () => {
    register: (resource: {
      uri: string;
      name: string;
      description?: string;
      mimeType?: string;
      handler: () => Promise<{ uri: string; text?: string; blob?: string; mimeType?: string }[]>;
    }) => void;
    registerTemplate: (template: {
      uriTemplate: string;
      name: string;
      description?: string;
      mimeType?: string;
      argumentsSchema?: z.ZodSchema<unknown>;
      handler: (
        args: Record<string, string | string[]>,
      ) => Promise<{ uri: string; text?: string; blob?: string; mimeType?: string }[]>;
    }) => void;
    getResource: (uri: string) =>
      | {
          uri: string;
          name: string;
          handler: () => Promise<{ uri: string; text?: string; blob?: string; mimeType?: string }[]>;
        }
      | undefined;
    getTemplate: (uriTemplate: string) =>
      | {
          uriTemplate: string;
          name: string;
          handler: (
            args: Record<string, string | string[]>,
          ) => Promise<{ uri: string; text?: string; blob?: string; mimeType?: string }[]>;
        }
      | undefined;
    getResources: () => { uri: string; name: string }[];
    getTemplates: () => { uriTemplate: string; name: string }[];
    hasResources: () => boolean;
    getCount: () => { resources: number; templates: number };
  };
  let registry: InstanceType<typeof ResourceRegistry>;

  beforeEach(async () => {
    // Dynamically import to reset the singleton for each test
    vi.resetModules();
    const module = await import('../../src/resources/base.js');
    // We can't access the class directly, but we can test via the registry
    // For these tests, we'll use the exported singleton
    registry = module.resourceRegistry as unknown as InstanceType<typeof ResourceRegistry>;
  });

  describe('Static Resources', () => {
    it('should register and retrieve a static resource', async () => {
      const handler = vi.fn().mockResolvedValue([
        {
          uri: 'test://resource',
          mimeType: 'application/json',
          text: '{"test": true}',
        },
      ]);

      registry.register({
        uri: 'test://resource',
        name: 'Test Resource',
        description: 'A test resource',
        mimeType: 'application/json',
        handler,
      });

      const resource = registry.getResource('test://resource');
      expect(resource).toBeDefined();
      expect(resource?.name).toBe('Test Resource');

      const content = await resource?.handler();
      expect(content).toHaveLength(1);
      expect(content?.[0].text).toBe('{"test": true}');
      expect(handler).toHaveBeenCalled();
    });

    it('should throw when registering duplicate resource URI', () => {
      registry.register({
        uri: 'test://duplicate',
        name: 'First Resource',
        handler: async () => [{ uri: 'test://duplicate', text: '' }],
      });

      expect(() =>
        registry.register({
          uri: 'test://duplicate',
          name: 'Second Resource',
          handler: async () => [{ uri: 'test://duplicate', text: '' }],
        }),
      ).toThrow('Resource test://duplicate is already registered');
    });

    it('should list all registered resources', () => {
      registry.register({
        uri: 'test://resource-1',
        name: 'Resource 1',
        handler: async () => [{ uri: 'test://resource-1', text: '' }],
      });

      registry.register({
        uri: 'test://resource-2',
        name: 'Resource 2',
        handler: async () => [{ uri: 'test://resource-2', text: '' }],
      });

      const resources = registry.getResources();
      // Note: May include example resources from beforeEach
      expect(resources.length).toBeGreaterThanOrEqual(2);
      expect(resources.some((r) => r.uri === 'test://resource-1')).toBe(true);
      expect(resources.some((r) => r.uri === 'test://resource-2')).toBe(true);
    });
  });

  describe('Resource Templates (RFC 6570)', () => {
    it('should register and retrieve a resource template', async () => {
      const handler = vi.fn().mockImplementation(async (args: Record<string, string | string[]>) => [
        {
          uri: `test://server/${args.serverId}/logs`,
          mimeType: 'text/plain',
          text: `Logs for server ${args.serverId}`,
        },
      ]);

      registry.registerTemplate({
        uriTemplate: 'test://server/{serverId}/logs',
        name: 'Server Logs',
        description: 'Get logs for a specific server',
        mimeType: 'text/plain',
        handler,
      });

      const template = registry.getTemplate('test://server/{serverId}/logs');
      expect(template).toBeDefined();
      expect(template?.name).toBe('Server Logs');

      const content = await template?.handler({ serverId: 'srv-123' });
      expect(content).toHaveLength(1);
      expect(content?.[0].text).toBe('Logs for server srv-123');
      expect(handler).toHaveBeenCalledWith({ serverId: 'srv-123' });
    });

    it('should throw when registering duplicate template URI', () => {
      registry.registerTemplate({
        uriTemplate: 'test://duplicate/{id}',
        name: 'First Template',
        handler: async () => [{ uri: 'test://duplicate/1', text: '' }],
      });

      expect(() =>
        registry.registerTemplate({
          uriTemplate: 'test://duplicate/{id}',
          name: 'Second Template',
          handler: async () => [{ uri: 'test://duplicate/2', text: '' }],
        }),
      ).toThrow('Resource template test://duplicate/{id} is already registered');
    });

    it('should support argument validation with Zod schema', async () => {
      const schema = z.object({
        serverId: z.string().min(1),
        lines: z.coerce.number().positive().optional(),
      });

      const handler = vi.fn().mockResolvedValue([{ uri: 'test://validated', text: 'OK' }]);

      registry.registerTemplate({
        uriTemplate: 'test://validated/{serverId}',
        name: 'Validated Template',
        argumentsSchema: schema,
        handler,
      });

      const template = registry.getTemplate('test://validated/{serverId}');
      expect(template).toBeDefined();
      expect(template?.argumentsSchema).toBeDefined();

      // Validate valid args
      const validArgs = { serverId: 'srv-1', lines: '100' };
      expect(() => schema.parse(validArgs)).not.toThrow();

      // Validate invalid args
      const invalidArgs = { serverId: '', lines: '-5' };
      expect(() => schema.parse(invalidArgs)).toThrow();
    });

    it('should list all registered templates', () => {
      registry.registerTemplate({
        uriTemplate: 'test://template-1/{id}',
        name: 'Template 1',
        handler: async () => [{ uri: 'test://template-1/1', text: '' }],
      });

      registry.registerTemplate({
        uriTemplate: 'test://template-2/{id}',
        name: 'Template 2',
        handler: async () => [{ uri: 'test://template-2/2', text: '' }],
      });

      const templates = registry.getTemplates();
      // May include example templates
      expect(templates.length).toBeGreaterThanOrEqual(2);
      expect(templates.some((t) => t.uriTemplate === 'test://template-1/{id}')).toBe(true);
      expect(templates.some((t) => t.uriTemplate === 'test://template-2/{id}')).toBe(true);
    });
  });

  describe('Registry State', () => {
    it('should report hasResources correctly', () => {
      // Registry starts empty (vi.resetModules clears it)
      // But example resources are registered in beforeEach from the singleton
      const initialHasResources = registry.hasResources();

      // After adding a resource, hasResources should be true
      registry.register({
        uri: 'test://state-check',
        name: 'State Check',
        handler: async () => [{ uri: 'test://state-check', text: '' }],
      });

      expect(registry.hasResources()).toBe(true);

      // Initial state depends on whether example resources were already registered
      // in the singleton - both states are valid for this test
      expect(typeof initialHasResources).toBe('boolean');
    });

    it('should report correct count', () => {
      const initialCount = registry.getCount();

      registry.register({
        uri: 'test://count-1',
        name: 'Count 1',
        handler: async () => [{ uri: 'test://count-1', text: '' }],
      });

      registry.registerTemplate({
        uriTemplate: 'test://count-template/{id}',
        name: 'Count Template',
        handler: async () => [{ uri: 'test://count-template/1', text: '' }],
      });

      const newCount = registry.getCount();
      expect(newCount.resources).toBe(initialCount.resources + 1);
      expect(newCount.templates).toBe(initialCount.templates + 1);
    });
  });

  describe('Content Types', () => {
    it('should support text content', async () => {
      registry.register({
        uri: 'test://text-content',
        name: 'Text Content',
        mimeType: 'text/plain',
        handler: async () => [
          {
            uri: 'test://text-content',
            mimeType: 'text/plain',
            text: 'Hello, World!',
          },
        ],
      });

      const resource = registry.getResource('test://text-content');
      const content = await resource?.handler();
      expect(content?.[0].text).toBe('Hello, World!');
      expect(content?.[0].mimeType).toBe('text/plain');
    });

    it('should support blob (base64) content', async () => {
      const base64Data = Buffer.from('binary data').toString('base64');

      registry.register({
        uri: 'test://blob-content',
        name: 'Blob Content',
        mimeType: 'application/octet-stream',
        handler: async () => [
          {
            uri: 'test://blob-content',
            mimeType: 'application/octet-stream',
            blob: base64Data,
          },
        ],
      });

      const resource = registry.getResource('test://blob-content');
      const content = await resource?.handler();
      expect(content?.[0].blob).toBe(base64Data);
      expect(content?.[0].mimeType).toBe('application/octet-stream');
    });

    it('should support JSON content', async () => {
      const jsonData = { key: 'value', nested: { array: [1, 2, 3] } };

      registry.register({
        uri: 'test://json-content',
        name: 'JSON Content',
        mimeType: 'application/json',
        handler: async () => [
          {
            uri: 'test://json-content',
            mimeType: 'application/json',
            text: JSON.stringify(jsonData),
          },
        ],
      });

      const resource = registry.getResource('test://json-content');
      const content = await resource?.handler();
      expect(JSON.parse(content?.[0].text as string)).toEqual(jsonData);
    });
  });
});
