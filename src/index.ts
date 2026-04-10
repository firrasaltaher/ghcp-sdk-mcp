#!/usr/bin/env node
import { program } from 'commander';
import { registerListCommands } from './cli/commands/list.js';
import { registerCallCommand } from './cli/commands/call.js';
import { registerAskCommand } from './cli/commands/ask.js';
import { registerReplCommand } from './cli/commands/repl.js';
import { registerSetupCommand } from './cli/commands/setup.js';
import { logger } from './utils/logger.js';

program
  .name('mcp')
  .description('CLI tool for consuming MCP servers with GitHub Copilot SDK orchestration')
  .version('0.1.0')
  .option('-d, --debug', 'enable debug logging')
  .option('--config <path>', 'path to config file')
  .option('--json', 'output as JSON')
  .option('-y, --yes', 'auto-approve all tool calls');

program.hook('preAction', (thisCommand) => {
  if (thisCommand.opts().debug) {
    logger.setDebug(true);
  }
});

registerListCommands(program);
registerCallCommand(program);
registerAskCommand(program);
registerSetupCommand(program);
registerReplCommand(program);

program.action(async () => {
  try {
    const { startRepl } = await import('./cli/commands/repl.js');
    await startRepl({ program });
  } catch (error) {
    console.error('Failed to start REPL:', error);
    process.exitCode = 1;
  }
});

program.parse(process.argv);
