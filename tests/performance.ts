import {_electron as electron} from 'playwright';
import {expect} from 'playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
const root=path.resolve('.');const out=path.resolve(process.env.HEISEN_BENCH_OUT||'docs/performance.json');
const exe=process.env.HEISEN_EXECUTABLE&&path.resolve(process.env.HEISEN_EXECUTABLE);
const server=http.createServer((_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<title>Benchmark fixture</title><h1>Saved tab fixture</h1><p>Deterministic local page.</p>');});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+(server.address() as any).port;
const samples:any[]=[];
try{for(const tabs of [0,20])for(let run=1;run<=3;run++){
 const profile=path.join(root,`.test-bench-${tabs}-${run}`);await fs.rm(profile,{recursive:true,force:true});await fs.mkdir(profile,{recursive:true});
 await fs.writeFile(path.join(profile,'library.json'),JSON.stringify({settings:{importOffered:true,onboarded:true},tabs:Array.from({length:tabs},(_,i)=>({url:base+'/'+i,title:'Saved tab '+i,pinned:false}))}));
 const env:Record<string,string>={...process.env as Record<string,string>,HEISEN_DATA_DIR:profile,HEISEN_BETA_URL:'skip'};delete env.ELECTRON_RUN_AS_NODE;
 const before=performance.now();const app=await electron.launch({...(exe?{executablePath:exe,args:[]}:{args:[root]}),env,timeout:60000});
 try{const page=await app.firstWindow();await page.getByRole('textbox',{name:'주소창'}).waitFor();await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0]?.isVisible()),{timeout:60000}).toBe(true);const visibleMs=Math.round(performance.now()-before);await new Promise(r=>setTimeout(r,1200));
  const stats=await app.evaluate(({app,webContents})=>{const metrics=app.getAppMetrics();return {rssKB:metrics.reduce((s,m)=>s+m.memory.workingSetSize,0),processes:metrics.length,renderers:metrics.filter(m=>m.type==='Tab').length,webContents:webContents.getAllWebContents().length,heapUsed:process.memoryUsage().heapUsed};});
  const row={tabs,run,visibleMs,...stats};samples.push(row);console.log(JSON.stringify(row));
 }finally{await app.close();}
}}
finally{server.closeAllConnections();server.close();}
await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify({at:new Date().toISOString(),method:'Three launches each, isolated profile, local fixture, 1.2s settle, sum Electron workingSetSize (KiB, shared pages may be counted more than once). OS caches not flushed; comparative local workload, not universal savings.',samples},null,2));
