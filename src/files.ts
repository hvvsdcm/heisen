import { promises as fs, constants } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
export async function safePath(root: string, relative: string, createParent = false): Promise<string> {
  if (!relative || path.isAbsolute(relative) || relative.includes('\0') || relative.split(/[\\/]/).includes('..')) throw new Error('작업 폴더 밖 경로는 사용할 수 없습니다.');
  const base = await fs.realpath(root);
  const parts = relative.split('/').filter(Boolean);
  let current = base;
  for (let i=0;i<parts.length;i++) {
    current = path.join(current,parts[i]);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw new Error('심볼릭 링크는 사용할 수 없습니다.');
      if (i<parts.length-1 && !stat.isDirectory()) throw new Error('부모 경로가 디렉터리가 아닙니다.');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      if (i<parts.length-1) {
        if (!createParent) throw error;
        await fs.mkdir(current,{mode:0o700});
      }
    }
  }
  if (!current.startsWith(base+path.sep)) throw new Error('Invalid workspace path');
  return current;
}
export async function readFile(root: string, relative: string) {
  const file = await safePath(root,relative);
  const handle = await fs.open(file,constants.O_RDONLY|constants.O_NOFOLLOW);
  try { if ((await handle.stat()).size > 1000000) throw new Error('파일이 1 MB를 초과합니다.'); return await handle.readFile('utf8'); }
  finally { await handle.close(); }
}
export async function writeFile(root: string, relative: string, content: string) {
  if (Buffer.byteLength(content)>1000000) throw new Error('파일이 1 MB를 초과합니다.');
  const file = await safePath(root,relative,true);
  const handle = await fs.open(file,constants.O_CREAT|constants.O_WRONLY|constants.O_TRUNC|constants.O_NOFOLLOW,0o600);
  try { await handle.writeFile(content); } finally { await handle.close(); }
  return {path:relative,bytes:Buffer.byteLength(content)};
}
export function digest(text: string) { return createHash('sha256').update(text).digest('hex'); }
