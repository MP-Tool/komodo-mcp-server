import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MCP_PORT: z.string().transform((val) => parseInt(val, 10)).default('3000'),
  MCP_TRANSPORT: z.enum(['stdio', 'sse']).default('stdio'),
  KOMODO_URL: z.string().url().optional(),
  KOMODO_USERNAME: z.string().optional(),
  KOMODO_PASSWORD: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const config = envSchema.parse(process.env);
