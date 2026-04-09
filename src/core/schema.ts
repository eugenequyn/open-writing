/**
 * SchemaEngine - DAG 引擎
 * 负责加载 schema、拓扑排序、DAG 查询、frontier 计算
 */

import yaml from 'js-yaml';
import { Project } from './project.js';
import { Schema, Phase, Artifact, ArtifactState } from './types.js';
import { fileExists, readFileSafe, globFiles } from '../utils/fs.js';
import path from 'path';
import { fileURLToPath } from 'url';

export class SchemaEngine {
  private readonly project: Project;
  private schemaCache: Map<string, Schema> = new Map();

  constructor(project: Project) {
    this.project = project;
  }

  /**
   * 加载 schema
   */
  async loadSchema(schemaName?: string): Promise<Schema> {
    const name = schemaName || 'story-driven';

    if (this.schemaCache.has(name)) {
      return this.schemaCache.get(name)!;
    }

    // 优先级：项目级 > 内置
    const schemaPath = this.project.getSchemaPath(name);
    // 编译后文件在 dist/src/core/，schema 在 dist/schemas/
    const builtInPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../schemas/story-driven.yaml'
    );

    let content: string | null = null;
    if (await fileExists(schemaPath)) {
      content = await readFileSafe(schemaPath);
    } else {
      // 尝试读取内置 schema
      try {
        content = await readFileSafe(builtInPath);
      } catch {
        throw new Error(`Schema 不存在：${name}`);
      }
    }

    if (!content) {
      throw new Error(`Schema 文件为空：${name}`);
    }

    const schema = yaml.load(content) as Schema;
    this.schemaCache.set(name, schema);
    return schema;
  }

  /**
   * 获取当前激活的 schema
   */
  async getActiveSchema(): Promise<Schema> {
    const config = await this.project.getConfig();
    return this.loadSchema(config.schema.active);
  }

  /**
   * 拓扑排序（Kahn 算法）
   * 返回按依赖顺序排列的 artifact ID 列表
   */
  async topologicalSort(schema?: Schema): Promise<string[]> {
    const targetSchema = schema || await this.getActiveSchema();
    const artifacts = targetSchema.artifacts;

    // 构建入度表
    const inDegree: Map<string, number> = new Map();
    const adjacency: Map<string, string[]> = new Map();

    // 初始化
    for (const artifact of artifacts) {
      inDegree.set(artifact.id, 0);
      adjacency.set(artifact.id, []);
    }

    // 构建图
    for (const artifact of artifacts) {
      for (const dep of artifact.dependencies) {
        if (!inDegree.has(dep)) {
          throw new Error(`未知依赖：${dep} (引用自 ${artifact.id})`);
        }
        inDegree.set(dep, (inDegree.get(dep) || 0) + 1);
        adjacency.get(dep)!.push(artifact.id);
      }
    }

    // Kahn 算法
    const queue: string[] = [];
    const result: string[] = [];

    // 找到所有入度为 0 的节点
    for (const [id, degree] of inDegree) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      const neighbors = adjacency.get(current) || [];
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // 检测循环依赖
    if (result.length !== artifacts.length) {
      const missing = artifacts.filter(a => !result.includes(a.id)).map(a => a.id);
      throw new Error(`检测到循环依赖：${missing.join(' → ')}`);
    }

    return result;
  }

  /**
   * 计算 artifact 状态
   */
  async computeArtifactStatus(artifact: Artifact): Promise<ArtifactState> {
    const config = await this.project.getConfig();
    let fullPath: string;

    if (artifact.is_collection) {
      // 集合类型工件
      if (artifact.path_pattern) {
        fullPath = await this.project.resolvePath(artifact.path_pattern);
        const dir = path.dirname(fullPath);
        const pattern = path.basename(fullPath);
        const files = await globFiles(pattern, dir);

        const completed = files.length;
        // 预期数量从配置获取（可选）
        const expected = config.writing?.chapter_batch || 10;
        const progress = expected > 0 ? Math.min(100, (completed / expected) * 100) : 0;

        return {
          id: artifact.id,
          status: completed > 0 ? (progress >= 100 ? 'completed' : 'in_progress') : 'pending',
          progress: Math.round(progress),
          path: dir,
        };
      }

      return {
        id: artifact.id,
        status: 'pending',
        progress: 0,
      };
    } else {
      // 单一类型工件
      if (artifact.path) {
        fullPath = await this.project.resolvePath(artifact.path);
        const exists = await fileExists(fullPath);

        return {
          id: artifact.id,
          status: exists ? 'completed' : 'pending',
          path: fullPath,
          completedAt: exists ? new Date().toISOString() : undefined,
        };
      }

      return {
        id: artifact.id,
        status: 'pending',
      };
    }
  }

  /**
   * 计算所有 artifact 状态
   */
  async computeAllStatuses(): Promise<Record<string, ArtifactState>> {
    const schema = await this.getActiveSchema();
    const statuses: Record<string, ArtifactState> = {};

    for (const artifact of schema.artifacts) {
      statuses[artifact.id] = await this.computeArtifactStatus(artifact);
    }

    return statuses;
  }

  /**
   * 计算 Frontier（下一个可执行的 artifact 集合）
   */
  async computeFrontier(): Promise<string[]> {
    const schema = await this.getActiveSchema();
    const statuses = await this.computeAllStatuses();

    const frontier: string[] = [];

    for (const artifact of schema.artifacts) {
      if (statuses[artifact.id].status === 'pending') {
        // 检查所有依赖是否已完成
        const depsSatisfied = artifact.dependencies.every(
          dep => statuses[dep]?.status === 'completed'
        );

        // 如果是可选依赖或没有依赖，也可以执行
        if (depsSatisfied || !artifact.required) {
          frontier.push(artifact.id);
        }
      }
    }

    return frontier;
  }

  /**
   * 获取 artifact 的依赖信息
   */
  async getArtifactDependencies(artifactId: string): Promise<{
    artifact: Artifact;
    dependencies: Artifact[];
    dependents: Artifact[];
  }> {
    const schema = await this.getActiveSchema();
    const artifact = schema.artifacts.find(a => a.id === artifactId);

    if (!artifact) {
      throw new Error(`未知的 artifact: ${artifactId}`);
    }

    const dependencies = schema.artifacts.filter(a =>
      artifact.dependencies.includes(a.id)
    );

    const dependents = schema.artifacts.filter(a =>
      a.dependencies.includes(artifactId)
    );

    return { artifact, dependencies, dependents };
  }

  /**
   * 获取 phase 信息
   */
  async getPhaseInfo(phaseId: string): Promise<Phase & { artifacts: Artifact[] }> {
    const schema = await this.getActiveSchema();
    const phase = schema.phases.find(p => p.id === phaseId);

    if (!phase) {
      throw new Error(`未知的 phase: ${phaseId}`);
    }

    const artifacts = schema.artifacts.filter(a => a.phase === phaseId);

    return { ...phase, artifacts };
  }

  /**
   * 获取所有 phases（按 order 排序）
   */
  async getPhases(): Promise<(Phase & { artifacts: Artifact[] })[]> {
    const schema = await this.getActiveSchema();

    return schema.phases
      .sort((a, b) => a.order - b.order)
      .map(phase => ({
        ...phase,
        artifacts: schema.artifacts.filter(a => a.phase === phase.id),
      }));
  }

  /**
   * 验证 schema
   */
  async validateSchema(schema?: Schema): Promise<{ valid: boolean; errors: string[] }> {
    const targetSchema = schema || await this.getActiveSchema();
    const errors: string[] = [];

    // 1. 检查 artifact ID 唯一性
    const ids = new Set<string>();
    for (const artifact of targetSchema.artifacts) {
      if (ids.has(artifact.id)) {
        errors.push(`重复的 artifact ID: ${artifact.id}`);
      }
      ids.add(artifact.id);
    }

    // 2. 检查 phase 引用有效性
    const phaseIds = new Set(targetSchema.phases.map(p => p.id));
    for (const artifact of targetSchema.artifacts) {
      if (!phaseIds.has(artifact.phase)) {
        errors.push(`未知的 phase: ${artifact.phase} (引用自 ${artifact.id})`);
      }
    }

    // 3. 检查依赖引用有效性
    for (const artifact of targetSchema.artifacts) {
      for (const dep of artifact.dependencies) {
        if (!ids.has(dep)) {
          errors.push(`未知的依赖：${dep} (引用自 ${artifact.id})`);
        }
      }
    }

    // 4. 检查路径模板合法性
    for (const artifact of targetSchema.artifacts) {
      if (artifact.path && !artifact.path.includes('{') && !artifact.path.endsWith('.md')) {
        errors.push(`路径格式可能不正确：${artifact.path} (artifact: ${artifact.id})`);
      }
    }

    // 5. 检查循环依赖
    try {
      await this.topologicalSort(targetSchema);
    } catch (error: any) {
      errors.push(error.message);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default SchemaEngine;
