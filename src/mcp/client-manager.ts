import { Client } from '@modelcontextprotocol/sdk/client';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { Config, ServerConfig } from '../config/schema.js';
import { createTransport } from './transport.js';
import { ConnectionError, TimeoutError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface ConnectedServer {
  name: string;
  config: ServerConfig;
  client: Client;
  tools: Tool[];
  status: 'connected' | 'disconnected' | 'error';
  error?: string;
}

export class McpClientManager {
  private connections = new Map<string, ConnectedServer>();
  private timeout: number;

  constructor(timeout = 30000) {
    this.timeout = timeout;
  }

  async connect(name: string, config: ServerConfig): Promise<ConnectedServer> {
    if (this.connections.has(name)) {
      return this.connections.get(name)!;
    }

    logger.debug(`Connecting to MCP server '${name}'...`);
    const transport = createTransport(config);
    const client = new Client({ name: 'mcp-cli', version: '0.1.0' });

    try {
      await Promise.race([
        client.connect(transport),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new TimeoutError(`Connection to '${name}' timed out`, this.timeout)),
            this.timeout
          )
        ),
      ]);
    } catch (err) {
      if (err instanceof TimeoutError) throw err;
      throw new ConnectionError(
        `Failed to connect to server '${name}': ${err instanceof Error ? err.message : String(err)}`,
        name
      );
    }

    const { tools } = await client.listTools();
    logger.debug(`Connected to '${name}' with ${tools.length} tool(s)`);

    const server: ConnectedServer = { name, config, client, tools, status: 'connected' };
    this.connections.set(name, server);
    return server;
  }

  async connectAll(config: Config): Promise<{ connected: ConnectedServer[]; failed: string[] }> {
    const entries = Object.entries(config.servers);
    const results = await Promise.allSettled(
      entries.map(([name, serverConfig]) => this.connect(name, serverConfig))
    );

    const connected: ConnectedServer[] = [];
    const failed: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const name = entries[i][0];
      if (result.status === 'fulfilled') {
        connected.push(result.value);
      } else {
        logger.warn(
          `Failed to connect to '${name}': ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`
        );
        failed.push(name);
      }
    }

    return { connected, failed };
  }

  async reconnect(name: string, config: ServerConfig): Promise<ConnectedServer> {
    await this.disconnect(name);
    return this.connect(name, config);
  }

  async disconnect(name: string): Promise<void> {
    const server = this.connections.get(name);
    if (server) {
      try {
        await server.client.close();
      } catch {
        // Ignore errors during cleanup
      }
      this.connections.delete(name);
    }
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
    const result = await Promise.race([
      server.client.callTool({ name: toolName, arguments: args }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new TimeoutError(`Tool call '${toolName}' timed out`, this.timeout)),
          this.timeout
        )
      ),
    ]);
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
