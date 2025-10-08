import { glob } from 'glob';
import * as path from 'path';

/**
 * dirPath までに到達するまでのディレクトリが exclude されないようにするパターンを生成する
 */
export function getHierarchicalIncludePatterns(dirPath: string): string[] {
  const parts = dirPath.split(path.sep).filter((part) => part);
  return Array.from({ length: parts.length }, (_, i) => '!' + parts.slice(0, i + 1).join('/'));
}

/**
 * dirPath 以下のすべてのファイルが exclude されないようにするパターンを生成する
 */
export function getAllIncludePatterns(dirPath: string): string[] {
  return ['*', '.*', '**/*', '**/.*'].map((p) => `!${dirPath}/${p}`);
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
