import { CopilotClient, approveAll } from '@github/copilot-sdk';
import type {
  MCPServerConfig,
  MCPLocalServerConfig,
  MCPRemoteServerConfig,
  PermissionHandler,
  PermissionRequest,
} from '@github/copilot-sdk';
import type { CopilotSession } from '@github/copilot-sdk';
import type { Config, ServerConfig } from '../config/schema.js';
import { logger } from '../utils/logger.js';

export interface AgentOptions {
  model?: string;
  autoApprove?: boolean;
  onPermissionRequest?: PermissionHandler;
}

export interface AskResult {
  content: string;
  sessionId: string;
}

function toMcpServerConfig(config: ServerConfig): MCPServerConfig {
  if (config.type === 'stdio') {
    const localConfig: MCPLocalServerConfig = {
      type: 'stdio',
      command: config.command,
      args: config.args,
      env: config.env,
      tools: ['*'],
    };
    return localConfig;
  }
  const remoteConfig: MCPRemoteServerConfig = {
    type: 'http',
    url: config.url,
    headers: config.headers,
    tools: ['*'],
  };
  return remoteConfig;
}

function buildMcpServers(config: Config): Record<string, MCPServerConfig> {
  const mcpServers: Record<string, MCPServerConfig> = {};
  for (const [name, serverConfig] of Object.entries(config.servers)) {
    mcpServers[name] = toMcpServerConfig(serverConfig);
  }
  return mcpServers;
}

function makePermissionHandler(
  toolApproval: string,
  allowlist: string[] | undefined,
  autoApprove: boolean,
  customHandler?: PermissionHandler
): PermissionHandler {
  if (autoApprove || toolApproval === 'auto') {
    return approveAll;
  }

  if (customHandler) {
    return customHandler;
  }

  if (toolApproval === 'allowlist' && allowlist) {
    return async (request: PermissionRequest) => {
      // PermissionRequest has [key: string]: unknown, so toolName may be present
      const toolName = String((request as Record<string, unknown>)['toolName'] ?? 'unknown');
      if (allowlist.includes(toolName)) {
        return { kind: 'approved' as const };
      }
      return {
        kind: 'denied-by-permission-request-hook' as const,
        message: `Tool '${toolName}' not in allowlist`,
      };
    };
  }

  // Default: deny and prompt user to use --yes flag
  return async (_request: PermissionRequest) => {
    logger.warn('Tool call requires permission. Use --yes or set toolApproval: "auto" in config.');
    return {
      kind: 'denied-by-permission-request-hook' as const,
      message: 'Denied by default. Use --yes to auto-approve.',
    };
  };
}

export class CopilotAgent {
  private client: CopilotClient;
  private session: CopilotSession | null = null;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.client = new CopilotClient();
  }

  async createSession(options: AgentOptions = {}): Promise<CopilotSession> {
    const mcpServers = buildMcpServers(this.config);
    const model = options.model ?? this.config.defaults.model;
    const permissionHandler = makePermissionHandler(
      this.config.defaults.toolApproval,
      this.config.defaults.allowlist,
      options.autoApprove ?? false,
      options.onPermissionRequest
    );

    logger.debug(`Creating Copilot session with model '${model}'`);
    this.session = await this.client.createSession({
      model,
      mcpServers: Object.keys(mcpServers).length > 0 ? mcpServers : undefined,
      onPermissionRequest: permissionHandler,
    });

    return this.session;
  }

  async ask(prompt: string, options: AgentOptions = {}): Promise<AskResult> {
    const session = this.session ?? (await this.createSession(options));

    logger.debug(`Sending prompt to Copilot: ${prompt.slice(0, 80)}...`);
    const event = await session.sendAndWait({ prompt });

    if (!event) {
      return { content: '(no response)', sessionId: session.sessionId };
    }

    return {
      content: event.data.content,
      sessionId: session.sessionId,
    };
  }

  getSession(): CopilotSession | null {
    return this.session;
  }

  async stop(): Promise<void> {
    if (this.session) {
      try {
        await this.session.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.session = null;
    }
    await this.client.stop();
  }
}
