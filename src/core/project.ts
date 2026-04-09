/**
 * Project 类 - 项目管理核心
 * 负责查找项目根目录、解析路径、管理项目状态
 */

import path from 'path';
import { readFileSafe, fileExists, ensureDir } from '../utils/fs.js';
import { Config, configSchema } from './config.js';
import yaml from 'js-yaml';
import fs from 'fs/promises';

export class Project {
  readonly rootDir: string;
  readonly owDir: string;
  readonly configPath: string;
  readonly schemasDir: string;
  readonly archivesDir: string;
  readonly generatedDir: string;
  readonly claudeDir: string;

  private configCache: Config | null = null;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
    this.owDir = path.join(rootDir, '.ow');
    this.configPath = path.join(this.owDir, 'config.yaml');
    this.schemasDir = path.join(this.owDir, 'schemas');
    this.archivesDir = path.join(this.owDir, 'archives');
    this.generatedDir = path.join(this.owDir, 'generated');
    this.claudeDir = path.join(rootDir, '.claude');
  }

  /**
   * 查找项目根目录
   * 从当前目录向上查找，直到找到包含 .ow/config.yaml 的目录
   */
  static async find(startDir?: string): Promise<Project> {
    const currentDir = startDir || process.cwd();
    let dir = currentDir;

    while (dir !== path.parse(dir).root) {
      const configPath = path.join(dir, '.ow', 'config.yaml');
      if (await fileExists(configPath)) {
        return new Project(dir);
      }
      dir = path.dirname(dir);
    }

    // 如果没有找到现有项目，返回当前目录作为潜在项目根目录
    return new Project(currentDir);
  }

  /**
   * 检查是否是有效的项目目录
   */
  async isValid(): Promise<boolean> {
    return await fileExists(this.configPath);
  }

  /**
   * 获取配置（带缓存）
   */
  async getConfig(): Promise<Config> {
    if (this.configCache) {
      return this.configCache;
    }

    const content = await readFileSafe(this.configPath);
    if (!content) {
      throw new Error(`配置文件不存在：${this.configPath}`);
    }

    const parsed = yaml.load(content) as Record<string, unknown>;
    const config = configSchema.parse(parsed);
    this.configCache = config;
    return config;
  }

  /**
   * 保存配置
   */
  async saveConfig(config: Config): Promise<void> {
    await ensureDir(this.owDir);
    const content = yaml.dump(config, {
      indent: 2,
      lineWidth: -1, // 不限制行宽
    });
    await fs.writeFile(this.configPath, content, 'utf-8');
    this.configCache = config;
  }

  /**
   * 解析路径（支持模板变量）
   */
  async resolvePath(
    template: string,
    variables: Record<string, any> = {}
  ): Promise<string> {
    const config = await this.getConfig();

    // 默认变量
    const defaults = {
      version: config.versioning?.initial_version || '1.0',
    };

    const allVars = { ...defaults, ...variables };

    // 解析路径模板
    let resolved = template;
    for (const [key, value] of Object.entries(allVars)) {
      resolved = resolved.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
      resolved = resolved.replace(
        new RegExp(`\\{${key}:03d\\}`, 'g'),
        String(value).padStart(3, '0')
      );
    }

    return path.join(this.rootDir, resolved);
  }

  /**
   * 获取 Schema 文件路径
   */
  getSchemaPath(schemaName?: string): string {
    const name = schemaName || 'story-driven';
    return path.join(this.schemasDir, `${name}.yaml`);
  }

  /**
   * 获取生成的清单文件路径
   */
  getGeneratedManifestPath(): string {
    return path.join(this.generatedDir, 'manifest.json');
  }

  /**
   * 获取归档清单文件路径
   */
  getArchiveManifestPath(): string {
    return path.join(this.archivesDir, 'manifest.json');
  }

  /**
   * 确保 .ow 目录结构存在
   */
  async ensureOwStructure(): Promise<void> {
    await ensureDir(this.owDir);
    await ensureDir(this.schemasDir);
    await ensureDir(this.archivesDir);
    await ensureDir(this.generatedDir);
  }

  /**
   * 确保输出目录结构存在
   */
  async ensureOutputStructure(): Promise<void> {
    const config = await this.getConfig();

    // 创建配置中定义的目录
    const dirs = [
      config.paths.world_dir || 'world',
      config.paths.characters_dir || 'characters',
      config.paths.outlines_dir || 'outlines',
      config.paths.chapters_dir || 'chapters',
      config.paths.logs_dir || 'logs',
    ];

    for (const dir of dirs) {
      await ensureDir(path.join(this.rootDir, dir));
    }

    // 创建章节子目录
    await ensureDir(path.join(this.rootDir, config.paths.chapters_dir || 'chapters', 'outlines'));
    await ensureDir(path.join(this.rootDir, config.paths.chapters_dir || 'chapters', 'drafts'));
  }
}

export default Project;
