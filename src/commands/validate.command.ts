/**
 * validate 命令 - 多维度验证
 */

import path from 'path';
import fs from 'fs/promises';
import { Project } from '../core/project.js';
import { configSchema } from '../core/config.js';
import { SchemaEngine } from '../core/schema.js';
import { fileExists } from '../utils/fs.js';
import logger from '../utils/logger.js';
import yaml from 'js-yaml';
import { z } from 'zod';

export interface ValidateOptions {
  config?: boolean;
  structure?: boolean;
  schema?: boolean;
  deps?: boolean;
  fix?: boolean;
}

export async function validateAction(options: ValidateOptions): Promise<void> {
  try {
    const project = await Project.find();

    // 如果没有指定验证类型，验证所有
    const validateAll = !options.config && !options.structure && !options.schema && !options.deps;

    const results: { name: string; passed: boolean; errors: string[]; warnings: string[] }[] = [];

    // 1. 配置验证
    if (validateAll || options.config) {
      const result = await validateConfig(project);
      results.push(result);
    }

    // 2. 结构验证
    if (validateAll || options.structure) {
      const result = await validateStructure(project);
      results.push(result);
    }

    // 3. Schema 验证
    if (validateAll || options.schema) {
      const result = await validateSchema(project);
      results.push(result);
    }

    // 4. 依赖验证
    if (validateAll || options.deps) {
      const result = await validateDependencies(project);
      results.push(result);
    }

    // 输出结果
    logger.title('验证结果');

    let allPassed = true;
    for (const result of results) {
      const icon = result.passed ? '✅' : '❌';
      console.log(`\n${icon} ${result.name}`);

      if (result.errors.length > 0) {
        console.log('  错误:');
        result.errors.forEach(e => console.log(`    - ${e}`));
      }

      if (result.warnings.length > 0) {
        console.log('  警告:');
        result.warnings.forEach(w => console.log(`    - ${w}`));
      }

      if (!result.passed) {
        allPassed = false;
      }
    }

    logger.divider();

    if (allPassed) {
      logger.success('所有验证通过！');
    } else {
      logger.error('验证失败，请修复上述问题');
      process.exit(1);
    }

  } catch (error: any) {
    logger.error(`验证失败：${error.message}`);
    process.exit(1);
  }
}

/**
 * 验证配置文件
 */
async function validateConfig(project: Project): Promise<{ name: string; passed: boolean; errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // 检查配置文件是否存在
    if (!(await fileExists(project.configPath))) {
      errors.push('配置文件不存在：.ow/config.yaml');
      return { name: '配置验证', passed: false, errors, warnings };
    }

    // 读取并解析配置
    const content = await fs.readFile(project.configPath, 'utf-8');
    const parsed = yaml.load(content) as Record<string, unknown>;

    // Zod 验证
    try {
      configSchema.parse(parsed);
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach(e => {
          errors.push(`${e.path.join('.')}: ${e.message}`);
        });
      }
    }

    // 额外验证规则
    if (parsed.agents) {
      const agents = parsed.agents as Record<string, any>;
      if (agents['world-builder']) {
        const count = agents['world-builder'].count;
        if (count < 1 || count > 10) {
          warnings.push('agents.world-builder.count 应在 1-10 范围内');
        }
      }
    }

  } catch (error: any) {
    errors.push(`读取配置文件失败：${error.message}`);
  }

  return {
    name: '配置验证',
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 验证目录结构
 */
async function validateStructure(project: Project): Promise<{ name: string; passed: boolean; errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 必需目录
  const requiredDirs = [
    project.owDir,
    project.schemasDir,
  ];

  for (const dir of requiredDirs) {
    if (!(await fileExists(dir))) {
      errors.push(`必需目录不存在：${path.relative(project.rootDir, dir)}`);
    }
  }

  // 检查输出目录（如果配置了）
  try {
    const config = await project.getConfig();
    const outputDirs = [
      config.paths.world_dir,
      config.paths.characters_dir,
      config.paths.chapters_dir,
    ].filter(Boolean);

    for (const dir of outputDirs) {
      const fullPath = path.join(project.rootDir, dir!);
      if (!(await fileExists(fullPath))) {
        warnings.push(`输出目录不存在：${dir}`);
      }
    }
  } catch {
    // 配置可能无效，已在配置验证中报告
  }

  return {
    name: '结构验证',
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 验证 Schema
 */
async function validateSchema(project: Project): Promise<{ name: string; passed: boolean; errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const schemaEngine = new SchemaEngine(project);
    const schema = await schemaEngine.getActiveSchema();

    // 使用 SchemaEngine 的验证方法
    const validation = await schemaEngine.validateSchema(schema);

    if (!validation.valid) {
      validation.errors.forEach(e => errors.push(e));
    }

  } catch (error: any) {
    errors.push(`Schema 验证失败：${error.message}`);
  }

  return {
    name: 'Schema 验证',
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 验证依赖关系
 */
async function validateDependencies(project: Project): Promise<{ name: string; passed: boolean; errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const schemaEngine = new SchemaEngine(project);
    const statuses = await schemaEngine.computeAllStatuses();

    // 检查是否有 pending 的工件阻塞了其他工件
    for (const [id, status] of Object.entries(statuses)) {
      if (status.status === 'pending') {
        // 检查是否有依赖它的工件已经是 in_progress 或 completed
        const { dependents } = await schemaEngine.getArtifactDependencies(id);
        for (const dep of dependents) {
          const depStatus = statuses[dep.id];
          if (depStatus && (depStatus.status === 'in_progress' || depStatus.status === 'completed')) {
            warnings.push(`工件 ${id} 未完成，但依赖它的 ${dep.id} 已开始/完成`);
          }
        }
      }
    }

  } catch (error: any) {
    errors.push(`依赖验证失败：${error.message}`);
  }

  return {
    name: '依赖验证',
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

export default validateAction;
