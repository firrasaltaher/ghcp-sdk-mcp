import type { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { createInterface } from 'readline';
import { loadConfig } from '../../config/loader.js';
import { CopilotAgent } from '../../copilot/agent.js';
import { formatError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export function registerReplCommand(program: Command): void {
  program
    .command('repl')
    .description('Start an interactive REPL session with GitHub Copilot')
    .option('-m, --model <model>', 'model to use (overrides config)')
    .action(async (opts: { model?: string }) => {
      await startRepl({ model: opts.model, program });
    });
}

interface ReplOptions {
  model?: string;
  program?: Command;
}

export async function startRepl(options: ReplOptions = {}): Promise<void> {
  const program = options.program;
  const config = loadConfig(program?.opts().config as string | undefined);
  const model = options.model ?? config.defaults.model;
  const autoApprove = (program?.opts().yes as boolean) ?? false;
  const agent = new CopilotAgent(config);

  console.log(chalk.bold('\n🤖 MCP CLI - Interactive REPL'));
  console.log(chalk.gray(`Model: ${model} | Type 'exit' or press Ctrl+C to quit\n`));

  try {
    const spinner = ora('Starting Copilot session...').start();
    await agent.createSession({ model, autoApprove });
    spinner.succeed('Session started');

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    const askQuestion = (prompt: string): Promise<string> =>
      new Promise((resolve) => rl.question(prompt, resolve));

    while (true) {
      const input = await askQuestion(chalk.cyan('You: '));
      const trimmed = input.trim();

      if (!trimmed) continue;
      if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        break;
      }

      const spinner2 = ora('Thinking...').start();
      try {
        const result = await agent.ask(trimmed);
        spinner2.stop();
        console.log(chalk.bold('\nCopilot:'), result.content, '\n');
      } catch (err) {
        spinner2.fail(formatError(err, program?.opts().debug as boolean));
      }
    }

    rl.close();
  } catch (err) {
    logger.error(formatError(err, program?.opts().debug as boolean));
    process.exit(1);
  } finally {
    console.log(chalk.gray('\nGoodbye! 👋'));
    await agent.stop();
  }
}


