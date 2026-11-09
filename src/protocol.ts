import { EventEmitter } from 'node:events';
export const MAX_FRAME = 4 * 1024 * 1024;
export function encode(value: unknown, limit = MAX_FRAME): Buffer {
  const body = Buffer.from(JSON.stringify(value));
  if (body.length > limit) throw new Error('Message exceeds size limit');
  const header = Buffer.alloc(4); header.writeUInt32LE(body.length);
  return Buffer.concat([header, body]);
}
export class Decoder extends EventEmitter {
  private buffer = Buffer.alloc(0);
  push(chunk: Buffer|string) {
    this.buffer = Buffer.concat([this.buffer, typeof chunk==='string'?Buffer.from(chunk):chunk]);
    while (this.buffer.length >= 4) {
      const length = this.buffer.readUInt32LE();
      if (length < 2 || length > MAX_FRAME) throw new Error('Invalid message length');
      if (this.buffer.length < length + 4) return;
      const data = JSON.parse(this.buffer.subarray(4, length + 4).toString('utf8'));
      this.buffer = this.buffer.subarray(length + 4);
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Expected object');
      this.emit('message', data);
    }
  }
}
export type Status = 'running' | 'awaiting_approval' | 'completed' | 'cancelled' | 'interrupted' | 'failed';
export type Task = {
  id: string; prompt: string; urls: string[]; allowedOrigins: string[]; epoch: number;
  status: Status; createdAt: string; workspace: string; tainted: boolean;
  events: {time: string; type: string; text: string}[];
  sources: {id: string; url: string; title: string; text: string; capturedAt: string}[];
  artifacts: {path: string; bytes: number}[];
  approval?: {id: string; title: string; detail: string; hash: string};
  approvedHashes: string[]; result?: string; demo?: boolean; codeExitCode?:number;
  provider?:string; model?:string; mode?:string; context?:string; followups?:{at:string;prompt:string}[];
  skills?:{id:string;name:string}[];
};
export function originOf(value: unknown): string {
  if (typeof value !== 'string' || value.length > 4096) throw new Error('Invalid URL');
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('HTTP(S) URL required');
  return url.origin;
}
export function textArg(value: unknown, max = 20000): string {
  if (typeof value !== 'string' || value.length > max) throw new Error('Invalid text argument');
  return value;
}
