/**
 * schema 命令 - Schema 管理
 */

import path from 'path';
import fs from 'fs/promises';
import { Project } from '../core/project.js';
import { SchemaEngine } from '../core/schema.js';
import { ConfigManager } from '../core/config.js';
import { fileExists, ensureDir, writeFileSafe } from '../utils/fs.js';
import logger from '../utils/logger.js';
import yaml from 'js-yaml';

/**
 * schema init [name]
 */
export async function schemaInitAction(name?: string): Promise<void> {
  try {
    const project = await Project.find();

    if (!(await project.isValid())) {
      logger.error('当前目录不是 OW 项目目录');
      return;
    }

    const schemaName = name || 'custom';
    const schemaPath = project.getSchemaPath(schemaName);

    if (await fileExists(schemaPath)) {
      logger.error(`Schema 已存在：${schemaName}`);
      return;
    }

    await ensureDir(path.dirname(schemaPath));

    // 创建空白 schema 模板
    const blankSchema = {
      name: schemaName,
      version: '1.0',
      phases: [],
      artifacts: [],
    };

    await writeFileSafe(schemaPath, yaml.dump(blankSchema), { force: true });
    logger.success(`空白 Schema 已创建：${schemaName}`);
    logger.info(`编辑 ${schemaPath} 添加 phases 和 artifacts`);

  } catch (error: any) {
    logger.error(`创建 Schema 失败：${error.message}`);
    process.exit(1);
  }
}

/**
 * schema fork <source> [name]
 */
export async function schemaForkAction(source: string, name?: string): Promise<void> {
  try {
    const project = await Project.find();

    if (!(await project.isValid())) {
      logger.error('当前目录不是 OW 项目目录');
      return;
    }

    const schemaEngine = new SchemaEngine(project);
    const sourceSchema = await schemaEngine.loadSchema(source);

    const newName = name || `${source}-fork`;
    const newPath = project.getSchemaPath(newName);

    if (await fileExists(newPath)) {
      logger.error(`Schema 已存在：${newName}`);
      return;
    }

    // Fork schema
    const forkedSchema = {
      ...sourceSchema,
      name: newName,
      version: '1.0',
    };

    await ensureDir(path.dirname(newPath));
    await writeFileSafe(newPath, yaml.dump(forkedSchema), { force: true });
    logger.success(`Schema 已 Fork: ${source} → ${newName}`);

  } catch (error: any) {
    logger.error(`Fork Schema 失败：${error.message}`);
    process.exit(1);
  }
}

/**
 * schema list
 */
export async function schemaListAction(): Promise<void> {
  try {
    const project = await Project.find();

    if (!(await project.isValid())) {
      logger.error('当前目录不是 OW 项目目录');
      return;
    }

    // 列出项目级 schema
    const projectSchemas: string[] = [];
    if (await fileExists(project.schemasDir)) {
      const files = await fs.readdir(project.schemasDir);
      projectSchemas.push(...files.filter(f => f.endsWith('.yaml')).map(f => f.replace('.yaml', '')));
    }

    // 内置 schema
    const builtInSchemas = ['story-driven'];

    logger.title('可用 Schema');

    if (projectSchemas.length > 0) {
      logger.subtitle('项目级');
      projectSchemas.forEach(s => console.log(`  - ${s}`));
    }

    logger.subtitle('内置');
    builtInSchemas.forEach(s => console.log(`  - ${s}`));

    // 显示当前激活的 schema
    const config = await project.getConfig();
    logger.subtitle('当前激活');
    console.log(`  → ${config.schema.active}`);

  } catch (error: any) {
    logger.error(`列出 Schema 失败：${error.message}`);
    process.exit(1);
  }
}

/**
 * schema show [name]
 */
export async function schemaShowAction(name?: string): Promise<void> {
  try {
    const project = await Project.find();

    if (!(await project.isValid())) {
      logger.error('当前目录不是 OW 项目目录');
      return;
    }

    const schemaEngine = new SchemaEngine(project);
    const schema = await schemaEngine.loadSchema(name);

    logger.title(`Schema: ${schema.name}`);

    console.log(`版本：${schema.version}`);
    console.log(`Phases: ${schema.phases.length}`);
    console.log(`Artifacts: ${schema.artifacts.length}`);

    logger.subtitle('Phases');
    schema.phases
      .sort((a, b) => a.order - b.order)
      .forEach(p => {
        const count = schema.artifacts.filter(a => a.phase === p.id).length;
        console.log(`  ${p.order}. ${p.name} (${count} artifacts)`);
      });

    logger.subtitle('Artifacts');
    for (const artifact of schema.artifacts) {
      const depText = artifact.dependencies.length > 0
        ? ` ← [${artifact.dependencies.join(', ')}]`
        : '';
      const collectionText = artifact.is_collection ? ' [集合]' : '';
      const requiredText = artifact.required ? '' : ' [可选]';
      console.log(`  - ${artifact.id}${collectionText}${requiredText}${depText}`);
    }

  } catch (error: any) {
    logger.error(`获取 Schema 详情失败：${error.message}`);
    process.exit(1);
  }
}

/**
 * schema activate <name>
 */
export async function schemaActivateAction(name: string): Promise<void> {
  try {
    const project = await Project.find();

    if (!(await project.isValid())) {
      logger.error('当前目录不是 OW 项目目录');
      return;
    }

    const schemaEngine = new SchemaEngine(project);
    const configManager = new ConfigManager(project);

    // 验证 schema 存在
    try {
      await schemaEngine.loadSchema(name);
    } catch {
      logger.error(`Schema 不存在：${name}`);
      return;
    }

    // 更新配置
    await configManager.set('schema.active', name);

    logger.success(`Schema 已激活：${name}`);
    logger.info('运行 ow validate --schema 验证新 Schema');

  } catch (error: any) {
    logger.error(`激活 Schema 失败：${error.message}`);
    process.exit(1);
  }
}

/**
 * schema validate [name]
 */
export async function schemaValidateAction(name?: string): Promise<void> {
  try {
    const project = await Project.find();

    if (!(await project.isValid())) {
      logger.error('当前目录不是 OW 项目目录');
      return;
    }

    const schemaEngine = new SchemaEngine(project);
    const schema = await schemaEngine.loadSchema(name);

    logger.title(`验证 Schema: ${schema.name}`);

    const validation = await schemaEngine.validateSchema(schema);

    if (validation.valid) {
      logger.success('Schema 验证通过！');
    } else {
      logger.error('Schema 验证失败：');
      validation.errors.forEach(e => console.log(`  - ${e}`));
      process.exit(1);
    }

  } catch (error: any) {
    logger.error(`验证 Schema 失败：${error.message}`);
    process.exit(1);
  }
}

export default {
  schemaInitAction,
  schemaForkAction,
  schemaListAction,
  schemaShowAction,
  schemaActivateAction,
  schemaValidateAction,
};
