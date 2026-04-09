# OW CLI

Open Writing CLI - 配置驱动的 AI 协同写作项目管理工具

专为中文网文作者设计，通过 DAG 工作流将 AI 协同创作结构化。

## 安装

```bash
# 克隆项目
git clone <repo-url>
cd open-writing

# 安装依赖
npm install

# 构建（编译 TypeScript + 复制模板资源）
npm run build

# 全局安装
npm install -g .
```

安装后即可在任何目录使用 `ow` 命令。

## 快速开始

```bash
# 1. 创建空目录并进入
mkdir my-novel && cd my-novel

# 2. 初始化项目
ow init "我的小说" --genre 玄幻 --target-audience "25-35 岁网文读者"

# 3. 查看项目状态
ow status

# 4. 在 Claude Code 中开始创作
/builder
```

## 命令速查

### 项目管理

| 命令 | 说明 |
|------|------|
| `ow init [name]` | 初始化项目：创建目录结构、配置、Skills、Agents |
| `ow update [--dry-run] [--skill <name>]` | 基于配置重新生成 Skills/Agents |

### 配置管理

| 命令 | 说明 |
|------|------|
| `ow config list` | 列出所有配置 |
| `ow config get <key>` | 读取配置值（支持点号路径，如 `agents.world-builder.count`） |
| `ow config set <key> <value>` | 修改配置值 |
| `ow config reset [--key <key>]` | 重置为默认配置 |
| `ow config path` | 显示配置文件路径 |
| `ow config edit` | 用编辑器打开配置 |

### 状态查看

| 命令 | 说明 |
|------|------|
| `ow status` | DAG 驱动的项目进度 |
| `ow list [--phase <phase>] [--format table\|json]` | 列出工件及状态 |
| `ow show <artifact-id> [--deps] [--content]` | 查看工件详情和依赖 |

### 验证与归档

| 命令 | 说明 |
|------|------|
| `ow validate [--config] [--structure] [--schema] [--deps] [--fix]` | 多维度验证 |
| `ow archive [--label <label>] [--message <msg>] [--keep <n>]` | 项目快照归档 |

### Schema 管理

| 命令 | 说明 |
|------|------|
| `ow schema list` | 列出可用 Schema |
| `ow schema show [name]` | 查看 Schema 详情 |
| `ow schema init [name]` | 创建空白 Schema |
| `ow schema activate <name>` | 激活 Schema |
| `ow schema fork <source> [name]` | Fork 已有 Schema |
| `ow schema validate [name]` | 验证 Schema（检测循环依赖等） |

---

## 项目结构

### CLI 源码目录

```
open-writing/
├── bin/
│   └── ow.ts                         # CLI 入口，Commander.js 注册所有命令
│
├── src/
│   ├── commands/                      # 命令实现层
│   │   ├── init.command.ts            #   ow init
│   │   ├── update.command.ts          #   ow update
│   │   ├── status.command.ts          #   ow status
│   │   ├── list.command.ts            #   ow list
│   │   ├── show.command.ts            #   ow show
│   │   ├── validate.command.ts        #   ow validate
│   │   ├── archive.command.ts         #   ow archive
│   │   ├── config.command.ts          #   ow config get/set/list/reset/path/edit
│   │   └── schema.command.ts          #   ow schema init/fork/list/show/activate/validate
│   │
│   ├── core/                          # 核心引擎层
│   │   ├── project.ts                 #   项目管理 — 查找根目录、路径解析、目录创建
│   │   ├── config.ts                  #   配置管理 — Zod 验证、读写、默认值、点号路径
│   │   ├── schema.ts                  #   DAG 引擎 — 拓扑排序、状态计算、frontier 计算
│   │   ├── template.ts               #   模板引擎 — Handlebars 渲染、变更检测、哈希追踪
│   │   └── types.ts                   #   类型定义 — Schema/Phase/Artifact/ArtifactState
│   │
│   ├── utils/                         # 工具层
│   │   ├── fs.ts                      #   文件操作 — 安全读写、glob、哈希、路径模板
│   │   └── logger.ts                  #   终端输出 — chalk 颜色 + ora 加载动画
│   │
│   ├── schemas/                       # 内置 DAG Schema
│   │   └── story-driven.yaml          #   默认 4 阶段创作工作流定义
│   │
│   └── templates/                     # Handlebars 模板文件
│       ├── skills/                    #   4 个 Skill 模板 + reference 模板
│       │   ├── builder.skill.hbs
│       │   ├── plot.skill.hbs
│       │   ├── write.skill.hbs
│       │   ├── style.skill.hbs
│       │   ├── builder/references/    #   Builder 参考文档（5 个）
│       │   ├── plot/references/       #   Plot 参考文档（4 个）
│       │   ├── write/references/      #   Write 参考文档（3 个）
│       │   └── style/references/      #   Style 参考文档（2 个）
│       ├── agents/                    #   2 个 Agent 模板
│       │   ├── world-builder.hbs
│       │   └── character-arch.hbs
│       └── seeds/                     #   3 个种子文件模板
│           ├── core_idea.md.hbs
│           ├── style.md.hbs
│           └── author_profile.md.hbs
│
├── package.json
├── tsconfig.json
└── dist/                              # 编译输出（npm run build 生成）
```

### 用户项目目录（`ow init` 生成）

```
my-novel/
├── .ow/                               # OW CLI 内部数据（已加入 .gitignore）
│   ├── config.yaml                    #   项目配置（单一事实来源）
│   ├── schemas/                       #   项目级自定义 Schema
│   ├── archives/                      #   归档快照
│   └── generated/
│       └── manifest.json              #   生成文件追踪（哈希对比变更）
│
├── .claude/                           # Claude Code 指令目录
│   ├── skills/                        #   Slash command 定义
│   │   ├── builder/
│   │   │   ├── SKILL.md               #     /builder 命令 — 创作宪法构建
│   │   │   └── references/            #     详细参考文档
│   │   │       ├── workflow.md        #       完整工作流程
│   │   │       ├── agents.md          #       Agent 协调说明
│   │   │       ├── output-templates.md#       输出文件模板
│   │   │       ├── consistency-check.md#      一致性检查清单
│   │   │       └── plot-intent-template.md    情节意向书模板
│   │   ├── plot/
│   │   │   ├── SKILL.md               #     /plot 或 /p — 情节架构
│   │   │   └── references/
│   │   │       ├── workflows.md       #       工作流程
│   │   │       ├── master-outline-template.md  主大纲模板
│   │   │       ├── volume-outline-template.md  分卷大纲模板
│   │   │       └── chapter-outline-template.md 章节细纲模板
│   │   ├── write/
│   │   │   ├── SKILL.md               #     /write 或 /w — 正文创作
│   │   │   └── references/
│   │   │       ├── workflows.md       #       工作流程
│   │   │       ├── chapter-draft-template.md   章节正文模板
│   │   │       └── anti-ai-patterns.md #       去AI味参考（词汇/结构/风格/灵魂四层防线）
│   │   └── style/
│   │       ├── SKILL.md               #     /style — 风格分析
│   │       └── references/
│   │           ├── style-analysis-template.md  风格分析模板
│   │           └── author-profile-template.md  作家档案模板
│   │
│   └── agents/                        #   Agent 定义
│       ├── world-builder.md           #     世界观并行生成 Agent
│       ├── character-arch.md          #     角色并行生成 Agent
│       └── assets/
│           └── templates/             #     Agent 生成方案时的 prompt 模板（预留）
│
├── core_idea.md                       # 核心创意（种子文件）
├── style.md                           # 本书风格设定（种子文件）
├── author_profile.md                  # 作家风格档案（种子文件，跨作品复用）
│
├── world/                             # 世界观设定输出
├── characters/                        # 角色档案输出
├── outlines/                          # 情节大纲输出
├── chapters/
│   ├── outlines/                      # 章节细纲
│   └── drafts/                        # 章节正文
├── logs/                              # 版本记录
└── .gitignore
```

---

## 各目录职责

| 目录 | 职责 | 改动频率 |
|------|------|---------|
| `.ow/` | CLI 运行时数据（配置、状态、归档） | 低，仅命令操作时变 |
| `.claude/skills/` | AI 的工作手册，定义每个 slash command 做什么 | 低，`ow update` 更新 |
| `.claude/agents/` | AI 子 agent 的角色定义 | 低 |
| 项目根目录 `.md` 文件 | 创作内容 — 种子文件和最终产出 | 高，用户和 AI 共同编辑 |
| `world/` `characters/` 等 | 创作产出目录 | 高，随写作推进填充 |

---

## 工作流程

OW CLI 使用 DAG（有向无环图）管理创作工作流，分为 4 个阶段：

```
Phase 1: Builder（创作宪法）
  core_idea → world → characters → style → plot_intent

Phase 2: Plot（情节架构）
  plot_intent → master_outline → volume_outlines → chapter_outlines

Phase 3: Write（正文创作）
  chapter_outlines → chapter_drafts
  ↳ 偏离反馈：检测情节偏离 → 更新后续 chapter_outlines

Phase 4: Style（风格分析）
  chapter_drafts → author_profile + 去 AI 味规则
```

### Phase 1: Builder - 创作宪法

构建小说创作的"基础宪法"，包括：

| 工件 | 文件 | 说明 |
|------|------|------|
| 核心创意 | `core_idea.md` | 主题、类型、核心冲突、目标读者 |
| 世界观 | `world/v{version}.md` | 世界背景、能力体系、势力分布 |
| 角色档案 | `characters/v{version}.md` | 主角、配角、反派、关系图 |
| 本书风格 | `style.md` | 叙事视角、节奏、语言偏好 |
| 情节意向 | `plot_intent.md` | 主线方向、关键转折、篇幅分配 |

启动方式：`/builder`

支持重建模式：`/builder --rebuild world` 或 `/builder --rebuild character`

### Phase 2: Plot - 情节架构

基于创作宪法设计引人入胜、逻辑自洽的情节结构。

**核心设计目标**：冲突张力、角色弧线、伏笔体系、节奏控制、世界观一致性

**感知阶段**：生成前自动加载创作上下文（plot_intent → world → characters → 已写章节），输出情节设计预期供用户确认。

| 命令 | 说明 |
|------|------|
| `/plot full` | 直接生成完整大纲 |
| `/plot explore` | 生成 3 个方案对比选择 |
| `/plot chapters` | 生成章节细纲 |
| `/plot chapters 1-10` | 生成指定范围细纲 |
| `/plot --status` | 查看大纲进度 |
| `/plot history` | 查看历史版本 |
| `/plot undo` | 撤销上次修改 |

**情节自检**：每次生成后自动执行一致性检查（世界观合规、角色行为、因果逻辑）、结构检查（冲突链、角色弧线、伏笔闭环、节奏曲线）、质量检查（可写性、悬念设置）。

**章节细纲增强**：
- 情感曲线：起点情绪 → 走向 → 终点情绪 → 情绪锚点
- 场景类型标签：战斗/对话/独白/探索/日常/揭秘/追逐/谈判（供 Write 直接使用）
- 写作交接清单：核心冲突、出场角色、关键情节点（Write 感知阶段直接读取，无需重新推导）

输出文件：
- `outlines/v{version}/master_outline.md` — 主大纲（Freytag 金字塔五幕结构）
- `outlines/v{version}/volume_X_outline.md` — 分卷大纲
- `chapters/outlines/chapter_XXX.md` — 章节细纲（含情感曲线 + 写作交接清单）

### Phase 3: Write - 正文创作

基于情节大纲创作有血有肉、打动读者的故事。

**三明治架构**：
- 上层面包（输入约束）：感知阶段加载细纲 + 前 500 字 + 风格设定
- 中间的肉（生成规则）：去 AI 味守则 + 章节衔接规则 + 场景写作指引
- 下层面包（生成后验证）：一致性 → 衔接性 → 文学性 → 质量，四层检查

**去 AI 味守则**：
- 6 条禁令：禁用 AI 高频词（宛如/不禁/淡淡的等）、禁用三段式排比、禁用万能过渡词、禁用过度润色、禁用万能乐观、禁用解释式情感
- 6 条鼓励：具体胜抽象、感官背刺、允许冲突、句长参差、信任读者、对话怪癖

**骨血评分**：生成后自动评估文学质量（★ ~ ★★★★★），低于 ★★★★☆ 自动修正。

**偏离反馈**：检测到情节偏离时，自动生成偏离报告并提示更新后续细纲。

| 命令 | 说明 |
|------|------|
| `/write 1` | 写第 1 章（自动生成细纲） |
| `/write continue` | 继续写下一章 |
| `/write 1-5` | 批量写作 1-5 章 |
| `/write outline 3` | 查看第 3 章细纲 |
| `/write check 3` | 检查第 3 章是否偏离细纲 |
| `/write --status` | 查看写作进度 |
| `/write undo` | 撤销修改 |

### Phase 4: Style - 风格分析

基于已写章节分析写作风格：

| 命令 | 说明 |
|------|------|
| `/style` | 分析本书风格，生成 style.md |
| `/style --profile` | 更新作家风格档案 author_profile.md |
| `/style --show` | 查看当前风格设定 |

分析维度：句式、词汇、叙事视角、节奏控制、对话风格、描写偏好、去 AI 味扫描。

---

## 配置文件

`.ow/config.yaml` 是项目的单一事实来源（single source of truth）。

```yaml
version: "1.0"

project:
  name: "我的小说"
  genre: "玄幻"
  target_audience: "25-35 岁网文读者"
  created_at: "2026-03-27"

schema:
  active: "story-driven"

agents:
  world-builder:
    count: 3          # 并行 Agent 数量
    pk_rounds: 3      # PK 辩论轮数
  character-arch:
    count: 3
    pk_rounds: 3

writing:
  chapter_batch: 3                # 每批生成章节数
  style_analysis_threshold: 10    # 风格分析最低章节数
  backup_count: 3                 # 保留备份数量
  volume:
    word_count_min: 90000
    word_count_max: 150000
  chapter:
    word_count_min: 2000
    word_count_max: 5000

paths:
  core_idea: "core_idea.md"
  plot_intent: "plot_intent.md"
  style: "style.md"
  author_profile: "author_profile.md"
  world_dir: "world"
  characters_dir: "characters"
  outlines_dir: "outlines"
  chapters_dir: "chapters"
  logs_dir: "logs"
  world_file: "world/v{version}.md"
  characters_file: "characters/v{version}.md"
  master_outline: "outlines/v{version}/master_outline.md"
  volume_outline: "outlines/v{version}/volume_{n}_outline.md"
  chapter_outline: "chapters/outlines/chapter_{n:03d}.md"
  chapter_draft: "chapters/drafts/chapter_{n:03d}.md"

versioning:
  initial_version: "1.0"

output:
  language: "zh-CN"
```

路径模板支持变量：`{version}` → 版本号，`{n}` → 序号，`{n:03d}` → 三位补零。

---

## AI 协同设计

### Skill（Slash Command）

Skill 是 Claude Code 的扩展命令，定义 AI 在每个创作阶段的工作流程和交互方式。

| Skill | 命令 | 说明 |
|-------|------|------|
| Builder | `/builder` | 创作宪法：世界观 + 角色 + 风格 |
| Plot | `/plot` 或 `/p` | 情节架构：大纲 + 细纲 |
| Write | `/write` 或 `/w` | 正文创作 |
| Style | `/style` | 风格分析 |

每个 Skill 包含：
- `SKILL.md` — 主文件，定义工作流程、命令、交互引导
- `references/` — 详细参考文档（模板、流程、检查清单）

### Agent（并行生成）

Agent 是独立运行的子 agent，用于并行生成方案后 PK 选优。

| Agent | 说明 |
|-------|------|
| world-builder | 基于核心创意并行生成世界观方案 |
| character-arch | 基于世界观并行生成角色档案方案 |

PK 流程：
1. 启动 N 个 agent 并行生成方案
2. 各方案相互质疑和辩论（多轮）
3. 综合评分选优
4. 用户最终确认

---

## 核心设计模式

### DAG 工作流

使用 Kahn 算法进行拓扑排序，确保工件按依赖顺序执行。`ow status` 自动计算每个工件的状态和"下一步可执行"的 frontier。

### 配置驱动

所有参数（agent 数量、字数范围、路径模板等）统一在 `config.yaml` 中管理，模板通过 Handlebars 变量引用配置值。

### 变更检测

通过 SHA-256 哈希追踪生成文件。`manifest.json` 记录每次生成的哈希值，`ow update` 时对比哈希，防止覆盖用户手动修改的文件。

### 模板层级

模板查找优先级：项目级 `.ow/templates/` > 内置 `src/templates/`。支持 `.hbs`、`.handlebars`、`.md.hbs`、`.md` 扩展名。

---

## 开发

```bash
# 开发模式（使用 tsx 直接运行 TypeScript）
npm run dev

# 构建（编译 + 复制静态资源）
npm run build

# 测试
npm test

# 类型检查
npm run typecheck
```

## 技术栈

| 技术 | 用途 |
|------|------|
| TypeScript | 类型安全 |
| Commander.js | CLI 框架 |
| Zod | 运行时配置验证 |
| Handlebars | 模板渲染 |
| js-yaml | YAML 解析 |
| chalk | 终端颜色 |
| ora | 进度动画 |
| glob | 文件模式匹配 |
| cpy-cli | 构建时复制静态资源 |

## 许可证

MIT
