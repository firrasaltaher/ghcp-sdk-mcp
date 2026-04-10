import chalk from 'chalk';

class Logger {
  private debug_mode = false;

  setDebug(enabled: boolean) {
    this.debug_mode = enabled;
  }

  info(msg: string) {
    console.log(chalk.blue('ℹ'), msg);
  }

  success(msg: string) {
    console.log(chalk.green('✓'), msg);
  }

  warn(msg: string) {
    console.warn(chalk.yellow('⚠'), msg);
  }

  error(msg: string) {
    console.error(chalk.red('✗'), msg);
  }

  debug(msg: string) {
    if (this.debug_mode) {
      console.log(chalk.gray('[debug]'), msg);
    }
  }
}

export const logger = new Logger();
