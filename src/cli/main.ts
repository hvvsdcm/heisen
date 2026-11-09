import {parseArgs} from 'node:util';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {CLI_VERSION,CliError,ControlClient,runStdioBridge,type ClientOptions} from './client.ts';
import {installCli,uninstallCli} from './install.ts';
import type {Json,Notification,ToolResult} from '../control-protocol.ts';
import {runRepl} from './repl.ts';
import {runMcp} from './mcp.ts';

const optionDefinitions={
 json:{type:'boolean'},host:{type:'string'},profile:{type:'string'},socket:{type:'string'},timeout:{type:'string'},
 'allow-page-js':{type:'boolean'},help:{type:'boolean',short:'h'},version:{type:'boolean'},stdio:{type:'boolean'},
 url:{type:'string',multiple:true},deep:{type:'boolean'},skill:{type:'string'},memory:{type:'string',multiple:true},
 'no-wait':{type:'boolean'},active:{type:'boolean'},text:{type:'string'},file:{type:'string'},user:{type:'boolean'},
 eval:{type:'string',short:'e'},submit:{type:'boolean'},full:{type:'boolean'},load:{type:'boolean'},for:{type:'string'},
} as const;
export type CliValues={json?:boolean;host?:string;profile?:string;socket?:string;timeout?:string;'allow-page-js'?:boolean;help?:boolean;version?:boolean;stdio?:boolean;url?:string[];deep?:boolean;skill?:string;memory?:string[];'no-wait'?:boolean;active?:boolean;text?:string;file?:string;user?:boolean;eval?:string;submit?:boolean;full?:boolean;load?:boolean;for?:string};
export type CommandContext={args:string[];values:CliValues;options:ClientOptions;json:boolean;connect:()=>Promise<ControlClient>;print:(value:unknown)=>void;allowOptions:(...names:string[])=>void};
type Command={usage:string;run:(context:CommandContext)=>Promise<number>};
const globals=['json','host','profile','socket','timeout','allow-page-js','help','version'];
const terminalCodes:Record<string,number>={completed:0,failed:1,cancelled:2,interrupted:3};
function record(value:unknown):value is Record<string,unknown>{return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function text(value:unknown):string{
 const output=typeof value==='string'?value:JSON.stringify(value)??'';
 return output.replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g,'');
}
function printResult(value:unknown,json:boolean):void{
 if(json){console.log(JSON.stringify(value??null));return;}
 if(Array.isArray(value)){
  if(value.length===0){console.log('없음');return;}
  if(value.every(record)){
   const columns=[...new Set(value.flatMap(row=>Object.keys(row)))];
   console.log(columns.join('  '));
   for(const row of value)console.log(columns.map(key=>text(row[key]).replace(/[\r\n\t]/g,' ')).join('  '));
  }else for(const row of value)console.log(text(row));
 }else if(record(value)){
  for(const [key,item] of Object.entries(value))console.log(`${key}: ${text(item)}`);
 }else console.log(text(value));
}
function arity(args:string[],min:number,max=min):void{
 if(args.length<min||args.length>max||args.some(arg=>!arg.trim()))throw new CliError(64,'명령 인수를 확인하세요. heisen --help');
}
function tabIdArg(value:string):number{
 const tabId=Number(value);
 if(!Number.isSafeInteger(tabId)||tabId<1)throw new CliError(64,'탭 id는 양의 정수여야 합니다.');
 return tabId;
}
function taskExit(value:unknown):number{
 return record(value)&&typeof value.status==='string'?terminalCodes[value.status]??0:0;
}
async function taskWait(context:CommandContext,id:string,watch:boolean):Promise<number>{
 const client=await context.connect();
 const notify=(notification:Notification)=>{
  if(!record(notification.params)||notification.params.id!==id)return;
  if(notification.method!=='task.event'&&notification.method!=='task.status')return;
  if(context.json){console.log(JSON.stringify(notification));return;}
  if(notification.method==='task.event'&&record(notification.params.event)){
   const event=notification.params.event;
   console.log(`[${text(event.time)}] ${text(event.type)}: ${text(event.text)}`);
  }else if(notification.method==='task.status'){
   console.log(`상태: ${text(notification.params.status)}`);
   if(record(notification.params.approval))console.log(`승인 필요: ${text(notification.params.approval.title)}`);
  }
 };
 if(watch)client.on('notification',notify);
 try{
  if(watch)await client.call('tasks.watch',{id});
  const result=await client.call('tasks.wait',{id,...context.options.timeoutMs?{timeoutMs:context.options.timeoutMs}:{}});
  context.print(result);return taskExit(result);
 }finally{client.off('notification',notify);}
}
async function tabTool(context:CommandContext,name:string,args:Json):Promise<number>{
 const client=await context.connect(),result=await client.call<ToolResult>('tools.call',{name,arguments:args});
 if(context.json)context.print(result);
 else for(const content of result.content){
  if(content.type!=='text')continue;
  let parsed:unknown;try{parsed=JSON.parse(content.text);}catch{parsed=content.text;}
  if(name==='list_tabs'&&Array.isArray(parsed)&&parsed.every(record)){
   console.log('id  [*]  제목  URL');
   for(const tab of parsed)console.log(`${text(tab.tabId)}  ${tab.active?'[*]':'[ ]'}  ${text(tab.title).replace(/[\r\n\t]/g,' ')}  ${text(tab.url).replace(/[\r\n\t]/g,' ')}`);
  }else context.print(parsed);
 }
 if(result.isError)throw new CliError(1,result.content.filter(content=>content.type==='text').map(content=>content.text).join('\n')||'도구 실행에 실패했습니다.');
 return 0;
}
async function memoryText(values:CliValues):Promise<string>{
 if(values.text!==undefined&&values.file!==undefined)throw new CliError(64,'--text와 --file 중 하나만 지정하세요.');
 let result:string;
 if(values.text!==undefined)result=values.text;
 else if(values.file!==undefined)result=await readFile(values.file,'utf8');
 else{
  if(process.stdin.isTTY)throw new CliError(64,'--text, --file 또는 표준 입력을 지정하세요.');
  result='';process.stdin.setEncoding('utf8');
  for await(const chunk of process.stdin){result+=chunk;if(result.length>60000)throw new CliError(64,'메모리는 60,000자 이하여야 합니다.');}
 }
 if(result.length>60000)throw new CliError(64,'메모리는 60,000자 이하여야 합니다.');
 return result;
}

// C-04 can register repl/mcp here with one handler entry each, using the same context.
const commands:Record<string,Command>={
 repl:{usage:'repl [-e <코드>] [파일]',run:runRepl},
 mcp:{usage:'mcp',run:runMcp},
 exec:{usage:'exec "<요청>" [--url <URL>] [--deep] [--skill <id>] [--memory <이름>] [--no-wait]',run:async context=>{
  context.allowOptions('url','deep','skill','memory','no-wait');arity(context.args,1);
  const client=await context.connect(),values=context.values;
  const result=await client.call<{id:string}>('tasks.start',{prompt:context.args[0],...values.url?{urls:values.url}:{},...values.deep?{mode:'deep'}:{},...values.skill?{skillId:values.skill}:{},...values.memory?{memoryIds:values.memory}:{}});
  if(values['no-wait']){context.print(result);return 0;}
  return taskWait(context,result.id,true);
 }},
 tasks:{usage:'tasks list | show|cancel|wait <id> | continue <id> "<요청>"',run:async context=>{
  context.allowOptions();const [action,...args]=context.args;
  if(action==='list')arity(args,0);else if(action==='continue')arity(args,2);else if(['show','cancel','wait'].includes(action))arity(args,1);else throw new CliError(64,'작업 명령을 확인하세요.');
  if(action==='wait')return taskWait(context,args[0],false);
  const method=action==='show'?'get':action;
  const client=await context.connect(),result=await client.call(`tasks.${method}`,action==='list'?undefined:{id:args[0],...action==='continue'?{prompt:args[1]}:{}});
  context.print(result);return taskExit(result);
 }},
 tabs:{usage:'tabs list | open <URL> [--active] | select|close <id>',run:async context=>{
  const [action,...args]=context.args;context.allowOptions(...action==='open'?['active']:[]);
  if(action==='list'){arity(args,0);return tabTool(context,'list_tabs',{});}
  if(action==='open'){arity(args,1);return tabTool(context,'open_tab',{url:args[0],active:context.values.active===true});}
  if(action!=='select'&&action!=='close')throw new CliError(64,'탭 명령을 확인하세요.');
  arity(args,1);const tabId=tabIdArg(args[0]);
  return tabTool(context,`${action}_tab`,{tabId});
 }},
 open:{usage:'open <URL>',run:async context=>{
  context.allowOptions();arity(context.args,1);return tabTool(context,'open_tab',{url:context.args[0],active:true});
 }},
 snapshot:{usage:'snapshot <탭> [--full]',run:async context=>{
  context.allowOptions('full');arity(context.args,1);const tabId=tabIdArg(context.args[0]);
  await tabTool(context,'snapshot',{tabId});return context.values.full?tabTool(context,'page_markdown',{tabId}):0;
 }},
 click:{usage:'click <탭> <ref>',run:async context=>{
  context.allowOptions();arity(context.args,2);return tabTool(context,'click',{tabId:tabIdArg(context.args[0]),ref:context.args[1]});
 }},
 type:{usage:'type <탭> <ref> <텍스트> [--submit]',run:async context=>{
  context.allowOptions('submit');arity(context.args,3);return tabTool(context,'type',{tabId:tabIdArg(context.args[0]),ref:context.args[1],text:context.args[2],submit:context.values.submit===true});
 }},
 key:{usage:'key <탭> <키>',run:async context=>{
  context.allowOptions();arity(context.args,2);return tabTool(context,'press_key',{tabId:tabIdArg(context.args[0]),key:context.args[1]});
 }},
 scroll:{usage:'scroll <탭> up|down [px]',run:async context=>{
  context.allowOptions();arity(context.args,2,3);const [id,direction,pixels]=context.args,tabId=tabIdArg(id);
  if(direction!=='up'&&direction!=='down')throw new CliError(64,'스크롤 방향은 up 또는 down이어야 합니다.');
  const amount=pixels===undefined?undefined:Number(pixels);
  if(amount!==undefined&&(!Number.isSafeInteger(amount)||amount<1))throw new CliError(64,'스크롤 거리는 양의 정수여야 합니다.');
  return tabTool(context,'scroll',{tabId,direction,...amount!==undefined?{amount}:{}});
 }},
 select:{usage:'select <탭> <ref> <값>',run:async context=>{
  context.allowOptions();arity(context.args,3);return tabTool(context,'select_option',{tabId:tabIdArg(context.args[0]),ref:context.args[1],value:context.args[2]});
 }},
 go:{usage:'go <탭> <URL|back|forward>',run:async context=>{
  context.allowOptions();arity(context.args,2);const tabId=tabIdArg(context.args[0]),url=context.args[1];
  return tabTool(context,url==='back'?'go_back':url==='forward'?'go_forward':'navigate',{tabId,...url==='back'||url==='forward'?{}:{url}});
 }},
 read:{usage:'read <탭>',run:async context=>{
  context.allowOptions();arity(context.args,1);return tabTool(context,'page_markdown',{tabId:tabIdArg(context.args[0])});
 }},
 shot:{usage:'shot <탭> <파일.png>',run:async context=>{
  context.allowOptions();arity(context.args,2);const tabId=tabIdArg(context.args[0]),file=context.args[1],client=await context.connect();
  const result=await client.call<ToolResult>('tools.call',{name:'screenshot',arguments:{tabId}});
  if(result.isError)throw new CliError(1,result.content.filter(item=>item.type==='text').map(item=>item.text).join('\n')||'도구 실행에 실패했습니다.');
  const image=result.content.find(item=>item.type==='image'&&item.mimeType==='image/png');
  if(!image||image.type!=='image')throw new CliError(1,'PNG 스크린샷이 없습니다.');
  await writeFile(file,Buffer.from(image.data,'base64'),{mode:0o600});context.print(file);return 0;
 }},
 wait:{usage:'wait <탭> [--for <텍스트>] [--load] [--timeout <초>]',run:async context=>{
  context.allowOptions('for','load');arity(context.args,1);const {values,options}=context;
  return tabTool(context,'wait_for',{tabId:tabIdArg(context.args[0]),...values.for!==undefined?{text:values.for}:{},...values.load!==undefined?{load:values.load}:{},...options.timeoutMs!==undefined?{timeoutMs:Math.min(30000,options.timeoutMs)}:{}});
 }},
 status:{usage:'status',run:async context=>{
  context.allowOptions();arity(context.args,0);const client=await context.connect();context.print(await client.call('status'));return 0;
 }},
 memory:{usage:'memory list|dream | read|delete <이름> | write <이름> [--text <내용>|--file <파일>] | search <검색어> | history [이름] | revert <리비전>',run:async context=>{
  const [action,...args]=context.args;context.allowOptions(...action==='write'?['text','file']:[]);
  let params:Json|undefined;
  switch(action){
   case 'list':case 'dream':arity(args,0);break;
   case 'read':case 'delete':arity(args,1);params={name:args[0]};break;
   case 'write':arity(args,1);params={name:args[0],text:await memoryText(context.values)};break;
   case 'search':arity(args,1);params={query:args[0]};break;
   case 'history':arity(args,0,1);params=args.length?{name:args[0]}:undefined;break;
   case 'revert':arity(args,1);params={id:args[0]};break;
   default:throw new CliError(64,'메모리 명령을 확인하세요.');
  }
  const client=await context.connect();context.print(await client.call(`memory.${action}`,params));return 0;
 }},
 skills:{usage:'skills list | install <소스> | remove|enable|disable|show <id>',run:async context=>{
  context.allowOptions();const [action,...args]=context.args;
  let method=action,params:Json|undefined;
  switch(action){
   case 'list':arity(args,0);break;
   case 'install':arity(args,1);params={source:args[0]};break;
   case 'remove':arity(args,1);params={id:args[0]};break;
   case 'enable':case 'disable':arity(args,1);method='enable';params={id:args[0],enabled:action==='enable'};break;
   case 'show':arity(args,1);method='body';params={id:args[0]};break;
   default:throw new CliError(64,'스킬 명령을 확인하세요.');
  }
  const client=await context.connect(),result=await client.call(`skills.${method}`,params);context.print(result);
  if(action==='install'&&record(result)&&result.approved===false){console.error('앱에서 권한을 허용하세요.');return 1;}
  return 0;
 }},
 routines:{usage:'routines list | run|toggle <id>',run:async context=>{
  context.allowOptions();const [action,...args]=context.args;
  if(action==='list')arity(args,0);else if(action==='run'||action==='toggle')arity(args,1);else throw new CliError(64,'루틴 명령을 확인하세요.');
  const client=await context.connect();context.print(await client.call(`routines.${action}`,action==='list'?undefined:{id:args[0]}));return 0;
 }},
 install:{usage:'install [--user]',run:async context=>{
  context.allowOptions('user');arity(context.args,0);
  if(context.options.host)throw new CliError(64,'설치는 원격 호스트에서 직접 실행하세요.');
  const result=await installCli(fileURLToPath(import.meta.url),{user:context.values.user});context.print(result);
  if(result.pathHint&&!context.json)console.error('~/.local/bin을 PATH에 추가하세요.');return 0;
 }},
 uninstall:{usage:'uninstall',run:async context=>{
  context.allowOptions();arity(context.args,0);
  if(context.options.host)throw new CliError(64,'제거는 원격 호스트에서 직접 실행하세요.');
  context.print(await uninstallCli(fileURLToPath(import.meta.url)));return 0;
 }},
 completion:{usage:'completion bash|zsh|fish|pwsh',run:async context=>{
  context.allowOptions();arity(context.args,1);console.log(completion(context.args[0]));return 0;
 }},
};
function completion(shell:string):string{
 const subcommands='list show cancel wait continue open select close read write delete search history revert dream install remove enable disable run toggle up down back forward';
 const flags=Object.keys(optionDefinitions).filter(name=>name!=='stdio').map(name=>'--'+name);
 const words=[...Object.keys(commands),...subcommands.split(' '),...flags];
 switch(shell){
  case 'bash':return `_heisen() { COMPREPLY=( $(compgen -W '${words.join(' ')}' -- "\${COMP_WORDS[COMP_CWORD]}") ); }\ncomplete -F _heisen heisen`;
  case 'zsh':return `#compdef heisen\n_heisen() { local -a words; words=(${words.map(word=>`'${word}'`).join(' ')}); compadd -- $words; }\ncompdef _heisen heisen`;
  case 'fish':return [`complete -c heisen -f -a '${Object.keys(commands).join(' ')} ${subcommands}'`,...Object.entries(optionDefinitions).filter(([name])=>name!=='stdio').map(([name,option])=>`complete -c heisen -l ${name}${option.type==='string'?' -r':''}`)].join('\n');
  case 'pwsh':return `Register-ArgumentCompleter -Native -CommandName heisen -ScriptBlock {\n param($wordToComplete, $commandAst, $cursorPosition)\n @(${words.map(word=>`'${word}'`).join(',')}) | Where-Object { $_.StartsWith($wordToComplete, [StringComparison]::OrdinalIgnoreCase) } | ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }\n}`;
  default:throw new CliError(64,'완성 셸은 bash, zsh, fish, pwsh 중 하나여야 합니다.');
 }
}
async function main():Promise<number>{
 if(Number(process.versions.node.split('.')[0])<22)throw new CliError(4,'Node.js 22 이상이 필요합니다. https://nodejs.org');
 let parsed;
 try{parsed=parseArgs({options:optionDefinitions,strict:true,allowPositionals:true});}catch{throw new CliError(64,'명령 인수를 확인하세요. heisen --help');}
 const values:CliValues=parsed.values,[name,...args]=parsed.positionals;
 if(values.help||(!name&&!values.version&&!values.stdio)){
  console.log(`Heisen CLI ${CLI_VERSION}\n사용법: heisen [옵션] <명령>\n\n${Object.values(commands).map(command=>'  '+command.usage).join('\n')}\n\n옵션: --json --host <SSH 호스트> --profile <경로> --socket <경로>\n      --timeout <초> --allow-page-js --help --version`);return 0;
 }
 if(values.version){console.log(values.json?JSON.stringify({version:CLI_VERSION}):CLI_VERSION);return 0;}
 const options:ClientOptions={profile:values.profile,socket:values.socket,host:values.host,pageJs:values['allow-page-js']};
 if(values.timeout!==undefined){
  const timeout=Number(values.timeout)*1000;
  if(!Number.isFinite(timeout)||timeout<1||timeout>2147483647)throw new CliError(64,'제한 시간은 0초 초과, 2147483.647초 이하여야 합니다.');
  options.timeoutMs=timeout;
 }
 let client:ControlClient|undefined;
 const context:CommandContext={args,values,options,json:values.json===true,
  connect:async()=>client??(client=await ControlClient.connect(options)),
  print:value=>printResult(value,values.json===true),
  allowOptions:(...names)=>{for(const option of Object.keys(values))if(!globals.includes(option)&&!names.includes(option))throw new CliError(64,`이 명령에는 --${option} 옵션을 사용할 수 없습니다.`);},
 };
 try{
  if(values.stdio){context.allowOptions('stdio');if(name||values.json)throw new CliError(64,'--stdio에는 명령이나 --json을 지정할 수 없습니다.');await runStdioBridge(options);return 0;}
  if(!Object.hasOwn(commands,name))throw new CliError(64,'알 수 없는 명령입니다. heisen --help');
  return await commands[name].run(context);
 }finally{client?.close();}
}
process.stdout.on('error',error=>{
 if((error as NodeJS.ErrnoException).code==='EPIPE')process.exit(0);
 console.error(`오류: ${text(error.message)}`);process.exit(1);
});
void main().then(code=>{process.exitCode=code;},error=>{
 console.error(`오류: ${text(error instanceof Error?error.message:String(error))}`);
 process.exitCode=error instanceof CliError?error.exitCode:1;
});
