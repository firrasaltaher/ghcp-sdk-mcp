import type { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from '../../config/loader.js';
import { McpClientManager } from '../../mcp/client-manager.js';
import { formatError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export function registerCallCommand(program: Command): void {
  program
    .command('call <server> <tool> [args]')
    .description('Call a tool on an MCP server')
    .option('-a, --args <json>', 'tool arguments as JSON string')
    .action(async (server: string, tool: string, _args: string | undefined, opts: { args?: string }) => {
      const manager = new McpClientManager();
      const spinner = ora(`Calling ${chalk.cyan(tool)} on ${chalk.green(server)}...`).start();

      try {
        const config = loadConfig(program.opts().config as string | undefined);
        const serverConfig = config.servers[server];
        if (!serverConfig) {
          spinner.fail(`Server '${server}' not found in config`);
          process.exit(1);
        }

        await manager.connect(server, serverConfig);

        let toolArgs: Record<string, unknown> = {};
        const rawArgs = opts.args ?? _args;
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

        if (program.opts().json) {
          console.log(JSON.stringify({ server, tool, args: toolArgs, result }, null, 2));
        } else {
          console.log(chalk.bold('\nResult:\n'));
          console.log(formatToolResult(result));
        }
      } catch (err) {
        spinner.fail(formatError(err, program.opts().debug as boolean));
        logger.debug(String(err));
        process.exit(1);
      } finally {
        await manager.disconnectAll();
      }
    });
}

function formatToolResult(result: unknown): string {
  if (result === null || result === undefined) return chalk.gray('(no result)');

  if (typeof result === 'object') {
    const r = result as Record<string, unknown>;
    // MCP CallToolResult has a `content` array
    if (Array.isArray(r['content'])) {
      return (r['content'] as Array<{ type: string; text?: string }>)
        .filter((c) => c.type === 'text' && c.text)
        .map((c) => c.text!)
        .join('\n');
    }
    return JSON.stringify(result, null, 2);
  }

  return String(result);
}
