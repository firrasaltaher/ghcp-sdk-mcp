import { Client } from '@modelcontextprotocol/sdk/client';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { Config, ServerConfig } from '../config/schema.js';
import { createTransport } from './transport.js';
import { ConnectionError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface ConnectedServer {
  name: string;
  client: Client;
  tools: Tool[];
}

export class McpClientManager {
  private connections = new Map<string, ConnectedServer>();

  async connect(name: string, config: ServerConfig): Promise<ConnectedServer> {
    if (this.connections.has(name)) {
      return this.connections.get(name)!;
    }

    logger.debug(`Connecting to MCP server '${name}'...`);
    const transport = createTransport(config);
    const client = new Client({ name: 'mcp-cli', version: '0.1.0' });

    try {
      await client.connect(transport);
    } catch (err) {
      throw new ConnectionError(
        `Failed to connect to server '${name}': ${err instanceof Error ? err.message : String(err)}`,
        name
      );
    }

    const { tools } = await client.listTools();
    logger.debug(`Connected to '${name}' with ${tools.length} tool(s)`);

    const server: ConnectedServer = { name, client, tools };
    this.connections.set(name, server);
    return server;
  }

  async connectAll(config: Config): Promise<ConnectedServer[]> {
    const results: ConnectedServer[] = [];
    for (const [name, serverConfig] of Object.entries(config.servers)) {
      const server = await this.connect(name, serverConfig);
      results.push(server);
    }
    return results;
  }

  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const server = this.connections.get(serverName);
    if (!server) {
      throw new ConnectionError(`Server '${serverName}' is not connected`, serverName);
    }

    logger.debug(`Calling tool '${toolName}' on server '${serverName}'`);
    const result = await server.client.callTool({ name: toolName, arguments: args });
    return result;
  }

  getConnected(): ConnectedServer[] {
    return Array.from(this.connections.values());
  }

  getServer(name: string): ConnectedServer | undefined {
    return this.connections.get(name);
  }

  async disconnectAll(): Promise<void> {
    for (const server of this.connections.values()) {
      try {
        await server.client.close();
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.connections.clear();
  }
}
