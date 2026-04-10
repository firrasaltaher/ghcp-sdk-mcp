import type { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../../config/loader.js';
import { McpClientManager } from '../../mcp/client-manager.js';
import { outputServers, outputTools } from '../output.js';
import { formatError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export function registerListCommands(program: Command): void {
  const list = program
    .command('list')
    .description('List configured servers or available tools');

  list
    .command('servers')
    .description('List all configured MCP servers')
    .action(async () => {
      try {
        const config = loadConfig(program.opts().config as string | undefined);
        const entries = Object.entries(config.servers);

        if (entries.length === 0) {
          logger.warn('No servers configured. Run `mcp setup` to add servers.');
          return;
        }

        const manager = new McpClientManager(config.defaults.timeout);
        const spinner = ora('Connecting to MCP servers...').start();
        const { connected, failed } = await manager.connectAll(config);
        spinner.stop();

        const serverInfos = entries.map(([name, serverConfig]) => {
          const conn = connected.find((c) => c.name === name);
          return {
            name,
            type: serverConfig.type,
            status: conn ? 'connected' : failed.includes(name) ? 'error' : 'disconnected',
            detail:
              serverConfig.type === 'stdio'
                ? `${serverConfig.command} ${serverConfig.args.join(' ')}`
                : serverConfig.url,
            toolCount: conn?.tools.length ?? 0,
            error: failed.includes(name) ? 'connection failed' : undefined,
          };
        });

        outputServers(serverInfos, { json: program.opts().json as boolean });
        await manager.disconnectAll();
      } catch (err) {
        logger.error(formatError(err, program.opts().debug as boolean));
        process.exit(1);
      }
    });

  list
    .command('tools [server]')
    .description('List tools from a specific server or all servers')
    .action(async (server?: string) => {
      const config = loadConfig(program.opts().config as string | undefined);
      const manager = new McpClientManager(config.defaults.timeout);
      try {
        if (server) {
          const serverConfig = config.servers[server];
          if (!serverConfig) {
            logger.error(`Server '${server}' not found in config`);
            process.exit(1);
          }
          const spinner = ora(`Connecting to ${server}...`).start();
          const connected = await manager.connect(server, serverConfig);
          spinner.stop();
          outputTools(server, connected.tools, { json: program.opts().json as boolean });
        } else {
          const spinner = ora('Connecting to MCP servers...').start();
          const { connected } = await manager.connectAll(config);
          spinner.stop();

          if (connected.length === 0) {
            logger.warn('No servers connected. Run `mcp setup` to add servers.');
            return;
          }
          if (program.opts().json) {
            const output: Record<string, unknown> = {};
            for (const s of connected) {
              output[s.name] = s.tools;
            }
            console.log(JSON.stringify(output, null, 2));
            return;
          }
          for (const s of connected) {
            outputTools(s.name, s.tools);
          }
        }
      } catch (err) {
        logger.error(formatError(err, program.opts().debug as boolean));
        process.exit(1);
      } finally {
        await manager.disconnectAll();
      }
    });
}
