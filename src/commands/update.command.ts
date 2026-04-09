/**
 * update 命令 - 基于配置重新生成 Skills/Agents
 */

import path from 'path';
import { Project } from '../core/project.js';
import { TemplateEngine } from '../core/template.js';
import { fileExists } from '../utils/fs.js';
import logger from '../utils/logger.js';

export interface UpdateOptions {
  skill?: string;
  dryRun?: boolean;
}

export async function updateAction(options: UpdateOptions): Promise<void> {
  try {
    const project = await Project.find();

    if (!(await project.isValid())) {
      logger.error('当前目录不是 OW 项目目录');
      logger.info('运行 ow init 初始化项目');
      return;
    }

    const config = await project.getConfig();
    const templateEngine = new TemplateEngine(project);

    logger.title('OW CLI - 更新项目');

    if (options.dryRun) {
      logger.info('预演模式：不会实际写入文件');
    }

    // 更新 Skills
    const skills = options.skill ? [options.skill] : ['builder', 'plot', 'write', 'style'];
    const skillsDir = path.join(project.claudeDir, 'skills');

    logger.subtitle('更新 Skills');

    for (const skill of skills) {
      const templateName = `skills/${skill}.skill`;
      const outputPath = path.join(skillsDir, skill, 'SKILL.md');

      try {
        const needsUpdate = await templateEngine.needsUpdate(outputPath, templateName);

        if (needsUpdate.needsUpdate) {
          if (options.dryRun) {
            logger.info(`  → ${skill}: 需要更新 (${needsUpdate.reason})`);
          } else {
            if (await fileExists(outputPath)) {
              logger.warn(`  ⚠ ${skill}: 文件已存在且可能已手动修改`);
            }
            await templateEngine.renderToFile(templateName, outputPath, { config }, { force: true });
            logger.success(`  ✓ ${skill}: 已更新`);
          }
        } else {
          logger.info(`  ✓ ${skill}: 已是最新`);
        }
      } catch (error: any) {
        logger.warn(`  ⚠ ${skill}: 模板不存在，跳过`);
      }
    }

    // 更新 Agents
    if (!options.skill) {
      const agents = ['world-builder', 'character-arch'];
      const agentsDir = path.join(project.claudeDir, 'agents');

      logger.subtitle('更新 Agents');

      for (const agent of agents) {
        const templateName = `agents/${agent}`;
        const outputPath = path.join(agentsDir, `${agent}.md`);

        try {
          const needsUpdate = await templateEngine.needsUpdate(outputPath, templateName);

          if (needsUpdate.needsUpdate) {
            if (options.dryRun) {
              logger.info(`  → ${agent}: 需要更新 (${needsUpdate.reason})`);
            } else {
              await templateEngine.renderToFile(templateName, outputPath, { config }, { force: true });
              logger.success(`  ✓ ${agent}: 已更新`);
            }
          } else {
            logger.info(`  ✓ ${agent}: 已是最新`);
          }
        } catch (error: any) {
          logger.warn(`  ⚠ ${agent}: 模板不存在，跳过`);
        }
      }
    }

    logger.divider();
    if (options.dryRun) {
      logger.success('预演完成。移除 --dry-run 以实际更新文件。');
    } else {
      logger.success('✅ 更新完成！');
    }

  } catch (error: any) {
    logger.error(`更新失败：${error.message}`);
    process.exit(1);
  }
}

export default updateAction;
