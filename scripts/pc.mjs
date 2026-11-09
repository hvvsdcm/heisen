// Windows runbook: node scripts/pc.mjs <sync|install|test|package|e2e|fetch>
// Options: --host pc --dir heisen-ci --unfused (package/fetch only).
// Prerequisites: SSH/SCP, Node 24+, Git, .NET Framework 4.6.2+ on Windows.
// E2E additionally needs this SSH user logged into the desktop (and Docker for
// desktop.ts's container checks). No passwords, pushes or Desktop clones are used.
// --dir is a dedicated workspace relative to USERPROFILE, not an existing repo.
// Its source/repo layout keeps package.mjs's ../../work scratch inside it.
// Only published local HEAD is tested; uncommitted work is deliberately excluded.
// A Git bundle carries that commit over SCP: Windows credential-manager secrets
// are unavailable to noninteractive SSH sessions. GitHub is checked locally.
import fs from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const repository='https://github.com/hvvsdcm/heisen-browser.git';
const args=process.argv.slice(2),command=args.shift();
let host='pc',directory='heisen-ci',unfused=false;
for(let i=0;i<args.length;i++){
 if(args[i]==='--unfused')unfused=true;
 else if(args[i]==='--host'&&args[i+1])host=args[++i];
 else if(args[i]==='--dir'&&args[i+1])directory=args[++i];
 else throw new Error(`Unknown or incomplete option: ${args[i]}`);
}
if(!['sync','install','test','package','e2e','fetch'].includes(command))throw new Error('Usage: node scripts/pc.mjs <sync|install|test|package|e2e|fetch> [--host pc] [--dir heisen-ci] [--unfused]');
if(!/^[a-zA-Z0-9][a-zA-Z0-9_.@-]*$/.test(host))throw new Error('Invalid SSH host alias.');
if(!/^[a-zA-Z0-9_-]+$/.test(directory)||/^(desktop|documents|downloads|pictures|source|repos)$/i.test(directory))throw new Error('--dir must name a dedicated workspace directly beneath USERPROFILE, for example heisen-ci.');
if(unfused&&!['package','fetch'].includes(command))throw new Error('--unfused is only supported for package/fetch.');
const run=`${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}`;
const local=path.join(os.tmpdir(),'heisen-pc',host,run);
await fs.mkdir(local,{recursive:true});
const quote=value=>`'${String(value).replaceAll("'","''")}'`;
const sshOptions=['-o','BatchMode=yes','-o','ConnectTimeout=15','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=3'];
async function execute(program,argv,{capture=false,log,timeout=30*60*1000}={}){
 const sink=log?createWriteStream(log):null;
 let text='',errors='';
 try{
  return await new Promise((resolve,reject)=>{
   const child=spawn(program,argv,{cwd:project,stdio:['ignore','pipe','pipe']});
   const timer=setTimeout(()=>child.kill('SIGTERM'),timeout);
   for(const [stream,output] of [[child.stdout,process.stdout],[child.stderr,process.stderr]])stream.on('data',chunk=>{
    sink?.write(chunk);if(capture){if(stream===child.stdout)text+=chunk.toString();else errors+=chunk.toString();}else output.write(chunk);
   });
   child.once('error',error=>{clearTimeout(timer);reject(error);});
   child.once('close',(code,signal)=>{clearTimeout(timer);if(code===0)resolve(text.trim());else reject(new Error(`${program} exited ${code??signal}${capture?`: ${(text+errors).trim()}`:''}${log?` (log: ${log})`:''}`));});
  });
 }finally{if(sink)await new Promise(resolve=>sink.end(resolve));}
}
const ssh=(script,options)=>execute('ssh',[...sshOptions,host,'powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand '+Buffer.from(script,'utf16le').toString('base64')],options);
const psHeader=`$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
$OutputEncoding = [Console]::OutputEncoding
`;
let workspace,remoteRun;
async function prepare(){
 const result=await ssh(psHeader+`
$root = Join-Path $env:USERPROFILE ${quote(directory)}
$marker = Join-Path $root '.heisen-pc.json'
if (Test-Path -LiteralPath $root) {
 if ((Get-Item -LiteralPath $root).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Workspace cannot be a link.' }
 if (!(Test-Path -LiteralPath $marker)) { throw 'Refusing existing unowned directory. Choose a new --dir.' }
 if ((Get-Content -Raw -LiteralPath $marker | ConvertFrom-Json).repository -ne ${quote(repository)}) { throw 'Workspace owner does not match.' }
} else {
 New-Item -ItemType Directory -Path $root | Out-Null
 @{repository=${quote(repository)}} | ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath $marker
}
$repo = Join-Path $root 'source/repo'
$logs = Join-Path $root ${quote('runs/'+run)}
New-Item -ItemType Directory -Force -Path $logs | Out-Null
@{root=$root;repo=$repo;run=$logs} | ConvertTo-Json -Compress
`,{capture:true});
 workspace=JSON.parse(result);remoteRun=workspace.run.replaceAll('\\','/');
 console.log(`PC workspace: ${workspace.root}\nLocal evidence: ${local}`);
}
async function remote(body,timeout=30*60*1000){
 const script=path.join(local,`${command}.ps1`);
 await fs.writeFile(script,psHeader+`$repo = ${quote(workspace.repo)}\n$run = ${quote(workspace.run)}\n`+body,'utf8');
 await execute('scp',[...sshOptions,script,`${host}:${remoteRun}/${command}.ps1`]);
 return execute('ssh',[...sshOptions,host,`powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${remoteRun}/${command}.ps1"`],{log:path.join(local,`${command}.log`),timeout});
}
const requireRepo=`
if (!(Test-Path -LiteralPath (Join-Path $repo '.git'))) { throw 'Run sync first.' }
Set-Location -LiteralPath $repo
Write-Output ('Revision: ' + (& git rev-parse HEAD))
if ($LASTEXITCODE -ne 0) { throw 'Cannot read checkout revision.' }
$env:TEMP = Join-Path $run 'tmp'
$env:TMP = $env:TEMP
New-Item -ItemType Directory -Force -Path $env:TEMP | Out-Null
`;
// Use cmd redirection so native stderr is retained, not promoted to a terminating
// PowerShell 5 NativeCommandError. Every native exit code remains authoritative.
const stepFunction=`
function Step([string]$name, [string]$command) {
 $log = Join-Path $run ($name + '.log')
 & cmd.exe /d /s /c ($command + ' > "' + $log + '" 2>&1')
 $code = $LASTEXITCODE
 Get-Content -Encoding UTF8 -LiteralPath $log
 Write-Output ('STEP ' + $name + ' EXIT ' + $code)
 return $code
}
`;
async function collect(){
 if(!workspace)return;
 // Collect logs and screenshots, not dependency/package caches in run/tmp.
 await ssh(psHeader+`
$run = ${quote(workspace.run)}
$files = @(Get-ChildItem -LiteralPath $run -File | Where-Object { $_.Extension -in @('.log','.ps1','.exit','.pid','.zip') -and $_.Name -ne 'evidence.zip' })
if ($files.Count) { Compress-Archive -LiteralPath $files.FullName -DestinationPath (Join-Path $run 'evidence.zip') -Force }
`,{capture:true});
 if(command!=='fetch')await execute('scp',[...sshOptions,`${host}:${remoteRun}/evidence.zip`,path.join(local,'evidence.zip')]);
}
async function main(){
 if(command==='sync'){
  const revision=await execute('git',['rev-parse','HEAD'],{capture:true});
  const published=await execute('git',['ls-remote',repository,'refs/heads/main'],{capture:true});
  if(published.split(/\s/)[0]!==revision)throw new Error(`Local HEAD ${revision} is not published main. Ask the main agent to publish it; this runbook never pushes.`);
  const status=await execute('git',['status','--short'],{capture:true});
  if(status)console.warn('Local uncommitted changes are excluded; syncing published HEAD only.');
  await prepare();
  const bundle=path.join(local,'source.bundle');
  await execute('git',['bundle','create',bundle,'HEAD']);
  try{
   await execute('scp',[...sshOptions,bundle,`${host}:${remoteRun}/source.bundle`]);
   await remote(`
$bundle = Join-Path $run 'source.bundle'
try {
 $fresh = !(Test-Path -LiteralPath $repo)
 if ($fresh) {
  New-Item -ItemType Directory -Force -Path (Split-Path $repo) | Out-Null
  & git clone --no-checkout $bundle $repo
  if ($LASTEXITCODE -ne 0) { throw 'git clone failed.' }
  & git -C $repo remote set-url origin ${quote(repository)}
  if ($LASTEXITCODE -ne 0) { throw 'Cannot set checkout origin.' }
 }
 Set-Location -LiteralPath $repo
 $origin = & git remote get-url origin
 if ($LASTEXITCODE -ne 0 -or $origin -ne ${quote(repository)}) { throw 'Unexpected checkout origin.' }
 if (!$fresh) {
  $dirty = & git status --porcelain --untracked-files=no
  if ($LASTEXITCODE -ne 0 -or $dirty) { throw 'Remote tracked changes exist; refusing to overwrite them.' }
 }
 & git fetch $bundle HEAD
 if ($LASTEXITCODE -ne 0) { throw 'git fetch bundle failed.' }
 & git checkout --detach ${quote(revision)}
 if ($LASTEXITCODE -ne 0) { throw 'git checkout failed.' }
 $actual = & git rev-parse HEAD
 if ($LASTEXITCODE -ne 0 -or $actual -ne ${quote(revision)}) { throw 'Checkout revision mismatch.' }
 Write-Output ('SYNC PASS ' + $actual)
} finally { Remove-Item -LiteralPath $bundle -ErrorAction SilentlyContinue }
`);
  }finally{await fs.rm(bundle,{force:true});}
  return;
 }
 await prepare();
 if(command==='install')await remote(requireRepo+stepFunction+`
Step 'install' 'npm ci' | ForEach-Object { if ($_ -is [int]) { $code = $_ } else { Write-Output $_ } }
exit $code
`);
 if(command==='test')await remote(requireRepo+stepFunction+`
$failed = $false
foreach ($step in @(@('typecheck','npm run typecheck'), @('test','npm test'))) {
 Step $step[0] $step[1] | ForEach-Object { if ($_ -is [int]) { if ($_ -ne 0) { $failed = $true } } else { Write-Output $_ } }
}
if ($failed) { exit 1 }
`);
 if(command==='package')await remote(requireRepo+stepFunction+`
Step 'build' 'npm run build' | ForEach-Object { if ($_ -is [int]) { $code = $_ } else { Write-Output $_ } }
if ($code -ne 0) { exit $code }
${unfused?"$env:HEISEN_UNFUSED = '1'":"Remove-Item Env:HEISEN_UNFUSED -ErrorAction SilentlyContinue"}
Step 'package' 'npm run package:win' | ForEach-Object { if ($_ -is [int]) { $code = $_ } else { Write-Output $_ } }
exit $code
`);
 if(command==='e2e')await e2e();
 if(command==='fetch')await fetchRelease();
}
async function e2e(){
 await remote(requireRepo+`
# Query the exact SSH account, not an unrelated logged-in desktop user.
$sessions = & query.exe user $env:USERNAME 2>&1
# Windows 10 query.exe can return 1 even with a valid console session row.
# Require the account and numeric session ID, not localized state/header text.
$sessionPattern = '^\\s*>?\\s*' + [regex]::Escape($env:USERNAME) + '\\s+(?:\\S+\\s+)?\\d+\\s'
if (!(@($sessions) -match $sessionPattern)) { throw 'E2E requires the SSH user logged into the Windows desktop. Log in (a locked session is OK), then retry.' }
$sessions | Write-Output
if (!(Test-Path -LiteralPath 'dist/main.mjs')) { throw 'Run package (build) before e2e.' }
$task = 'HeisenE2E-${run}'
$runner = Join-Path $run 'desktop.ps1'
$log = Join-Path $run 'e2e.log'
$status = Join-Path $run 'e2e.exit'
# Keep the task's PowerShell parent alive until cleanup, so taskkill /T can also
# remove Electron descendants after a timeout or failed Playwright launch.
$runnerCode = @'
$ErrorActionPreference = 'Stop'
$run = Split-Path $PSCommandPath
$repo = [IO.Path]::GetFullPath((Join-Path $run '../../source/repo'))
$PID | Set-Content -LiteralPath (Join-Path $run 'e2e.pid')
Set-Location -LiteralPath $repo
$env:HEISEN_BETA_URL = 'skip'
$env:TEMP = Join-Path $run 'tmp'
$env:TMP = $env:TEMP
& cmd.exe /d /s /c ('node --import tsx tests\\desktop.ts > "' + (Join-Path $run 'e2e.log') + '" 2>&1')
$LASTEXITCODE | Set-Content -LiteralPath (Join-Path $run 'e2e.exit')
Start-Sleep -Seconds 90
'@
[IO.File]::WriteAllText($runner, $runnerCode, (New-Object Text.UTF8Encoding($true)))
$action = 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $runner + '"'
$user = (& whoami.exe).Trim()
$created = $false
try {
 & schtasks.exe /Create /TN $task /SC ONCE /ST ((Get-Date).AddMinutes(5).ToString('HH:mm')) /IT /RU $user /TR $action /F
 if ($LASTEXITCODE -ne 0) { throw 'Cannot create interactive scheduled task for the SSH account.' }
 $created = $true
 & schtasks.exe /Run /TN $task
 if ($LASTEXITCODE -ne 0) { throw 'Cannot start interactive scheduled task.' }
 $deadline = (Get-Date).AddMinutes(10)
 while (!(Test-Path -LiteralPath $status) -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 2 }
 if (Test-Path -LiteralPath $log) { Get-Content -Encoding UTF8 -LiteralPath $log }
 if (!(Test-Path -LiteralPath $status)) { & schtasks.exe /Query /TN $task /V /FO LIST; throw 'E2E timed out after 10 minutes; see task state and e2e.log.' }
 $code = [int](Get-Content -Raw -LiteralPath $status).Trim()
 Write-Output ('STEP e2e EXIT ' + $code)
 if ($code -ne 0) { throw ('Desktop E2E failed with exit ' + $code) }
 if ((Get-Content -Raw -Encoding UTF8 -LiteralPath $log) -notmatch 'ALL .*CHECKS PASSED') { throw 'E2E exited without its success marker.' }
} finally {
 if ($created) {
  $pidFile = Join-Path $run 'e2e.pid'
  if (Test-Path -LiteralPath $pidFile) {
   $runnerPid = [int](Get-Content -Raw -LiteralPath $pidFile).Trim()
   $process = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $runnerPid)
   if ($process -and $process.CommandLine.Contains($runner)) { & taskkill.exe /PID $runnerPid /T /F 2>&1 | Out-Host }
  }
  & schtasks.exe /End /TN $task 2>&1 | Out-Host
  & schtasks.exe /Delete /TN $task /F 2>&1 | Out-Host
 }
 $images = @(Get-ChildItem -LiteralPath (Join-Path $repo 'docs') -Filter '*.png' | Where-Object { $_.LastWriteTime -ge (Get-Item -LiteralPath $runner).LastWriteTime })
 if ($images.Count) { Compress-Archive -LiteralPath $images.FullName -DestinationPath (Join-Path $run 'screenshots.zip') -Force }
}
`,12*60*1000);
}
async function fetchRelease(){
 const output=unfused?'release-test':'release';
 const destination=path.join(project,unfused?'release-win-test':'release-win');
 await fs.mkdir(destination,{recursive:true});
 const remoteRelease=workspace.repo.replaceAll('\\','/')+'/'+output;
 const manifest=path.join(local,'SHA256SUMS.txt');
 await execute('scp',[...sshOptions,`${host}:${remoteRelease}/SHA256SUMS.txt`,manifest]);
 const lines=(await fs.readFile(manifest,'utf8')).trim().split(/\r?\n/);
 if(!lines.length||lines.some(line=>!/^([a-f0-9]{64})  (Heisen-[0-9]+\.[0-9]+\.[0-9]+-win-(x64|arm64)-Setup\.exe)$/.test(line)))throw new Error('Unexpected Windows checksum manifest.');
 for(const line of lines){
  const [expected,name]=line.split('  '),file=path.join(destination,name);
  await execute('scp',[...sshOptions,`${host}:${remoteRelease}/${name}`,file]);
  const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);
  if(hash.digest('hex')!==expected){await fs.rm(file);throw new Error(`Checksum mismatch: ${name}`);}
  console.log(`FETCH PASS ${name}`);
 }
 await fs.copyFile(manifest,path.join(destination,'SHA256SUMS.txt'));
 const merged=path.join(project,output,'SHA256SUMS.txt');
 let previous='';try{previous=await fs.readFile(merged,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
 const names=new Set(lines.map(line=>line.split('  ')[1]));
 const retained=previous.split(/\r?\n/).filter(line=>line&&!names.has(line.split(/\s+/).at(-1)));
 await fs.mkdir(path.dirname(merged),{recursive:true});
 await fs.writeFile(merged,[...retained,...lines].join('\n')+'\n');
}
let failed=false;
try{await main();}catch(error){failed=true;console.error(error.message);}finally{
 try{await collect();}catch(error){failed=true;console.error(`Evidence collection failed: ${error.message}`);}
 console.log(`Evidence: ${local}`);
}
if(failed)process.exitCode=1;
