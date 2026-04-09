/**
 * 日志工具 - 使用 chalk 实现终端颜色和 ora 进度动画
 */

import chalk from 'chalk';
import ora, { Ora } from 'ora';

export const logger = {
  // 信息输出
  info(message: string): void {
    console.log(chalk.blue('›') + ' ' + message);
  },

  success(message: string): void {
    console.log(chalk.green('✔') + ' ' + message);
  },

  error(message: string): void {
    console.log(chalk.red('✖') + ' ' + chalk.red(message));
  },

  warn(message: string): void {
    console.log(chalk.yellow('⚠') + ' ' + message);
  },

  // 进度动画
  progress(message: string): Ora {
    return ora(chalk.cyan(message)).start();
  },

  // 分隔线
  divider(): void {
    console.log(chalk.gray('─'.repeat(50)));
  },

  // 标题
  title(text: string): void {
    console.log('\n' + chalk.bold.cyan('【' + text + '】'));
  },

  // 子标题
  subtitle(text: string): void {
    console.log('\n' + chalk.bold.white(text));
  },

  // 代码块
  code(text: string): void {
    console.log(chalk.gray('┌' + '─'.repeat(60) + '┐'));
    text.split('\n').forEach(line => {
      console.log(chalk.gray('│') + ' ' + chalk.gray(line));
    });
    console.log(chalk.gray('└' + '─'.repeat(60) + '┘'));
  },

  // 表格数据
  table(headers: string[], rows: string[][]): void {
    const widths = headers.map((h, i) =>
      Math.max(h.length, ...rows.map(r => r[i]?.length || 0))
    );

    const formatRow = (row: string[]) =>
      row.map((cell, i) => cell.padEnd(widths[i])).join(' │ ');

    console.log('┌' + widths.map(w => '─'.repeat(w)).join('─┬─') + '─┐');
    console.log('│ ' + formatRow(headers) + ' │');
    console.log('├' + widths.map(w => '─'.repeat(w)).join('─┼─') + '─┤');
    rows.forEach(row => {
      console.log('│ ' + formatRow(row) + ' │');
    });
    console.log('└' + widths.map(w => '─'.repeat(w)).join('─┴─') + '─┘');
  },
};

export default logger;
