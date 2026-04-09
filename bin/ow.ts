#!/usr/bin/env node

/**
 * OW CLI - Open Writing 项目管理工具
 *
 * 配置驱动的写作项目管理 CLI
 * 技术栈：TypeScript + Commander.js + Zod + Handlebars
 */

import { Command } from 'commander';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 读取 package.json 获取版本
const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, '../../package.json'), 'utf-8')
);

const program = new Command();

program
  .name('ow')
  .description('Open Writing CLI - 配置驱动的写作项目管理工具')
  .version(packageJson.version);

// 注册所有命令
program
  .command('init')
  .argument('[name]', '项目名称')
  .option('--genre <genre>', '小说类型')
  .option('--target-audience <audience>', '目标读者群体')
  .description('初始化项目：创建目录结构、config.yaml、生成 Skills/Agents')
  .action(async (name, options) => {
    const { initAction } = await import('../src/commands/init.command.js');
    await initAction(name, options);
  });

program
  .command('update')
  .option('--skill <name>', '只更新指定技能')
  .option('--dry-run', '预演模式，不实际写入文件')
  .description('基于配置重新生成 Skills/Agents')
  .action(async (options) => {
    const { updateAction } = await import('../src/commands/update.command.js');
    await updateAction(options);
  });

program
  .command('list')
  .option('--phase <phase>', '只显示指定阶段')
  .option('--format <format>', '输出格式 (table|json)', 'table')
  .description('列出工件及其状态')
  .action(async (options) => {
    const { listAction } = await import('../src/commands/list.command.js');
    await listAction(options);
  });

program
  .command('status')
  .option('--phase <phase>', '只显示指定阶段')
  .option('--verbose', '显示详细信息')
  .option('--format <format>', '输出格式 (text|json)', 'text')
  .description('DAG 驱动的项目进度')
  .action(async (options) => {
    const { statusAction } = await import('../src/commands/status.command.js');
    await statusAction(options);
  });

program
  .command('show')
  .argument('<artifact-id>', '工件 ID')
  .option('--deps', '显示依赖关系')
  .option('--content', '显示文件内容')
  .description('查看工件详情')
  .action(async (artifactId, options) => {
    const { showAction } = await import('../src/commands/show.command.js');
    await showAction(artifactId, options);
  });

program
  .command('validate')
  .option('--config', '只验证配置文件')
  .option('--structure', '只验证目录结构')
  .option('--schema', '只验证 schema')
  .option('--deps', '只验证依赖关系')
  .option('--fix', '自动修复可修复的问题')
  .description('多维度验证')
  .action(async (options) => {
    const { validateAction } = await import('../src/commands/validate.command.js');
    await validateAction(options);
  });

program
  .command('archive')
  .option('--label <label>', '归档标签')
  .option('--message <message>', '归档消息')
  .option('--keep <n>', '保留的归档数量', '5')
  .description('归档项目快照')
  .action(async (options) => {
    const { archiveAction } = await import('../src/commands/archive.command.js');
    await archiveAction(options);
  });

program
  .command('config')
  .description('配置管理命令')
  .addCommand(
    new Command('get')
      .argument('<key>', '配置键 (点号路径)')
      .description('读取配置')
      .action(async (key) => {
        const { configGetAction } = await import('../src/commands/config.command.js');
        await configGetAction(key);
      })
  )
  .addCommand(
    new Command('set')
      .argument('<key>', '配置键')
      .argument('<value>', '配置值')
      .description('修改配置')
      .action(async (key, value) => {
        const { configSetAction } = await import('../src/commands/config.command.js');
        await configSetAction(key, value);
      })
  )
  .addCommand(
    new Command('list')
      .description('列出所有配置')
      .action(async () => {
        const { configListAction } = await import('../src/commands/config.command.js');
        await configListAction();
      })
  )
  .addCommand(
    new Command('reset')
      .option('--key <key>', '重置指定配置')
      .description('重置为默认')
      .action(async (options) => {
        const { configResetAction } = await import('../src/commands/config.command.js');
        await configResetAction(options);
      })
  )
  .addCommand(
    new Command('path')
      .description('显示配置路径')
      .action(async () => {
        const { configPathAction } = await import('../src/commands/config.command.js');
        await configPathAction();
      })
  )
  .addCommand(
    new Command('edit')
      .description('打开编辑器')
      .action(async () => {
        const { configEditAction } = await import('../src/commands/config.command.js');
        await configEditAction();
      })
  );

program
  .command('schema')
  .description('Schema 管理命令')
  .addCommand(
    new Command('init')
      .argument('[name]', 'schema 名称')
      .description('创建空白 schema')
      .action(async (name) => {
        const { schemaInitAction } = await import('../src/commands/schema.command.js');
        await schemaInitAction(name);
      })
  )
  .addCommand(
    new Command('fork')
      .argument('<source>', '源 schema')
      .argument('[name]', '新 schema 名称')
      .description('Fork 已有 schema')
      .action(async (source, name) => {
        const { schemaForkAction } = await import('../src/commands/schema.command.js');
        await schemaForkAction(source, name);
      })
  )
  .addCommand(
    new Command('list')
      .description('列出可用 schema')
      .action(async () => {
        const { schemaListAction } = await import('../src/commands/schema.command.js');
        await schemaListAction();
      })
  )
  .addCommand(
    new Command('show')
      .argument('[name]', 'schema 名称')
      .description('查看 schema 详情')
      .action(async (name) => {
        const { schemaShowAction } = await import('../src/commands/schema.command.js');
        await schemaShowAction(name);
      })
  )
  .addCommand(
    new Command('activate')
      .argument('<name>', 'schema 名称')
      .description('激活 schema')
      .action(async (name) => {
        const { schemaActivateAction } = await import('../src/commands/schema.command.js');
        await schemaActivateAction(name);
      })
  )
  .addCommand(
    new Command('validate')
      .argument('[name]', 'schema 名称')
      .description('验证 schema')
      .action(async (name) => {
        const { schemaValidateAction } = await import('../src/commands/schema.command.js');
        await schemaValidateAction(name);
      })
  );

program.parse();
