import type { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from '../../config/loader.js';
import { CopilotAgent } from '../../copilot/agent.js';
import { formatError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export function registerAskCommand(program: Command): void {
  program
    .command('ask <prompt>')
    .description('Send a prompt to GitHub Copilot with MCP tool support')
    .option('-m, --model <model>', 'model to use (overrides config)')
    .action(async (prompt: string, opts: { model?: string }) => {
      const spinner = ora('Thinking...').start();
      const config = loadConfig(program.opts().config as string | undefined);
      const agent = new CopilotAgent(config);

      try {
        const result = await agent.ask(prompt, {
          model: opts.model ?? config.defaults.model,
          autoApprove: program.opts().yes as boolean,
        });

        spinner.stop();

        if (program.opts().json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(chalk.bold('\nCopilot:\n'));
          console.log(result.content);
          console.log();
          logger.debug(`Session ID: ${result.sessionId}`);
        }
      } catch (err) {
        spinner.fail(formatError(err, program.opts().debug as boolean));
        logger.debug(String(err));
        process.exit(1);
      } finally {
        await agent.stop();
      }
    });
}
