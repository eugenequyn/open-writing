/**
 * ConfigManager - 配置管理类
 * 负责加载、验证、读写 config.yaml
 */

import fs from 'fs/promises';
import yaml from 'js-yaml';
import { z } from 'zod';
import { Project } from './project.js';
import { ensureDir } from '../utils/fs.js';

// 完整的配置 Schema
export const configSchema = z.object({
  version: z.string(),
  project: z.object({
    name: z.string().min(1, '项目名称不能为空'),
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
  paths: z.record(z.string()).default({}),
  versioning: z.object({
    initial_version: z.string().default('1.0'),
  }).optional(),
  output: z.object({
    language: z.string().default('zh-CN'),
  }).optional(),
});

export type Config = z.infer<typeof configSchema>;

// 默认配置
export function getDefaultConfig(projectName?: string): Config {
  return {
    version: '1.0',
    project: {
      name: projectName || 'My Novel',
      genre: '玄幻',
      target_audience: '25-35 岁网文读者',
      created_at: new Date().toISOString().split('T')[0],
    },
    schema: {
      active: 'story-driven',
    },
    agents: {
      'world-builder': {
        count: 3,
        pk_rounds: 3,
      },
      'character-arch': {
        count: 3,
        pk_rounds: 3,
      },
    },
    writing: {
      chapter_batch: 3,
      style_analysis_threshold: 10,
      backup_count: 3,
      volume: {
        word_count_min: 90000,
        word_count_max: 150000,
      },
      chapter: {
        word_count_min: 2000,
        word_count_max: 5000,
      },
    },
    paths: {
      core_idea: 'core_idea.md',
      plot_intent: 'plot_intent.md',
      style: 'style.md',
      author_profile: 'author_profile.md',
      world_dir: 'world',
      characters_dir: 'characters',
      outlines_dir: 'outlines',
      chapters_dir: 'chapters',
      logs_dir: 'logs',
      world_file: 'world/v{version}.md',
      characters_file: 'characters/v{version}.md',
      master_outline: 'outlines/v{version}/master_outline.md',
      volume_outline: 'outlines/v{version}/volume_{n}_outline.md',
      chapter_outline: 'chapters/outlines/chapter_{n:03d}.md',
      chapter_draft: 'chapters/drafts/chapter_{n:03d}.md',
      log_manifest: 'logs/manifest.md',
    },
    versioning: {
      initial_version: '1.0',
    },
    output: {
      language: 'zh-CN',
    },
  };
}

export class ConfigManager {
  private readonly project: Project;
  private configCache: Config | null = null;

  constructor(project: Project) {
    this.project = project;
  }

  /**
   * 加载配置
   */
  async load(): Promise<Config> {
    if (this.configCache) {
      return this.configCache;
    }

    const content = await fs.readFile(this.project.configPath, 'utf-8');
    const parsed = yaml.load(content) as Record<string, unknown>;
    const config = this.validate(parsed);
    this.configCache = config;
    return config;
  }

  /**
   * 验证配置
   */
  validate(raw: Record<string, unknown>): Config {
    try {
      return configSchema.parse(raw);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
        throw new Error(`配置验证失败:\n${messages.join('\n')}`);
      }
      throw error;
    }
  }

  /**
   * 保存配置
   */
  async save(config: Config): Promise<void> {
    await ensureDir(this.project.owDir);
    const content = yaml.dump(config, {
      indent: 2,
      lineWidth: -1,
    });
    await fs.writeFile(this.project.configPath, content, 'utf-8');
    this.configCache = config;
  }

  /**
   * 初始化配置（创建新的配置文件）
   */
  async init(projectName?: string): Promise<Config> {
    const config = getDefaultConfig(projectName);
    await this.save(config);
    return config;
  }

  /**
   * 获取配置值（支持点号路径）
   */
  async get<T = any>(keyPath: string): Promise<T | undefined> {
    const config = await this.load();
    const keys = keyPath.split('.');
    let value: any = config;

    for (const key of keys) {
      if (value === undefined || value === null) {
        return undefined;
      }
      value = (value as Record<string, any>)[key];
    }

    return value as T;
  }

  /**
   * 设置配置值（支持点号路径）
   */
  async set(keyPath: string, value: any): Promise<Config> {
    const config = await this.load();
    const keys = keyPath.split('.');
    let current: any = config;

    // 导航到父对象
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        (current as Record<string, any>)[key] = {};
      }
      current = current[key];
    }

    // 设置值
    const lastKey = keys[keys.length - 1];

    // 类型转换
    const typedValue = this.convertValue(lastKey, value);
    (current as Record<string, any>)[lastKey] = typedValue;

    await this.save(config);
    return config;
  }

  /**
   * 转换配置值为正确的类型
   */
  private convertValue(key: string, value: any): any {
    // 数字类型的键
    const numberKeys = [
      'count', 'pk_rounds', 'chapter_batch', 'style_analysis_threshold',
      'backup_count', 'word_count_min', 'word_count_max'
    ];

    if (numberKeys.includes(key)) {
      const num = Number(value);
      if (isNaN(num)) {
        throw new Error(`${key} 必须是数字`);
      }
      return num;
    }

    return value;
  }

  /**
   * 列出所有配置
   */
  async list(): Promise<Record<string, any>> {
    return await this.load();
  }

  /**
   * 重置配置
   */
  async reset(keyPath?: string): Promise<Config> {
    if (keyPath) {
      // 重置指定配置项为默认值
      const config = await this.load();
      const defaultValue = this.getDefaultValue(keyPath);

      if (defaultValue !== undefined) {
        await this.set(keyPath, defaultValue);
      } else {
        // 如果找不到默认值，删除该配置项
        const keys = keyPath.split('.');
        let current: any = config;
        for (let i = 0; i < keys.length - 1; i++) {
          current = current[keys[i]];
        }
        delete current[keys[keys.length - 1]];
        await this.save(config);
      }

      return await this.load();
    } else {
      // 重置整个配置
      const config = getDefaultConfig();
      await this.save(config);
      return config;
    }
  }

  /**
   * 获取默认值
   */
  private getDefaultValue(keyPath: string): any {
    const defaultConfig = getDefaultConfig();
    const keys = keyPath.split('.');
    let value: any = defaultConfig;

    for (const key of keys) {
      if (value === undefined || value === null) {
        return undefined;
      }
      value = (value as Record<string, any>)[key];
    }

    return value;
  }
}

export default ConfigManager;
