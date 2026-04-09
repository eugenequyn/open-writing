/**
 * show 命令 - 查看工件详情
 */

import { Project } from '../core/project.js';
import { SchemaEngine } from '../core/schema.js';
import { readFileSafe } from '../utils/fs.js';
import logger from '../utils/logger.js';

export interface ShowOptions {
  deps?: boolean;
  content?: boolean;
}

export async function showAction(artifactId: string, options: ShowOptions): Promise<void> {
  try {
    const project = await Project.find();

    if (!(await project.isValid())) {
      logger.error('当前目录不是 OW 项目目录');
      return;
    }

    const schemaEngine = new SchemaEngine(project);
    const { artifact, dependencies, dependents } = await schemaEngine.getArtifactDependencies(artifactId);
    const status = await schemaEngine.computeArtifactStatus(artifact);

    logger.title(`工件详情：${artifactId}`);

    // 基本信息
    logger.subtitle('基本信息');
    console.log(`  ID:        ${artifact.id}`);
    console.log(`  阶段：     ${artifact.phase}`);
    console.log(`  状态：     ${status.status}`);
    console.log(`  必需：     ${artifact.required ? '是' : '否'}`);
    console.log(`  集合类型： ${artifact.is_collection ? '是' : '否'}`);

    if (status.path) {
      console.log(`  路径：     ${status.path}`);
    }

    if (status.progress !== undefined) {
      console.log(`  进度：     ${status.progress}%`);
    }

    // 依赖关系
    if (options.deps) {
      logger.subtitle('依赖关系');

      if (dependencies.length > 0) {
        console.log('\n  依赖以下工件:');
        for (const dep of dependencies) {
          const depStatus = await schemaEngine.computeArtifactStatus(dep);
          console.log(`    → ${dep.id} (${depStatus.status})`);
        }
      } else {
        console.log('  无依赖');
      }

      if (dependents.length > 0) {
        console.log('\n  被以下工件依赖:');
        for (const dep of dependents) {
          const depStatus = await schemaEngine.computeArtifactStatus(dep);
          console.log(`    ← ${dep.id} (${depStatus.status})`);
        }
      }
    }

    // 显示文件内容
    if (options.content && status.path && status.status === 'completed') {
      logger.subtitle('文件内容');

      const content = await readFileSafe(status.path);
      if (content) {
        // 显示前 50 行
        const lines = content.split('\n');
        const preview = lines.slice(0, 50).join('\n');
        logger.code(preview);

        if (lines.length > 50) {
          logger.info(`... 还有 ${lines.length - 50} 行，请自行打开文件查看`);
        }
      }
    }

  } catch (error: any) {
    logger.error(`获取工件详情失败：${error.message}`);
    process.exit(1);
  }
}

export default showAction;
