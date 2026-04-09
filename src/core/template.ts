/**
 * TemplateEngine - 模板引擎
 * 负责模板解析链、渲染、变更检测
 */

import fs from 'fs/promises';
import path from 'path';
import handlebars from 'handlebars';
import { Project } from './project.js';
import { Config } from './config.js';
import { fileExists, readFileSafe, hashContent, ensureDir } from '../utils/fs.js';
import { fileURLToPath } from 'url';

export interface TemplateContext {
  config: Config;
  [key: string]: any;
}

export interface RenderedFile {
  path: string;
  content: string;
  templateHash: string;
}

export interface GeneratedManifest {
  files: Record<string, {
    templateHash: string;
    generatedAt: string;
    outputPath: string;
  }>;
}

export class TemplateEngine {
  private readonly project: Project;
  private readonly templateDirs: string[];
  private templateCache: Map<string, handlebars.TemplateDelegate> = new Map();

  constructor(project: Project) {
    this.project = project;

    // 模板优先级：项目级 > 用户级 > 内置
    // 编译后文件在 dist/src/core/，模板在 dist/templates/
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    this.templateDirs = [
      path.join(project.rootDir, '.ow', 'templates'),
      path.join(currentDir, '../../templates'),
    ];
  }

  /**
   * 查找模板文件
   */
  private async findTemplate(templateName: string): Promise<string | null> {
    // 尝试不同的扩展名
    const extensions = ['.hbs', '.handlebars', '.md.hbs', '.md'];

    for (const dir of this.templateDirs) {
      for (const ext of extensions) {
        const templatePath = path.join(dir, templateName + ext);
        if (await fileExists(templatePath)) {
          return templatePath;
        }
      }
    }

    return null;
  }

  /**
   * 加载模板
   */
  async loadTemplate(templateName: string): Promise<handlebars.TemplateDelegate> {
    const cacheKey = templateName;
    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey)!;
    }

    const templatePath = await this.findTemplate(templateName);
    if (!templatePath) {
      throw new Error(`模板不存在：${templateName}`);
    }

    const content = await readFileSafe(templatePath);
    if (!content) {
      throw new Error(`模板文件为空：${templatePath}`);
    }

    const template = handlebars.compile(content);
    this.templateCache.set(cacheKey, template);
    return template;
  }

  /**
   * 注册 Handlebars helper
   */
  private registerHelpers(): void {
    // JSON 序列化 helper
    handlebars.registerHelper('json', (context: any) => {
      return JSON.stringify(context, null, 2);
    });

    // 等于判断
    handlebars.registerHelper('eq', (a: any, b: any) => {
      return a === b;
    });

    // 不等于判断
    handlebars.registerHelper('neq', (a: any, b: any) => {
      return a !== b;
    });

    // 大于判断
    handlebars.registerHelper('gt', (a: number, b: number) => {
      return a > b;
    });

    // 小于判断
    handlebars.registerHelper('lt', (a: number, b: number) => {
      return a < b;
    });

    // 包含判断
    handlebars.registerHelper('includes', (array: any[], value: any) => {
      return array?.includes(value);
    });

    // 迭代器 helper
    handlebars.registerHelper('times', (n: number, block: any) => {
      let accum = '';
      for (let i = 0; i < n; i++) {
        accum += block.fn({ ...block.data, index: i });
      }
      return accum;
    });

    // 字符串连接
    handlebars.registerHelper('concat', (...args: any[]) => {
      const strings = args.slice(0, -1);
      return strings.join('');
    });

    // 路径解析 helper
    handlebars.registerHelper('resolvePath', (template: string, options: any) => {
      // 从上下文获取变量
      const context = options.data.root;
      let resolved = template;

      // 简单的变量替换
      if (context.config?.paths) {
        for (const [key, value] of Object.entries(context.config.paths)) {
          resolved = resolved.replace(new RegExp(`\\{\\{paths\\.${key}\\}\\}`, 'g'), String(value));
        }
      }

      return resolved;
    });

    // 获取配置值（支持连字符键名，如 agents.world-builder.count）
    handlebars.registerHelper('cfg', function(this: any, path: string) {
      // 从 this 上下文获取 config
      const context = this;
      if (!context || !context.config) {
        return '';
      }
      const parts = path.split('.');
      let value: any = context.config;
      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          return '';
        }
      }
      return value ?? '';
    });
  }

  /**
   * 渲染模板
   */
  async render(
    templateName: string,
    context: TemplateContext
  ): Promise<string> {
    this.registerHelpers();

    const template = await this.loadTemplate(templateName);
    return template(context);
  }

  /**
   * 渲染并写入文件
   */
  async renderToFile(
    templateName: string,
    outputPath: string,
    context: TemplateContext,
    options?: { force?: boolean }
  ): Promise<RenderedFile> {
    const content = await this.render(templateName, context);
    const templateHash = await hashContent(content);

    // 检查文件是否已存在且内容相同
    if (!options?.force && await fileExists(outputPath)) {
      const existingContent = await readFileSafe(outputPath);
      if (existingContent === content) {
        // 内容相同，跳过
        return {
          path: outputPath,
          content,
          templateHash,
        };
      }

      // 内容不同，检查是否是用户手动修改
      const existingHash = await hashContent(existingContent || '');
      if (existingHash !== templateHash) {
        throw new Error(
          `文件已被手动修改：${outputPath}\n` +
          `请使用 --force 强制覆盖或先备份更改`
        );
      }
    }

    await ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, content, 'utf-8');

    return {
      path: outputPath,
      content,
      templateHash,
    };
  }

  /**
   * 批量渲染模板
   */
  async renderBatch(
    templates: Array<{
      templateName: string;
      outputPath: string;
      context?: Partial<TemplateContext>;
    }>,
    baseContext: TemplateContext,
    options?: { force?: boolean; dryRun?: boolean }
  ): Promise<RenderedFile[]> {
    const results: RenderedFile[] = [];

    for (const { templateName, outputPath, context } of templates) {
      const mergedContext = { ...baseContext, ...context };

      if (options?.dryRun) {
        // 预演模式，只计算哈希
        const content = await this.render(templateName, mergedContext);
        const templateHash = await hashContent(content);
        results.push({ path: outputPath, content, templateHash });
      } else {
        try {
          const result = await this.renderToFile(
            templateName,
            outputPath,
            mergedContext,
            { force: options?.force }
          );
          results.push(result);
        } catch (error: any) {
          throw new Error(`渲染失败 ${templateName}: ${error.message}`);
        }
      }
    }

    return results;
  }

  /**
   * 获取生成的清单
   */
  async getGeneratedManifest(): Promise<GeneratedManifest> {
    const manifestPath = this.project.getGeneratedManifestPath();
    const content = await readFileSafe(manifestPath);

    if (content) {
      return JSON.parse(content) as GeneratedManifest;
    }

    return { files: {} };
  }

  /**
   * 保存生成的清单
   */
  async saveGeneratedManifest(manifest: GeneratedManifest): Promise<void> {
    const manifestPath = this.project.getGeneratedManifestPath();
    await ensureDir(path.dirname(manifestPath));
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  /**
   * 更新生成追踪
   */
  async updateGeneratedTracking(
    outputPath: string,
    templateHash: string
  ): Promise<void> {
    const manifest = await this.getGeneratedManifest();

    manifest.files[outputPath] = {
      templateHash,
      generatedAt: new Date().toISOString(),
      outputPath,
    };

    await this.saveGeneratedManifest(manifest);
  }

  /**
   * 检查模板是否需要更新
   */
  async needsUpdate(
    outputPath: string,
    templateName: string
  ): Promise<{ needsUpdate: boolean; reason: string }> {
    const manifest = await this.getGeneratedManifest();
    const tracked = manifest.files[outputPath];

    if (!tracked) {
      return { needsUpdate: true, reason: '文件未生成' };
    }

    // 检查输出文件是否存在
    if (!await fileExists(outputPath)) {
      return { needsUpdate: true, reason: '输出文件不存在' };
    }

    // 重新渲染模板，比较哈希
    const config = await this.project.getConfig();
    const content = await this.render(templateName, { config });
    const currentHash = await hashContent(content);

    if (currentHash !== tracked.templateHash) {
      return { needsUpdate: true, reason: '模板已变更' };
    }

    return { needsUpdate: false, reason: '已是最新' };
  }
}

export default TemplateEngine;
