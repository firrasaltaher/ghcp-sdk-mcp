import type { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import { join } from 'path';
import { logger } from '../../utils/logger.js';
import type { ServerConfig } from '../../config/schema.js';

interface PopularServer {
  name: string;
  label: string;
  config: ServerConfig;
  requiresEnv: string[];
  defaultSelected: boolean;
}

const POPULAR_SERVERS: PopularServer[] = [
  {
    name: 'mslearn',
    label: 'Microsoft Learn (public, no auth, HTTP)',
    config: {
      type: 'http',
      url: 'https://learn.microsoft.com/api/mcp',
    },
    requiresEnv: [],
    defaultSelected: true,
  },
  {
    name: 'github',
    label: 'GitHub (needs GITHUB_TOKEN)',
    config: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: { GITHUB_TOKEN: '${env:GITHUB_TOKEN}' },
    },
    requiresEnv: ['GITHUB_TOKEN'],
    defaultSelected: false,
  },
  {
    name: 'azure',
    label: 'Azure (needs az login)',
    config: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@azure/mcp@latest', 'server', 'start'],
    },
    requiresEnv: [],
    defaultSelected: false,
  },
  {
    name: 'filesystem',
    label: 'Filesystem (local, no auth)',
    config: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
    },
    requiresEnv: [],
    defaultSelected: false,
  },
];

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

      // Step 1: Select from popular servers
      const { selectedServers } = await inquirer.prompt<{ selectedServers: string[] }>([
        {
          type: 'checkbox',
          name: 'selectedServers',
          message: 'Select MCP servers to configure:',
          choices: POPULAR_SERVERS.map((s) => ({
            name: s.label,
            value: s.name,
            checked: s.defaultSelected,
          })),
        },
      ]);

      const servers: Record<string, ServerConfig> = {};

      // Add selected popular servers
      for (const serverName of selectedServers) {
        const serverDef = POPULAR_SERVERS.find((s) => s.name === serverName);
        if (!serverDef) continue;

        // Check required env vars
        for (const envVar of serverDef.requiresEnv) {
          if (!process.env[envVar]) {
            console.log(chalk.yellow(`\n⚠ ${envVar} is required for ${serverDef.label} but not set.`));
            console.log(chalk.gray(`  Set it with: export ${envVar}=<value>`));
          }
        }

        servers[serverDef.name] = serverDef.config;
        logger.success(`Added ${serverDef.label}`);
      }

      // Step 2: Ask about additional custom servers
      const { addCustom } = await inquirer.prompt<{ addCustom: boolean }>([
        {
          type: 'confirm',
          name: 'addCustom',
          message: 'Add a custom server?',
          default: false,
        },
      ]);

      if (addCustom) {
        let addMore = true;
        while (addMore) {
          const { action } = await inquirer.prompt<{ action: string }>([
            {
              type: 'list',
              name: 'action',
              message: 'Server type:',
              choices: [
                { name: 'stdio (spawns a local process)', value: 'add-stdio' },
                { name: 'HTTP (connects to a remote URL)', value: 'add-http' },
                { name: 'Done adding custom servers', value: 'done' },
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

            servers[answers.name.trim()] = {
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

            servers[answers.name.trim()] = {
              type: 'http',
              url: answers.url.trim(),
              ...(Object.keys(headersRecord).length > 0 ? { headers: headersRecord } : {}),
            };

            logger.success(`Added HTTP server '${answers.name.trim()}'`);
          }
        }
      }

      if (Object.keys(servers).length === 0) {
        logger.info('No servers selected. Exiting setup.');
        return;
      }

      // Step 3: Defaults
      const { model, toolApproval } = await inquirer.prompt<{
        model: string;
        toolApproval: string;
      }>([
        {
          type: 'list',
          name: 'model',
          message: 'Default AI model:',
          choices: ['gpt-4.1', 'gpt-4o', 'gpt-4-turbo'],
          default: 'gpt-4.1',
        },
        {
          type: 'list',
          name: 'toolApproval',
          message: 'Tool approval policy:',
          choices: [
            { name: 'prompt — ask before each tool call (recommended)', value: 'prompt' },
            { name: 'auto — approve all tool calls automatically', value: 'auto' },
            { name: 'allowlist — auto-approve listed tools, prompt for others', value: 'allowlist' },
          ],
          default: 'prompt',
        },
      ]);

      const outputConfig = {
        servers,
        defaults: {
          model,
          toolApproval,
          timeout: 30000,
        },
      };

      if (useGlobal) {
        mkdirSync(join(homedir(), '.mcp-cli'), { recursive: true });
      }

      writeFileSync(configPath, JSON.stringify(outputConfig, null, 2) + '\n', 'utf-8');
      logger.success(`Config saved to ${chalk.cyan(configPath)}`);
      console.log(
        chalk.gray(`\nNext steps:`)
      );
      console.log(chalk.gray(`  mcp list servers   # verify configuration`));
      console.log(chalk.gray(`  mcp list tools     # explore available tools`));
      console.log(chalk.gray(`  mcp ask "..."      # ask a question`));
      console.log(chalk.gray(`  mcp                # start interactive mode\n`));
    });
}
