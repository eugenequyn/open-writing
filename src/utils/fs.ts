/**
 * 文件系统工具函数
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

/**
 * 确保目录存在
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * 读取文件内容，如果不存在则返回 null
 */
export async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * 检查文件是否存在
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 写入文件（确保目录存在）
 */
export async function writeFileSafe(
  filePath: string,
  content: string,
  options?: { force?: boolean }
): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);

  if (options?.force !== false && await fileExists(filePath)) {
    throw new Error(`文件已存在：${filePath}`);
  }

  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * 复制文件
 */
export async function copyFile(
  src: string,
  dest: string
): Promise<void> {
  const dir = path.dirname(dest);
  await ensureDir(dir);
  await fs.copyFile(src, dest);
}

/**
 * 删除文件
 */
export async function removeFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * 删除目录（递归）
 */
export async function removeDir(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * 列出目录内容
 */
export async function listDir(dirPath: string): Promise<string[]> {
  try {
    return await fs.readdir(dirPath);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Glob 匹配文件
 */
export async function globFiles(pattern: string, cwd?: string): Promise<string[]> {
  return await glob(pattern, { cwd });
}

/**
 * 解析路径模板
 * 支持 {version}, {n}, {n:03d} 等变量
 */
export function resolvePathTemplate(
  template: string,
  variables: Record<string, any>
): string {
  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    if (variables[key] !== undefined) {
      return variables[key];
    }

    // 处理格式化变量 {n:03d}
    const formatMatch = key.match(/^(\w+):(\w+)$/);
    if (formatMatch) {
      const [, name, format] = formatMatch;
      const value = variables[name];
      if (value !== undefined) {
        if (format === '03d') {
          return String(value).padStart(3, '0');
        }
        return String(value);
      }
    }

    return match;
  });
}

/**
 * 计算文件哈希
 */
export async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 计算文件内容哈希
 */
export async function hashFile(filePath: string): Promise<string | null> {
  const content = await readFileSafe(filePath);
  if (!content) return null;
  return hashContent(content);
}
