import type { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createInterface } from 'readline';
import { loadConfig } from '../../config/loader.js';
import { McpClientManager } from '../../mcp/client-manager.js';
import { CopilotAgent } from '../../copilot/agent.js';
import { ConversationSession } from '../../copilot/session.js';
import { outputTools } from '../output.js';
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
  const session = new ConversationSession();
  const manager = new McpClientManager(config.defaults.timeout);

  console.log(chalk.bold('\n🤖 MCP CLI - Interactive REPL'));
  console.log(chalk.gray(`Model: ${model} | Type /help for commands, /exit to quit\n`));

  try {
    const spinner = ora('Starting Copilot session...').start();
    await agent.createSession({ model, autoApprove });

    // Connect to MCP servers for /tools and /servers commands
    const { connected, failed } = await manager.connectAll(config);
    if (connected.length > 0) {
      spinner.succeed(`Session started — connected to: ${connected.map((s) => s.name).join(', ')}`);
    } else {
      spinner.succeed('Session started (no MCP servers connected)');
    }
    if (failed.length > 0) {
      logger.warn(`Failed to connect: ${failed.join(', ')}`);
    }

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    const askQuestion = (prompt: string): Promise<string> =>
      new Promise((resolve) => rl.question(prompt, resolve));

    while (true) {
      const input = await askQuestion(chalk.bold.green('mcp> '));
      const trimmed = input.trim();

      if (!trimmed) continue;

      // Handle slash commands
      if (trimmed.startsWith('/')) {
        const cmd = trimmed.slice(1).split(' ')[0].toLowerCase();

        if (cmd === 'exit' || cmd === 'quit') {
          break;
        } else if (cmd === 'tools') {
          const servers = manager.getConnected();
          if (servers.length === 0) {
            console.log(chalk.gray('No servers connected.'));
          } else {
            for (const s of servers) {
              outputTools(s.name, s.tools);
            }
          }
          continue;
        } else if (cmd === 'servers') {
          const servers = manager.getConnected();
          if (servers.length === 0) {
            console.log(chalk.gray('No servers connected.'));
          } else {
            for (const s of servers) {
              console.log(`  ${chalk.green('●')} ${chalk.bold(s.name)} ${chalk.cyan(`[${s.config.type}]`)} — ${s.tools.length} tools`);
            }
          }
          continue;
        } else if (cmd === 'clear') {
          session.clear();
          console.log(chalk.gray('Conversation cleared.'));
          continue;
        } else if (cmd === 'help') {
          console.log(chalk.bold('\nAvailable commands:'));
          console.log('  /tools   — list available tools');
          console.log('  /servers — list connected servers');
          console.log('  /clear   — reset conversation');
          console.log('  /exit    — quit');
          console.log();
          continue;
        } else {
          logger.warn(`Unknown command: /${cmd}. Type /help for available commands.`);
          continue;
        }
      }

      // Handle exit/quit without slash
      if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        break;
      }

      // AI query
      session.addMessage('user', trimmed);
      const querySpinner = ora('Thinking...').start();
      try {
        const result = await agent.ask(trimmed);
        querySpinner.stop();
        console.log(chalk.bold('\nCopilot:'), result.content, '\n');
        session.addMessage('assistant', result.content);
      } catch (err) {
        querySpinner.fail(formatError(err, program?.opts().debug as boolean));
      }
    }

    rl.close();
  } catch (err) {
    logger.error(formatError(err, program?.opts().debug as boolean));
    process.exit(1);
  } finally {
    console.log(chalk.gray('\nGoodbye! 👋'));
    await manager.disconnectAll();
    await agent.stop();
  }
}