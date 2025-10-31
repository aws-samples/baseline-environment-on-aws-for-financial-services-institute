import { glob } from 'glob';
import * as path from 'path';

/**
 * dirPath までに到達するまでのディレクトリが exclude されないようにするパターンを生成する
 */
export function getHierarchicalIncludePatterns(dirPath: string): string[] {
  // Windowsのパス区切り文字を統一
  const normalizedPath = dirPath.replace(/\\/g, '/');
  const parts = normalizedPath.split('/').filter((part) => part);
  return Array.from({ length: parts.length }, (_, i) => '!' + parts.slice(0, i + 1).join('/'));
}

/**
 * dirPath 以下のすべてのファイルが exclude されないようにするパターンを生成する
 */
export function getAllIncludePatterns(dirPath: string): string[] {
  // Windowsのパス区切り文字を統一
  const normalizedPath = dirPath.replace(/\\/g, '/');
  return ['*', '.*', '**/*', '**/.*'].map((p) => `!${normalizedPath}/${p}`);
}

/**
 * 全ての package*.json が exclude されないようにするパターンを生成する
 */
export function getPackageJsonIncludePatterns(projectRoot: string): string[] {
  const packageJsonFiles = glob.sync('**/package*.json', {
    cwd: projectRoot,
    ignore: ['**/node_modules/**', '**/cdk.out/**'],
  });

  return packageJsonFiles.flatMap((file: string) => [
    ...getHierarchicalIncludePatterns(path.dirname(file)),
    `!${file}`,
  ]);
}
