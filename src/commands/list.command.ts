/**
 * list 命令 - 列出工件及其状态
 */

import { Project } from '../core/project.js';
import { SchemaEngine } from '../core/schema.js';
import logger from '../utils/logger.js';

export interface ListOptions {
  phase?: string;
  format?: 'table' | 'json';
}

export async function listAction(options: ListOptions): Promise<void> {
  try {
    const project = await Project.find();

    if (!(await project.isValid())) {
      logger.error('当前目录不是 OW 项目目录');
      return;
    }

    const schemaEngine = new SchemaEngine(project);
    const phases = await schemaEngine.getPhases();
    const statuses = await schemaEngine.computeAllStatuses();

    if (options.format === 'json') {
      const artifacts = phases.flatMap(p =>
        p.artifacts.map(a => ({
          id: a.id,
          phase: p.id,
          phaseName: p.name,
          status: statuses[a.id].status,
          progress: statuses[a.id].progress,
          required: a.required,
          is_collection: a.is_collection,
        }))
      );

      const filtered = options.phase
        ? artifacts.filter(a => a.phase === options.phase)
        : artifacts;

      console.log(JSON.stringify(filtered, null, 2));
      return;
    }

    // 表格格式输出
    logger.title('工件列表');

    const headers = ['ID', '阶段', '状态', '进度', '必需'];
    const rows: string[][] = [];

    for (const phase of phases) {
      if (options.phase && phase.id !== options.phase) continue;

      for (const artifact of phase.artifacts) {
        const state = statuses[artifact.id];
        const statusText = getStatusText(state.status);
        const progressText = state.progress !== undefined ? `${state.progress}%` : '-';
        const requiredText = artifact.required ? '是' : '否';

        rows.push([
          artifact.id,
          phase.name,
          statusText,
          progressText,
          requiredText,
        ]);
      }
    }

    logger.table(headers, rows);

  } catch (error: any) {
    logger.error(`列出工件失败：${error.message}`);
    process.exit(1);
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'completed':
      return '已完成';
    case 'in_progress':
      return '进行中';
    case 'pending':
      return '待处理';
    case 'blocked':
      return '已阻塞';
    default:
      return status;
  }
}

export default listAction;
