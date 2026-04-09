/**
 * status 命令 - DAG 驱动的项目进度
 */

import { Project } from '../core/project.js';
import { SchemaEngine } from '../core/schema.js';
import logger from '../utils/logger.js';

export interface StatusOptions {
  phase?: string;
  verbose?: boolean;
  format?: 'text' | 'json';
}

export async function statusAction(options: StatusOptions): Promise<void> {
  try {
    const project = await Project.find();

    if (!(await project.isValid())) {
      logger.error('当前目录不是 OW 项目目录');
      logger.info('运行 ow init 初始化项目');
      return;
    }

    const schemaEngine = new SchemaEngine(project);
    const phases = await schemaEngine.getPhases();
    const statuses = await schemaEngine.computeAllStatuses();
    const frontier = await schemaEngine.computeFrontier();

    if (options.format === 'json') {
      const output = {
        phases: phases.map(p => ({
          id: p.id,
          name: p.name,
          order: p.order,
          artifacts: p.artifacts.map(a => ({
            id: a.id,
            status: statuses[a.id].status,
            progress: statuses[a.id].progress,
          })),
        })),
        frontier,
      };
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    // 文本格式输出
    logger.title('OW CLI - 项目状态');

    // 计算总体进度
    const totalArtifacts = Object.keys(statuses).length;
    const completedArtifacts = Object.values(statuses).filter(
      s => s.status === 'completed'
    ).length;
    const progressPercent = Math.round((completedArtifacts / totalArtifacts) * 100);

    console.log(`\n总体进度：${completedArtifacts}/${totalArtifacts} (${progressPercent}%)`);
    console.log(`完成进度：${'█'.repeat(Math.floor(progressPercent / 5))}${'░'.repeat(20 - Math.floor(progressPercent / 5))} ${progressPercent}%`);

    // 按阶段显示
    for (const phase of phases) {
      if (options.phase && phase.id !== options.phase) continue;

      logger.subtitle(`Phase ${phase.order}: ${phase.name}`);

      const rows: string[][] = [];
      for (const artifact of phase.artifacts) {
        const state = statuses[artifact.id];
        const statusIcon = getStatusIcon(state.status);

        let rowText = `${statusIcon} ${artifact.id}`;

        if (state.progress !== undefined && state.progress > 0) {
          rowText += ` (${state.progress}%)`;
        }

        if (options.verbose && state.path) {
          rowText += ` → ${state.path}`;
        }

        // 检查是否在 frontier 中
        if (frontier.includes(artifact.id)) {
          rowText += ' ⬅ 下一步可执行';
        }

        rows.push([rowText]);
      }

      // 简单表格显示
      rows.forEach(row => console.log(`  ${row[0]}`));
    }

    // 显示下一步建议
    if (frontier.length > 0) {
      logger.subtitle('下一步可执行');
      frontier.forEach(id => {
        console.log(`  → ${id}`);
      });
    }

  } catch (error: any) {
    logger.error(`获取状态失败：${error.message}`);
    process.exit(1);
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'completed':
      return '✅';
    case 'in_progress':
      return '🔄';
    case 'pending':
      return '⏳';
    case 'blocked':
      return '🔒';
    default:
      return '❓';
  }
}

export default statusAction;
