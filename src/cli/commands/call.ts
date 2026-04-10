import type { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from '../../config/loader.js';
import { McpClientManager } from '../../mcp/client-manager.js';
import { outputToolResult } from '../output.js';
import { formatError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export function registerCallCommand(program: Command): void {
  program
    .command('call <server_tool>')
    .description('Call a tool on an MCP server (format: server.tool)')
    .option('-a, --args <json>', 'tool arguments as JSON string')
    .allowUnknownOption(true)
    .action(async (serverTool: string, opts: { args?: string }, cmd) => {
      const manager = new McpClientManager();

      try {
        // Parse server.tool dot notation
        const dotIndex = serverTool.indexOf('.');
        if (dotIndex === -1) {
          logger.error('Invalid format. Use: mcp call <server>.<tool>\nExample: mcp call github.list_repos --args \'{"owner":"microsoft"}\'');
          process.exit(1);
        }
        const server = serverTool.substring(0, dotIndex);
        const tool = serverTool.substring(dotIndex + 1);

        const spinner = ora(`Calling ${chalk.cyan(tool)} on ${chalk.green(server)}...`).start();

        const config = loadConfig(program.opts().config as string | undefined);
        const serverConfig = config.servers[server];
        if (!serverConfig) {
          spinner.fail(`Server '${server}' not found in config`);
          process.exit(1);
        }

        await manager.connect(server, serverConfig);

        let toolArgs: Record<string, unknown> = {};
        // Parse --args flag or remaining positional args
        const rawArgs = opts.args ?? cmd.args[0];
        if (rawArgs) {
          try {
            const parsed = JSON.parse(rawArgs) as unknown;
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
              throw new Error('Tool arguments must be a JSON object');
            }
            toolArgs = parsed as Record<string, unknown>;
          } catch (e) {
            spinner.fail(`Invalid JSON arguments: ${e instanceof Error ? e.message : String(e)}`);
            process.exit(1);
          }
        }

        const result = await manager.callTool(server, tool, toolArgs);
        spinner.succeed(`Tool '${tool}' executed successfully`);

        console.log(chalk.bold('\nResult:\n'));
        outputToolResult(result, { json: program.opts().json as boolean });
      } catch (err) {
        logger.error(formatError(err, program.opts().debug as boolean));
        process.exit(1);
      } finally {
        await manager.disconnectAll();
      }
    });
}
