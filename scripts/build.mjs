import {build} from 'esbuild';
import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
await fs.rm('dist',{recursive:true,force:true});await fs.mkdir('dist',{recursive:true});
await Promise.all([
 build({entryPoints:{cli:'src/cli/main.ts'},outdir:'dist',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',target:'node22',minify:true,define:{__HEISEN_VERSION__:JSON.stringify(JSON.parse(await fs.readFile('package.json','utf8')).version)},banner:{js:'#!/usr/bin/env node\nimport { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);'}}).then(()=>fs.chmod('dist/cli.mjs',0o755)),
 // script-api.ts reads dist/script-worker.cjs relative to its own output file, so it must stay in main.mjs.
 build({entryPoints:{main:'src/main.ts'},outdir:'dist',outExtension:{'.js':'.mjs'},chunkNames:'chunks/[name]-[hash]',bundle:true,splitting:true,platform:'node',format:'esm',target:'node24',external:['electron'],minify:true,banner:{js:'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);'},metafile:true}).then(result=>{if(!result.metafile.outputs['dist/main.mjs']?.inputs['src/script-api.ts'])throw new Error('src/script-api.ts must be bundled into dist/main.mjs.');return fs.writeFile('dist/build-inputs.json',JSON.stringify(result.metafile));}),
 // web_run's QuickJS worker; the single-file variant embeds its WASM, so this one file is the whole sandbox.
 build({entryPoints:{'script-worker':'src/script-worker.ts'},outdir:'dist',outExtension:{'.js':'.cjs'},bundle:true,platform:'node',format:'cjs',target:'node24',minify:true}),
 build({entryPoints:['src/*preload.ts'],outdir:'dist',outExtension:{'.js':'.cjs'},bundle:true,platform:'node',format:'cjs',target:'node24',external:['electron']}),
 build({entryPoints:{'readable-probe':'src/readable-probe.ts',readable:'src/readable.ts'},outdir:'dist',bundle:true,platform:'browser',format:'iife',globalName:'__heisenReadable',target:'chrome140',minify:true}),
 build({entryPoints:['ui/app.tsx'],outfile:'dist/app.js',bundle:true,platform:'browser',format:'esm',target:'chrome140',minify:true,define:{'process.env.NODE_ENV':'"production"'},sourcemap:true,external:['./brand/*']})
]);
// Stage the same Node-version-checking launchers for development installs and packaged apps.
await fs.mkdir('build/cli',{recursive:true,mode:0o755});
await fs.copyFile('dist/cli.mjs','build/cli/heisen.mjs');
for(const file of ['heisen','heisen.cmd'])await fs.copyFile(`helpers/cli/${file}`,`build/cli/${file}`);
for(const file of ['heisen','heisen.mjs'])await fs.chmod(`build/cli/${file}`,0o755);
await fs.copyFile('ui/index.html','dist/index.html');await fs.cp('ui/logos','dist/logos',{recursive:true});await fs.cp('ui/brand','dist/brand',{recursive:true});
await fs.cp('assets/filters','dist/filters',{recursive:true});
if(process.platform==='darwin'){
 const exec=promisify(execFile),dir='build/helpers',output=`${dir}/heisen-computer`;
 await fs.mkdir(dir,{recursive:true});
 // Never leave a stale helper available after a failed native build.
 await fs.rm(output,{force:true});
 const temporary=[];
 try{
  await exec('/usr/bin/which',['swiftc']);
  for(const arch of ['arm64','x86_64']){
   const file=`${output}-${arch}`;temporary.push(file);
   // macOS 12 can launch the helper and receive its Korean macOS 14 requirement.
   await exec('swiftc',['-O','-target',`${arch}-apple-macos12.0`,'-Xlinker','-weak_framework','-Xlinker','ScreenCaptureKit','helpers/computer/macos/main.swift','-o',file],{timeout:180000,maxBuffer:4*1024*1024});
  }
  const universal=`${output}.tmp`;temporary.push(universal);
  await exec('/usr/bin/lipo',['-create',...temporary.slice(0,2),'-output',universal],{timeout:30000});
  await fs.chmod(universal,0o755);await fs.rename(universal,output);
  console.log('Built universal macOS computer helper.');
 }catch(error){
  console.warn('macOS 컴퓨터 제어 helper를 빌드하지 못했습니다:',error.stderr||error.message);
 }finally{
  await Promise.all(temporary.map(file=>fs.rm(file,{force:true})));
 }
}
console.log('Built Heisen main, isolated preloads, and browser UI.');
