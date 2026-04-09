/**
 * archive 命令 - 归档项目快照
 */

import path from 'path';
import fs from 'fs/promises';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Project } from '../core/project.js';
import { SchemaEngine } from '../core/schema.js';
import { ensureDir } from '../utils/fs.js';
import logger from '../utils/logger.js';

export interface ArchiveOptions {
  label?: string;
  message?: string;
  keep?: string;
}

export async function archiveAction(options: ArchiveOptions): Promise<void> {
  try {
    const project = await Project.find();

    if (!(await project.isValid())) {
      logger.error('当前目录不是 OW 项目目录');
      return;
    }

    const schemaEngine = new SchemaEngine(project);
    const statuses = await schemaEngine.computeAllStatuses();

    // 创建归档
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const archiveId = `archive-${timestamp}`;
    const archiveDir = path.join(project.archivesDir, archiveId);

    await ensureDir(archiveDir);

    // 归档 manifest
    const manifest = {
      id: archiveId,
      label: options.label,
      message: options.message || '手动归档',
      createdAt: new Date().toISOString(),
      artifacts: statuses,
    };

    await fs.writeFile(
      path.join(archiveDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    logger.success(`项目快照已归档：${archiveId}`);

    if (options.label) {
      logger.info(`标签：${options.label}`);
    }

    // 清理旧归档
    const keepCount = parseInt(options.keep || '5', 10);
    await cleanupOldArchives(project, keepCount);

  } catch (error: any) {
    logger.error(`归档失败：${error.message}`);
    process.exit(1);
  }
}

/**
 * 清理旧归档
 */
async function cleanupOldArchives(project: Project, keepCount: number): Promise<void> {
  const archives = await fs.readdir(project.archivesDir);
  const archiveDirs = archives
    .filter(f => f.startsWith('archive-'))
    .sort()
    .reverse();

  if (archiveDirs.length > keepCount) {
    const toDelete = archiveDirs.slice(keepCount);
    for (const dir of toDelete) {
      await fs.rm(path.join(project.archivesDir, dir), { recursive: true });
      logger.info(`已删除旧归档：${dir}`);
    }
  }
}

export default archiveAction;
