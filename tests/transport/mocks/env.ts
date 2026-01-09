import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// tests/transport/mocks/env.ts -> ../../../package.json
const packageJsonPath = path.resolve(__dirname, '../../../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

export const config = {
  MCP_PORT: 3000,
  MCP_BIND_HOST: '127.0.0.1',
  VERSION: packageJson.version,
  MCP_TRANSPORT: 'sse',
};
