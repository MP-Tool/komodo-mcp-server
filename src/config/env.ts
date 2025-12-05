import { z } from 'zod';

export const envSchema = z.object({
  VERSION: z.string().default(process.env.npm_package_version || 'unknown'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MCP_BIND_HOST: z.string().default('127.0.0.1'),
  MCP_PORT: z.string().transform((val) => parseInt(val, 10)).refine((val) => !isNaN(val), { message: "Port must be a valid number" }).default('3000'),
  MCP_TRANSPORT: z.enum(['stdio', 'sse']).default('sse'),
  MCP_ALLOWED_ORIGINS: z.string().transform((val) => {
    const list = val.split(',').map(o => o.trim()).filter(o => o.length > 0);
    return list.length > 0 ? list : undefined;
  }).optional(),
  MCP_ALLOWED_HOSTS: z.string().transform((val) => {
    const list = val.split(',').map(h => h.trim()).filter(h => h.length > 0);
    return list.length > 0 ? list : undefined;
  }).optional(),
  KOMODO_URL: z.string().url().optional(),
  KOMODO_USERNAME: z.string().optional(),
  KOMODO_PASSWORD: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const config = envSchema.parse(process.env);
