/**
 * config 命令 - 配置管理
 */

import { Project } from '../core/project.js';
import { ConfigManager } from '../core/config.js';
import logger from '../utils/logger.js';
import yaml from 'js-yaml';

/**
 * config get <key>
 */
export async function configGetAction(keyPath: string): Promise<void> {
  try {
    const project = await Project.find();
    if (!(await project.isValid())) {
      logger.error('当前目录不是 OW 项目目录');
      return;
    }

    const configManager = new ConfigManager(project);
    const value = await configManager.get(keyPath);

    if (value === undefined) {
      logger.error(`配置项不存在：${keyPath}`);
    } else if (typeof value === 'object') {
      console.log(yaml.dump(value));
    } else {
      console.log(value);
    }
  } catch (error: any) {
    logger.error(`读取配置失败：${error.message}`);
    process.exit(1);
  }
}

/**
 * config set <key> <value>
 */
export async function configSetAction(keyPath: string, value: string): Promise<void> {
  try {
    const project = await Project.find();
    if (!(await project.isValid())) {
      logger.error('当前目录不是 OW 项目目录');
      return;
    }

    const configManager = new ConfigManager(project);
    await configManager.set(keyPath, value);

    logger.success(`配置已更新：${keyPath} = ${value}`);
    logger.info('如需应用配置更改，请运行：ow update');
  } catch (error: any) {
    logger.error(`写入配置失败：${error.message}`);
    process.exit(1);
  }
}

/**
 * config list
 */
export async function configListAction(): Promise<void> {
  try {
    const project = await Project.find();
    if (!(await project.isValid())) {
      logger.error('当前目录不是 OW 项目目录');
      return;
    }

    const configManager = new ConfigManager(project);
    const config = await configManager.list();

    console.log(yaml.dump(config, { indent: 2 }));
  } catch (error: any) {
    logger.error(`读取配置失败：${error.message}`);
    process.exit(1);
  }
}

/**
 * config reset
 */
export async function configResetAction(options: { key?: string }): Promise<void> {
  try {
    const project = await Project.find();
    if (!(await project.isValid())) {
      logger.error('当前目录不是 OW 项目目录');
      return;
    }

    const configManager = new ConfigManager(project);

    if (options?.key) {
      await configManager.reset(options.key);
      logger.success(`配置已重置：${options.key}`);
    } else {
      await configManager.reset();
      logger.success('配置已重置为默认值');
    }

    logger.info('如需应用配置更改，请运行：ow update');
  } catch (error: any) {
    logger.error(`重置配置失败：${error.message}`);
    process.exit(1);
  }
}

/**
 * config path
 */
export async function configPathAction(): Promise<void> {
  try {
    const project = await Project.find();
    console.log(project.configPath);
  } catch (error: any) {
    logger.error(`获取配置路径失败：${error.message}`);
    process.exit(1);
  }
}

/**
 * config edit
 */
export async function configEditAction(): Promise<void> {
  try {
    const project = await Project.find();

    if (!(await project.isValid())) {
      logger.error('当前目录不是 OW 项目目录');
      return;
    }

    const { exec } = await import('child_process');
    const editor = process.env.EDITOR || 'notepad';

    logger.info(`正在打开编辑器：${project.configPath}`);

    exec(`${editor} "${project.configPath}"`, (error: any) => {
      if (error) {
        logger.error(`打开编辑器失败：${error.message}`);
        process.exit(1);
      }
    });
  } catch (error: any) {
    logger.error(`打开编辑器失败：${error.message}`);
    process.exit(1);
  }
}

export default {
  configGetAction,
  configSetAction,
  configListAction,
  configResetAction,
  configPathAction,
  configEditAction,
};
