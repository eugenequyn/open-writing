/**
 * OW CLI 核心类型定义
 */

import { z } from 'zod';

// ============== 配置 Schema ==============

export const configSchema = z.object({
  version: z.string(),
  project: z.object({
    name: z.string(),
    genre: z.string().optional(),
    target_audience: z.string().optional(),
    created_at: z.string(),
  }),
  schema: z.object({
    active: z.string().default('story-driven'),
  }),
  agents: z.object({
    'world-builder': z.object({
      count: z.number().min(1).max(10).default(3),
      pk_rounds: z.number().min(1).max(5).default(3),
    }).optional(),
    'character-arch': z.object({
      count: z.number().min(1).max(10).default(3),
      pk_rounds: z.number().min(1).max(5).default(3),
    }).optional(),
  }).passthrough().optional(),
  writing: z.object({
    chapter_batch: z.number().min(1).max(10).default(3),
    style_analysis_threshold: z.number().min(5).max(50).default(10),
    backup_count: z.number().min(1).max(10).default(3),
    volume: z.object({
      word_count_min: z.number().default(90000),
      word_count_max: z.number().default(150000),
    }).optional(),
    chapter: z.object({
      word_count_min: z.number().default(2000),
      word_count_max: z.number().default(5000),
    }).optional(),
  }).optional(),
  paths: z.record(z.string()),
  versioning: z.object({
    initial_version: z.string().default('1.0'),
  }).optional(),
  output: z.object({
    language: z.string().default('zh-CN'),
  }).optional(),
});

export type Config = z.infer<typeof configSchema>;

// ============== Schema 相关类型 ==============

export interface Schema {
  name: string;
  version: string;
  phases: Phase[];
  artifacts: Artifact[];
}

export interface Phase {
  id: string;
  name: string;
  order: number;
}

export interface Artifact {
  id: string;
  phase: string;
  path?: string;
  path_pattern?: string;
  dependencies: string[];
  required: boolean;
  is_collection?: boolean;
}

// ============== 工件状态 ==============

export type ArtifactStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

export interface ArtifactState {
  id: string;
  status: ArtifactStatus;
  path?: string;
  completedAt?: string;
  progress?: number; // 集合类型工件的完成比例
}

// ============== 项目清单 ==============

export interface ProjectManifest {
  schema: string;
  version: string;
  artifacts: Record<string, ArtifactState>;
  generatedAt: string;
}

// ============== 归档清单 ==============

export interface ArchiveManifest {
  archives: ArchiveEntry[];
}

export interface ArchiveEntry {
  id: string;
  label?: string;
  message: string;
  createdAt: string;
  manifestSnapshot: ProjectManifest;
  archivePath: string;
}

// ============== 变更提案（OpenSpec 灵感）==============

export interface ChangeProposal {
  id: string;
  type: ChangeType;
  reason: string;
  status: 'draft' | 'approved' | 'archived';
  createdAt: string;
  approvedAt?: string;
  archivedAt?: string;
  tasks: ChangeTask[];
  dependencies: string[];
}

export type ChangeType = 'world' | 'outline' | 'chapters' | 'characters';

export interface ChangeTask {
  id: string;
  description: string;
  status: 'pending' | 'completed' | 'skipped';
  executedAt?: string;
  result?: string;
}

// ============== 写作进度 ==============

export interface WritingProgress {
  lastWrittenChapter: number;
  totalWritten: number;
  currentVolume: number;
  totalWordCount: number;
  chapters: ChapterProgress[];
}

export interface ChapterProgress {
  number: number;
  title: string;
  outlineStatus: 'pending' | 'completed';
  draftStatus: 'pending' | 'completed';
  wordCount?: number;
  writtenAt?: string;
  outlineId?: string;
  draftId?: string;
}
