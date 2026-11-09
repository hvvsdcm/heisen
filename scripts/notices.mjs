import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

// Offline generator. The complete production closure deliberately over-attributes
// tree-shaken modules and type-only dependencies, covering every bundled entry point
// (the existing build-inputs.json records only main, not UI/reader/preloads/CLI).
const root=fileURLToPath(new URL('../',import.meta.url));
const read=relative=>fs.readFile(path.join(root,relative),'utf8');
const metadata=JSON.parse(await read('package.json'));
const lock=JSON.parse(await read('package-lock.json')).packages;
const tree=JSON.parse(execFileSync(process.platform==='win32'?'npm.cmd':'npm',['ls','--omit=dev','--all','--long','--json'],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024,shell:process.platform==='win32'}));
const packages=new Map();
function collect(node){
 for(const dep of Object.values(node.dependencies??{})){
  if(dep.path&&dep.version)packages.set(dep.path,dep);
  collect(dep);
 }
}
collect(tree);
const approved=new Set(['MIT','Apache-2.0','ISC','BSD-2-Clause','BSD-3-Clause','0BSD','Unlicense','MPL-2.0','(MPL-2.0 OR Apache-2.0)']);
const texts=new Map(),details=[];
function retain(label,text){
 const value=text.replaceAll('\r\n','\n').trim();
 const id=createHash('sha256').update(value).digest('hex').slice(0,16);
 if(!texts.has(id))texts.set(id,{labels:[],text:value});
 texts.get(id).labels.push(label);
 return `[${label}](#license-${id})`;
}
async function licenseFiles(dir,base=dir){
 const found=[];
 for(const entry of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
  if(entry.name==='node_modules')continue;
  const target=path.join(dir,entry.name);
  if(entry.isDirectory())found.push(...await licenseFiles(target,base));
  else if(entry.isFile()&&/^(?:licen[cs]e|notice|copying)(?:[.\-_]|$)/i.test(entry.name))found.push({label:path.relative(base,target).replaceAll(path.sep,'/'),text:await fs.readFile(target,'utf8')});
 }
 return found;
}
// These packages omit license files from npm. Exact upstream texts are retained
// below, keyed by version; upgrades must re-audit rather than silently reuse them.
const snapshots={
 '@mariozechner/pi-ai@0.73.1':{url:'https://raw.githubusercontent.com/badlogic/pi-mono/v0.73.1/LICENSE',text:`MIT License

Copyright (c) 2025 Mario Zechner

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`},
 'standardwebhooks@1.1.1':{url:'https://raw.githubusercontent.com/standard-webhooks/standard-webhooks/ab6844147ce9cdb0d2dbf2e60d1ea85001fd2554/libraries/LICENSE',text:`The MIT License

Copyright (c) 2023 Svix (https://www.svix.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.`},
 'degenerator@5.0.1':{url:'https://raw.githubusercontent.com/TooTallNate/proxy-agents/84e41e433b422cbe9f073952d8e16052eb9b0251/packages/degenerator/LICENSE',text:`(The MIT License)

Copyright (c) 2013 Nathan Rajlich <nathan@tootallnate.net>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`},
};
const missingApache=new Set(['@aws-sdk/nested-clients@3.998.0','@aws-sdk/credential-provider-http@3.972.83','@aws-sdk/credential-provider-login@3.972.88']);
for(const [dir] of [...packages].sort(([a],[b])=>a.localeCompare(b,'en'))){
 const pkg=JSON.parse(await fs.readFile(path.join(dir,'package.json'),'utf8'));
 const key=`${pkg.name}@${pkg.version}`,relative=path.relative(root,dir).replaceAll(path.sep,'/');
 const entry=lock[relative];
 if(!entry||entry.version!==pkg.version)throw new Error(`Lockfile mismatch: ${key}`);
 if(!approved.has(pkg.license))throw new Error(`License requires review: ${key}: ${pkg.license}`);
 let files=await licenseFiles(dir);
 if(!files.length){
  if(snapshots[key])files=[{label:snapshots[key].url,text:snapshots[key].text}];
  else if(missingApache.has(key))files=[{label:'Apache-2.0 (same AWS SDK repository; @aws-sdk/core/LICENSE)',text:await read('node_modules/@aws-sdk/core/LICENSE')}];
  else if(key==='data-uri-to-buffer@4.0.1'){
   const text=await fs.readFile(path.join(dir,'README.md'),'utf8');
   files=[{label:'README.md — License',text:text.slice(text.indexOf('(The MIT License)')).split('\n[rfc]:')[0].replaceAll('&lt;','<').replaceAll('&gt;','>')}];
  }else throw new Error(`Missing license text: ${key}`);
 }
 let repo=typeof pkg.repository==='string'?pkg.repository:pkg.repository?.url;
 if(!repo)throw new Error(`Missing source URL: ${key}`);
 repo=repo.replace(/^git\+/,'').replace(/^git:\/\//,'https://').replace(/^ssh:\/\/git@github.com\//,'https://github.com/').replace(/^github:/,'https://github.com/').replace(/\.git$/,'').replace(/^http:/,'https:');
 if(!repo.includes('://'))repo='https://github.com/'+repo;
 const source=pkg.gitHead?`${repo}/tree/${pkg.gitHead}`:pkg.name==='@ghostery/url-parser'?`${repo}/tree/v${pkg.version}`:repo;
 const copyrights=[...new Set(files.flatMap(file=>file.text.split('\n').map(line=>line.trim()).filter(line=>/(?:copyright\s*(?:\(c\)|©|[0-9])|©\s*[0-9])/i.test(line)&&!line.includes('[yyyy]'))))];
 const author=typeof pkg.author==='string'?pkg.author:pkg.author?.name;
 const attribution=copyrights.length?copyrights.join('; '):`No separate copyright line in supplied license${author?`; package author: ${author}`:''}.`;
 const license=pkg.name==='dompurify'?'Apache-2.0 (chosen from MPL-2.0 OR Apache-2.0)':pkg.name==='lucide-react'?'ISC; Feather-derived icons: MIT':pkg.license;
 const refs=files.map(file=>retain(`${key}: ${file.label}`,file.text));
 details.push(`### ${key}\n\n- License: ${license}\n- Copyright: ${attribution}\n- Source: ${source}\n- Published package: ${entry.resolved}\n- Integrity: ${entry.integrity}\n- Texts: ${refs.join('; ')}${pkg.license==='MPL-2.0'?'\n- MPL-covered source is available at the source URL above, under MPL-2.0. Heisen uses the published package without source modifications; bundling/minification is executable-form distribution. This notice does not restrict your rights in that source.':''}\n`);
}
const versions=JSON.parse(await read('assets/filters/VERSIONS.json'));
const filters=Object.entries(versions).map(([name,v])=>`| ${name} | ${v.version} | ${v.fetchedAt} | ${v.sha256} |`).join('\n');
const font=retain('Geist 1.9.1 — SIL OFL-1.1',await read('ui/brand/OFL.txt'));
const logos=retain('@lobehub/icons-static-svg 1.102.0 — MIT',await read('ui/logos/SOURCE.md'));
const runtime=retain('Runtime dangerous-site feeds — Unlicense / MIT',await read('assets/filters/safebrowsing-NOTICE.txt'));
const filterNotice=retain('EasyList / EasyPrivacy — CC BY-SA 3.0 attribution',await read('assets/filters/NOTICE.txt'));
const output=`# Heisen ${metadata.version} — Third-party notices

Generated offline by \`node scripts/notices.mjs\` from \`npm ls --omit=dev --all --long --json\`, the lockfile, installed license/NOTICE files, and checked-in asset provenance. Regenerate after dependency or asset changes. Do not edit this generated file.

## Scope and licenses

The ${packages.size} installed production package instances below are a conservative superset of the JavaScript shipped in the main process, renderer, preloads, reader and CLI. Tree-shaken and type-only dependencies are also credited; their listing does not assert that their code is present. Nested installations and versions are kept distinct. Build-only tools are excluded. Electron is listed separately because its runtime ships even though it is a development dependency.

MIT, BSD, ISC, Apache-2.0, Unlicense and OFL permit redistribution and commercial use subject to their terms. No noncommercial or redistribution-prohibited license was found in this production closure. Ghostery/remusao modules carry file-level MPL-2.0 obligations; source locations and full texts follow. DOMPurify is distributed under its Apache-2.0 option. This document does not relicense Heisen or third-party works.

## Electron / Chromium runtime

Electron ${metadata.devDependencies.electron}: MIT; Copyright (c) Electron contributors; Copyright (c) 2013-2020 GitHub Inc. Source: https://github.com/electron/electron/tree/v${metadata.devDependencies.electron}.

The runtime includes Chromium, Node.js and other components with their own licenses. Their complete vendor-supplied notices are shipped alongside this file as \`LICENSE\` and \`LICENSES.chromium.html\`, rather than duplicated here. Locations: macOS \`Heisen.app/Contents/Resources/\`; Windows \`resources/\`. Packaging copies the packager's original texts into those directories before signing/installer creation. The stock macOS packager output places them beside, not inside, Heisen.app; copying the app alone would otherwise omit them.

## Fonts, icons and brand assets

- Geist variable font, package version 1.9.1, unmodified: SIL OFL-1.1; Copyright (c) 2023 Vercel, in collaboration with basement.studio. Source: https://github.com/vercel/geist-font ; package: https://www.npmjs.com/package/geist/v/1.9.1 . Full text: ${font}. The font may be bundled commercially, but may not be sold on its own; derivatives must retain OFL terms.
- Lucide React ${metadata.dependencies['lucide-react']}: ISC, with MIT for Feather-derived icons. Copyright (c) 2026 Lucide Icons and Contributors; Copyright (c) 2013-present Cole Bemis. Source: https://github.com/lucide-icons/lucide . Both texts and the derived-icon inventory are included in the package section.
- Provider marks (Claude, OpenAI, GitHub Copilot, Gemini, OpenRouter, Ollama): unmodified @lobehub/icons-static-svg 1.102.0, MIT, Copyright (c) 2023 LobeHub. Source: https://github.com/lobehub/lobe-icons . Full provenance and text: ${logos}. Trademarks remain property of their owners; the copyright license does not imply endorsement or a trademark license.
- Heisen wave-H mark (ui/brand/mark.png; assets/heisen.png and application icon derivatives): generated for Heisen, not a third-party stock asset, per ui/brand/SOURCE.md. No third-party copyright/license is asserted for this first-party brand asset.

## Bundled filter data

EasyList / EasyPrivacy, © The EasyList authors (https://easylist.to/). Upstream permits GPL-3.0-or-later OR CC-BY-SA-3.0-or-later; Heisen chooses **CC BY-SA 3.0 Unported**, not GPL. The compiled filter data remains CC BY-SA 3.0. Network filters are compiled with Ghostery; cosmetic filters are excluded, a transformation from the original text. Heisen's application code is not relicensed by this data attribution.

License/legal code: https://creativecommons.org/licenses/by-sa/3.0/ and https://creativecommons.org/licenses/by-sa/3.0/legalcode . Upstream licensing statement: https://easylist.to/pages/licence.html . Source lists: https://easylist.to/easylist/easylist.txt and https://easylist.to/easylist/easyprivacy.txt . Source repository: https://github.com/easylist/easylist . Full bundled attribution: ${filterNotice}.

| List | Version | Fetched at | Original source SHA-256 |
| --- | --- | --- | --- |
${filters}

## Runtime-only dangerous-site lists

No feed snapshot is included in the installer. The local updater downloads Block List Project malware, phishing, scam, ransomware and fraud lists (Unlicense; public-domain dedication by the authors) and Phishing.Database active phishing domains (MIT; Copyright (c) 2018-2025 Mitchell Krog, Nissar Chababy and Phishing.Database Contributors). Versions are the runtime HTTP snapshots/ETags, not a fixed application release. Source repositories, exact feed URLs and full license texts: ${runtime}.

## Native helpers and external tools

The macOS heisen-computer binary is compiled from Heisen's helpers/computer/macos/main.swift against operating-system AppKit, ApplicationServices, Carbon and ScreenCaptureKit; no third-party helper executable is vendored. Windows ships Heisen's helpers/computer/windows/heisen-computer.ps1, using installed .NET/Windows UI Automation and operating-system DLLs rather than redistributing those libraries. CLI launchers are first-party source. Electron's helper apps, frameworks and native libraries are covered by the runtime notices above. Docker, container images, system Node.js and external MCP servers are not bundled in the installer and retain their own distribution terms.

## Production dependency inventory

${details.join('\n')}
## Full license and attribution texts

${[...texts].map(([id,{labels,text}])=>`<a id="license-${id}"></a>\n\n### ${labels.join('; ')}\n\n\`\`\`text\n${text}\n\`\`\`\n`).join('\n')}`;
await fs.writeFile(path.join(root,'THIRD_PARTY_NOTICES.md'),output);
console.log(`Wrote THIRD_PARTY_NOTICES.md: ${packages.size} production package instances, ${texts.size} distinct license/notice texts.`);
