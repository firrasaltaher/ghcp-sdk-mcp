import type { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from '../../config/loader.js';
import { McpClientManager } from '../../mcp/client-manager.js';
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
        const servers = Object.entries(config.servers);

        if (program.opts().json) {
          console.log(JSON.stringify({ servers: config.servers }, null, 2));
          return;
        }

        if (servers.length === 0) {
          logger.warn('No servers configured. Run `mcp setup` to add servers.');
          return;
        }

        console.log(chalk.bold('\nConfigured MCP Servers:\n'));
        for (const [name, serverConfig] of servers) {
          const typeLabel = chalk.cyan(`[${serverConfig.type}]`);
          const detail =
            serverConfig.type === 'stdio'
              ? chalk.gray(`${serverConfig.command} ${serverConfig.args.join(' ')}`)
              : chalk.gray(serverConfig.url);
          console.log(`  ${chalk.green(name)} ${typeLabel} ${detail}`);
        }
        console.log();
      } catch (err) {
        logger.error(formatError(err, program.opts().debug as boolean));
        process.exit(1);
      }
    });

  list
    .command('tools [server]')
    .description('List tools from a specific server or all servers')
    .action(async (server?: string) => {
      const manager = new McpClientManager();
      try {
        const config = loadConfig(program.opts().config as string | undefined);

        if (server) {
          const serverConfig = config.servers[server];
          if (!serverConfig) {
            logger.error(`Server '${server}' not found in config`);
            process.exit(1);
          }
          const connected = await manager.connect(server, serverConfig);
          printTools(server, connected.tools, program.opts().json as boolean);
        } else {
          const allServers = await manager.connectAll(config);
          if (allServers.length === 0) {
            logger.warn('No servers configured. Run `mcp setup` to add servers.');
            return;
          }
          if (program.opts().json) {
            const output: Record<string, unknown> = {};
            for (const s of allServers) {
              output[s.name] = s.tools;
            }
            console.log(JSON.stringify(output, null, 2));
            return;
          }
          for (const s of allServers) {
            printTools(s.name, s.tools, false);
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

function printTools(
  serverName: string,
  tools: Array<{ name: string; description?: string; inputSchema?: unknown }>,
  asJson: boolean
): void {
  if (asJson) {
    console.log(JSON.stringify({ server: serverName, tools }, null, 2));
    return;
  }

  console.log(chalk.bold(`\nTools from ${chalk.green(serverName)}:\n`));
  if (tools.length === 0) {
    console.log(chalk.gray('  (no tools available)'));
    return;
  }
  for (const tool of tools) {
    console.log(`  ${chalk.cyan(tool.name)}`);
    if (tool.description) {
      console.log(`    ${chalk.gray(tool.description)}`);
    }
  }
  console.log();
}
