import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { ServerConfig, StdioServerConfig, HttpServerConfig } from '../config/schema.js';

export function createTransport(config: ServerConfig): Transport {
  if (config.type === 'stdio') {
    return createStdioTransport(config);
  }
  return createHttpTransport(config);
}

function createStdioTransport(config: StdioServerConfig): StdioClientTransport {
  return new StdioClientTransport({
    command: config.command,
    args: config.args,
    env: config.env,
  });
}

function createHttpTransport(config: HttpServerConfig): StreamableHTTPClientTransport {
  return new StreamableHTTPClientTransport(new URL(config.url), {
    requestInit: config.headers ? { headers: config.headers } : undefined,
  });
}
