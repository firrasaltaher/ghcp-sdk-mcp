import type { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import { join } from 'path';
import { loadConfig } from '../../config/loader.js';
import { logger } from '../../utils/logger.js';
import type { ServerConfig } from '../../config/schema.js';

export function registerSetupCommand(program: Command): void {
  program
    .command('setup')
    .description('Interactive setup wizard to configure MCP servers')
    .option('--global', 'save to user config (~/.mcp-cli/config.json)')
    .action(async (opts: { global?: boolean }) => {
      console.log(chalk.bold('\n🔧 MCP CLI Setup Wizard\n'));

      const useGlobal = opts.global === true;
      const configPath = useGlobal
        ? join(homedir(), '.mcp-cli', 'config.json')
        : resolve(process.cwd(), 'mcp.json');

      // Load existing config if present
      let existingConfig: Record<string, unknown> = {};
      if (existsSync(configPath)) {
        try {
          const { readFileSync } = await import('fs');
          existingConfig = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
          logger.info(`Loading existing config from ${configPath}`);
        } catch {
          logger.warn(`Could not read existing config at ${configPath}`);
        }
      }

      const existingServers = (existingConfig['servers'] ?? {}) as Record<string, unknown>;
      const serverNames = Object.keys(existingServers);

      console.log(
        serverNames.length > 0
          ? chalk.gray(`Existing servers: ${serverNames.join(', ')}\n`)
          : chalk.gray('No servers configured yet.\n')
      );

      let addMore = true;
      const newServers: Record<string, ServerConfig> = {};

      while (addMore) {
        const { action } = await inquirer.prompt<{ action: string }>([
          {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
              { name: 'Add a stdio server (spawns a local process)', value: 'add-stdio' },
              { name: 'Add an HTTP server (connects to a remote URL)', value: 'add-http' },
              { name: 'Done', value: 'done' },
            ],
          },
        ]);

        if (action === 'done') {
          addMore = false;
          break;
        }

        if (action === 'add-stdio') {
          const answers = await inquirer.prompt<{
            name: string;
            command: string;
            args: string;
            env: string;
          }>([
            {
              type: 'input',
              name: 'name',
              message: 'Server name (unique identifier):',
              validate: (v: string) => (v.trim() ? true : 'Name is required'),
            },
            {
              type: 'input',
              name: 'command',
              message: 'Command to run:',
              validate: (v: string) => (v.trim() ? true : 'Command is required'),
            },
            {
              type: 'input',
              name: 'args',
              message: 'Arguments (space-separated, or leave empty):',
              default: '',
            },
            {
              type: 'input',
              name: 'env',
              message: 'Env vars as KEY=VALUE pairs (comma-separated, or leave empty):',
              default: '',
            },
          ]);

          const envRecord: Record<string, string> = {};
          if (answers.env.trim()) {
            for (const pair of answers.env.split(',')) {
              const [key, ...valueParts] = pair.trim().split('=');
              if (key) envRecord[key.trim()] = valueParts.join('=').trim();
            }
          }

          newServers[answers.name.trim()] = {
            type: 'stdio',
            command: answers.command.trim(),
            args: answers.args.trim() ? answers.args.trim().split(/\s+/) : [],
            ...(Object.keys(envRecord).length > 0 ? { env: envRecord } : {}),
          };

          logger.success(`Added stdio server '${answers.name.trim()}'`);
        } else if (action === 'add-http') {
          const answers = await inquirer.prompt<{
            name: string;
            url: string;
            headers: string;
          }>([
            {
              type: 'input',
              name: 'name',
              message: 'Server name (unique identifier):',
              validate: (v: string) => (v.trim() ? true : 'Name is required'),
            },
            {
              type: 'input',
              name: 'url',
              message: 'Server URL:',
              validate: (v: string) => {
                try {
                  new URL(v.trim());
                  return true;
                } catch {
                  return 'Please enter a valid URL';
                }
              },
            },
            {
              type: 'input',
              name: 'headers',
              message: 'HTTP headers as Key:Value pairs (comma-separated, or leave empty):',
              default: '',
            },
          ]);

          const headersRecord: Record<string, string> = {};
          if (answers.headers.trim()) {
            for (const pair of answers.headers.split(',')) {
              const [key, ...valueParts] = pair.trim().split(':');
              if (key) headersRecord[key.trim()] = valueParts.join(':').trim();
            }
          }

          newServers[answers.name.trim()] = {
            type: 'http',
            url: answers.url.trim(),
            ...(Object.keys(headersRecord).length > 0 ? { headers: headersRecord } : {}),
          };

          logger.success(`Added HTTP server '${answers.name.trim()}'`);
        }
      }

      if (Object.keys(newServers).length === 0) {
        logger.info('No changes made.');
        return;
      }

      const mergedServers = { ...existingServers, ...newServers };

      // Load current config for defaults
      let currentConfig: Record<string, unknown> = {};
      try {
        currentConfig = loadConfig(useGlobal ? configPath : undefined) as unknown as Record<string, unknown>;
      } catch {
        // Use empty defaults if config doesn't exist yet
      }

      const outputConfig = {
        ...currentConfig,
        servers: mergedServers,
      };

      if (useGlobal) {
        mkdirSync(join(homedir(), '.mcp-cli'), { recursive: true });
      }

      writeFileSync(configPath, JSON.stringify(outputConfig, null, 2) + '\n', 'utf-8');
      logger.success(`\nConfig saved to ${chalk.cyan(configPath)}`);
      console.log(
        chalk.gray(`Run ${chalk.cyan('mcp list servers')} to verify your configuration.\n`)
      );
    });
}
