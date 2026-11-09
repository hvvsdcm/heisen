import type {Api,KnownProvider,Model} from '@mariozechner/pi-ai';
import type {Auth} from './auth.ts';
import type {Data} from './data.ts';

const piProviders:Record<string,KnownProvider>={'claude-subscription':'anthropic',chatgpt:'openai-codex','github-copilot':'github-copilot',google:'google'};
export class ModelNotConnectedError extends Error{constructor(){super('설정에서 AI 계정을 먼저 연결하세요.');this.name='ModelNotConnectedError';}}

// Static SDK imports would violate the startup loading boundary tested in e2e-agent.ts.
// Match the agent loop's lazy provider loading; this path never offers or executes tools.
export async function complete(auth:Auth,data:Data,input:{system:string;user:string;signal?:AbortSignal;maxTokens?:number}):Promise<{text:string;model:string}>{
 const {system,user,signal}=input,maxTokens=input.maxTokens??16000,provider=data.state.settings.provider;
 signal?.throwIfAborted();
 if(!Number.isSafeInteger(maxTokens)||maxTokens<1)throw new Error('출력 토큰 한도가 올바르지 않습니다.');
 if(!auth.secrets.has(provider))throw new ModelNotConnectedError();
 const model=data.state.settings.model||(await auth.models(provider))[0]?.id;
 if(!model)throw new Error('사용할 모델을 선택하세요.');
 const credential=await auth.credential(provider);signal?.throwIfAborted();let text:string;
 if(provider==='anthropic'){
  const {default:Anthropic}=await import('@anthropic-ai/sdk');const client=new Anthropic({apiKey:credential.key,maxRetries:0});
  const response=await client.messages.stream({model,max_tokens:maxTokens,system,messages:[{role:'user',content:user}]},{signal}).finalMessage();
  if(response.stop_reason!=='end_turn'||response.content.some(block=>block.type==='tool_use'))throw new Error('모델 응답이 정상 종료되지 않았습니다.');
  text=response.content.filter(block=>block.type==='text').map(block=>block.text).join('\n');
 }else if(provider==='openai'){
  const {default:OpenAI}=await import('openai');const client=new OpenAI({apiKey:credential.key,maxRetries:0});
  const response=await client.responses.stream({model,store:false,stream:true,instructions:system,input:[{role:'user',content:user}],tools:[],max_output_tokens:maxTokens},{signal}).finalResponse();
  if(response.status!=='completed'||response.output.some(block=>block.type==='function_call'))throw new Error('모델 응답이 정상 종료되지 않았습니다.');
  text=response.output_text;
 }else if(piProviders[provider]){
  const {getModels,streamSimple}=await import('@mariozechner/pi-ai');const {getOAuthProvider}=await import('@mariozechner/pi-ai/oauth');
  const piProvider=piProviders[provider],oauth=provider==='google'?undefined:getOAuthProvider(piProvider);let available:Model<Api>[]=getModels(piProvider);
  if(oauth?.modifyModels&&typeof credential.access==='string'&&typeof credential.refresh==='string'&&typeof credential.expires==='number')available=oauth.modifyModels(available,{...credential,access:credential.access,refresh:credential.refresh,expires:credential.expires});
  const selected=available.find(candidate=>candidate.id===model);if(!selected)throw new Error('이 제공자의 모델 목록에서 모델을 다시 선택하세요.');
  const response=await streamSimple(selected,{systemPrompt:system,messages:[{role:'user',content:user,timestamp:Date.now()}],tools:[]},{apiKey:oauth?credential.apiKey:credential.key,signal,maxTokens}).result();
  if(response.stopReason!=='stop'||response.content.some(block=>block.type==='toolCall'))throw new Error(response.errorMessage||'모델 응답이 정상 종료되지 않았습니다.');
  text=response.content.filter(block=>block.type==='text').map(block=>block.text).join('\n');
 }else{
  const {default:OpenAI}=await import('openai');const client=new OpenAI({apiKey:credential.key||'local',baseURL:credential.baseURL||(provider==='openrouter'?'https://openrouter.ai/api/v1':'http://localhost:11434/v1'),maxRetries:0});
  const response=await client.chat.completions.create({model,messages:[{role:'system',content:system},{role:'user',content:user}],max_tokens:maxTokens},{signal});
  const choice=response.choices[0];if(!choice||choice.finish_reason!=='stop'||choice.message.tool_calls?.length||choice.message.function_call)throw new Error('모델 응답이 정상 종료되지 않았습니다.');
  text=choice.message.content||'';
 }
 signal?.throwIfAborted();if(!text.trim())throw new Error('모델 응답이 없습니다.');return {text,model};
}
