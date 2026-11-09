import {FiltersEngine} from '@ghostery/adblocker';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';

// Network access is explicit: run npm run filters, then commit assets/filters/.
// Normal builds and the application use these serialized engines offline.
const output=new URL('../assets/filters/',import.meta.url);
const versions={},compiled=new Map();
for(const name of ['easyprivacy','easylist']){
 const url=`https://easylist.to/easylist/${name}.txt`;
 const response=await fetch(url);
 if(!response.ok)throw new Error(`${url}: HTTP ${response.status}`);
 const source=Buffer.from(await response.arrayBuffer()),text=source.toString('utf8');
 const version=text.match(/^! Version:\s*(\S+)\s*$/m)?.[1];
 if(!text.startsWith('[Adblock Plus ')||!version)throw new Error(`${url}: invalid filter list or missing version`);
 const fetchedAt=new Date().toISOString();
 const engine=FiltersEngine.parse(text,{loadCosmeticFilters:false,loadNetworkFilters:true,enableCompression:true});
 const binary=engine.serialize();
 compiled.set(name,binary);
 versions[name]={fetchedAt,sha256:createHash('sha256').update(source).digest('hex'),version,bytes:source.byteLength,binBytes:binary.byteLength};
}
// Fetch and compile both lists before replacing any committed output.
await fs.mkdir(output,{recursive:true});
for(const [name,binary] of compiled){
 await fs.writeFile(new URL(`${name}.bin`,output),binary);
 console.log(`${name}: ${versions[name].version}, ${versions[name].bytes} source bytes → ${binary.byteLength} compiled bytes`);
}
await fs.writeFile(new URL('VERSIONS.json',output),`${JSON.stringify(versions,null,2)}\n`);
await fs.writeFile(new URL('NOTICE.txt',output),`EasyList / EasyPrivacy — © The EasyList authors, https://easylist.to
CC BY-SA 3.0 (https://creativecommons.org/licenses/by-sa/3.0/) (dual GPLv3).
Distributed here under CC BY-SA 3.0; the compiled filter data retains that license.
Unmodified lists compiled into Heisen's blocking engine on ${new Date().toISOString().slice(0,10)}.
Only network filters are compiled; cosmetic filters are excluded.
Sources: https://easylist.to/easylist/easyprivacy.txt
         https://easylist.to/easylist/easylist.txt
Licensing: https://easylist.to/pages/licence.html
Fetch dates, source versions, SHA-256 digests and sizes: VERSIONS.json.
Refresh manually with npm run filters; normal builds and runtime do not fetch lists.

@ghostery/adblocker — Ghostery — MPL-2.0, used without source modifications.
Source: https://github.com/ghostery/adblocker
License: https://www.mozilla.org/MPL/2.0/

tldts — Rémi Berson — MIT.
Source and license: https://github.com/remusao/tldts

@mozilla/readability — Mozilla — Apache-2.0.
Source: https://github.com/mozilla/readability
License: https://www.apache.org/licenses/LICENSE-2.0

yaml — Eemeli Aro — ISC.
Source and license: https://github.com/eemeli/yaml

diff — BSD-3-Clause.
Source and license: https://github.com/kpdecker/jsdiff

Bundled dependency license texts are included in THIRD_PARTY_NOTICES.txt.
`);
