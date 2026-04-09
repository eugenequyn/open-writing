/**
 * init 命令 - 初始化项目
 */

import path from 'path';
import { Project } from '../core/project.js';
import { ConfigManager, getDefaultConfig } from '../core/config.js';
import { SchemaEngine } from '../core/schema.js';
import { TemplateEngine } from '../core/template.js';
import { ensureDir, fileExists, writeFileSafe } from '../utils/fs.js';
import logger from '../utils/logger.js';

export interface InitOptions {
  genre?: string;
  targetAudience?: string;
}

export async function initAction(name?: string, options?: InitOptions): Promise<void> {
  const projectName = name || 'My Novel';
  const currentDir = process.cwd();

  logger.title('OW CLI - 初始化项目');
  logger.info(`项目名称：${projectName}`);

  // 检查是否已有项目
  const existingProject = await Project.find(currentDir);
  if (await existingProject.isValid()) {
    logger.error('当前目录已存在 OW 项目');
    return;
  }

  const project = new Project(currentDir);

  try {
    // 1. 创建 .ow 目录（先只创建 .ow 目录，不创建输出目录）
    logger.subtitle('1. 创建目录结构');
    const spinner = logger.progress('正在创建目录...');
    await project.ensureOwStructure();
    spinner.succeed('目录结构已创建');

    // 2. 创建配置文件（在创建输出目录之前先创建配置文件）
    logger.subtitle('2. 创建配置文件');
    const configManager = new ConfigManager(project);
    const config = getDefaultConfig(projectName);

    if (options?.genre) {
      config.project.genre = options.genre;
    }
    if (options?.targetAudience) {
      config.project.target_audience = options.targetAudience;
    }

    await configManager.save(config);
    logger.success(`配置文件已创建：${project.configPath}`);

    // 3. 创建输出目录结构（现在配置文件已存在，可以安全调用 ensureOutputStructure）
    const spinner2 = logger.progress('正在创建输出目录...');
    await project.ensureOutputStructure();
    spinner2.succeed('输出目录已创建');

    // 4. 复制内置 schema
    logger.subtitle('3. 复制 Schema');
    const schemaEngine = new SchemaEngine(project);
    const schema = await schemaEngine.loadSchema('story-driven');
    logger.success(`Schema 已加载：${schema.name}`);

    // 4. 生成 Skills 和 Agents
    logger.subtitle('4. 生成 Skills 和 Agents');
    const templateEngine = new TemplateEngine(project);

    const skills = ['builder', 'plot', 'write', 'style'];
    const agents = ['world-builder', 'character-arch'];

    // 创建 .claude 目录结构
    const skillsDir = path.join(project.claudeDir, 'skills');
    const agentsDir = path.join(project.claudeDir, 'agents');

    await ensureDir(skillsDir);
    await ensureDir(agentsDir);
    await ensureDir(path.join(skillsDir, 'builder', 'references'));
    await ensureDir(path.join(skillsDir, 'plot', 'references'));
    await ensureDir(path.join(skillsDir, 'write', 'references'));
    await ensureDir(path.join(skillsDir, 'style', 'references'));
    await ensureDir(path.join(agentsDir, 'assets', 'templates'));

    // 生成 Skills
    for (const skill of skills) {
      const templateName = `skills/${skill}.skill`;
      const outputPath = path.join(skillsDir, skill, 'SKILL.md');

      try {
        await templateEngine.renderToFile(
          templateName,
          outputPath,
          { config },
          { force: true }
        );
        logger.success(`  ✓ Skill: ${skill}`);
      } catch (error: any) {
        logger.error(`  ✗ Skill ${skill} 渲染失败：${error.message}`);
      }
    }

    // 生成 Skill references
    const skillReferences: Record<string, string[]> = {
      builder: [
        'workflow.md',
        'agents.md',
        'output-templates.md',
        'consistency-check.md',
        'plot-intent-template.md',
      ],
      plot: [
        'workflows.md',
        'master-outline-template.md',
        'volume-outline-template.md',
        'chapter-outline-template.md',
      ],
      write: [
        'workflows.md',
        'chapter-draft-template.md',
        'anti-ai-patterns.md',
      ],
      style: [
        'style-analysis-template.md',
        'author-profile-template.md',
      ],
    };

    for (const [skillName, refs] of Object.entries(skillReferences)) {
      for (const refFile of refs) {
        const templateName = `skills/${skillName}/references/${refFile}`;
        const outputPath = path.join(skillsDir, skillName, 'references', refFile);

        try {
          await templateEngine.renderToFile(
            templateName,
            outputPath,
            { config },
            { force: true }
          );
        } catch (error: any) {
          logger.warn(`  ⚠ Reference ${skillName}/${refFile} 模板不存在，跳过`);
        }
      }
    }
    logger.success('  ✓ Skill references');

    // 生成 Agents
    for (const agent of agents) {
      const templateName = `agents/${agent}`;
      const outputPath = path.join(agentsDir, `${agent}.md`);

      try {
        await templateEngine.renderToFile(
          templateName,
          outputPath,
          { config },
          { force: true }
        );
        logger.success(`  ✓ Agent: ${agent}`);
      } catch (error: any) {
        logger.warn(`  ⚠ Agent ${agent} 模板不存在，跳过`);
      }
    }

    // 5. 创建种子文件
    logger.subtitle('5. 创建种子文件');
    const seeds = [
      { template: 'seeds/core_idea.md', output: 'core_idea.md' },
      { template: 'seeds/style.md', output: 'style.md' },
      { template: 'seeds/author_profile.md', output: 'author_profile.md' },
    ];

    for (const { template, output } of seeds) {
      const outputPath = path.join(project.rootDir, output);
      if (!(await fileExists(outputPath))) {
        try {
          await templateEngine.renderToFile(
            template,
            outputPath,
            { config },
            { force: true }
          );
          logger.success(`  ✓ 种子文件：${output}`);
        } catch (error: any) {
          logger.warn(`  ⚠ 种子文件 ${output} 模板不存在，跳过`);
        }
      } else {
        logger.info(`  ⚭ 种子文件已存在：${output}`);
      }
    }

    // 6. 创建 .gitignore
    const gitignorePath = path.join(project.rootDir, '.gitignore');
    if (!(await fileExists(gitignorePath))) {
      await writeFileSafe(gitignorePath, '# OW CLI\n.ow/\nnode_modules/\n*.log\n');
      logger.success('创建 .gitignore');
    }

    // 完成
    logger.divider();
    logger.success('✅ 项目初始化完成！');

    console.log(`
【下一步】

1. 查看项目状态
   ${logger.info('ow status')}

2. 开始创作
   ${logger.info('/builder')}

3. 查看配置
   ${logger.info('ow config list')}
`);

  } catch (error: any) {
    logger.error(`初始化失败：${error.message}`);
    process.exit(1);
  }
}

export default initAction;
