import type {Store} from './store.ts';
import type {registerRpc as RegisterRpc} from './rpc.ts';

type AuditDeps={store:Pick<Store,'audits'|'clearAudit'>;changed:()=>void;registerRpc:typeof RegisterRpc};

// Keep audit history request-only; it must not expand every window's state broadcast.
export function registerAuditRpc({store,changed,registerRpc}:AuditDeps):void{
 registerRpc({
  'audit.list':(args)=>{
   const limit=Number(args?.limit)||300;
   return store.audits(Math.max(1,Math.min(1000,Math.trunc(limit))));
  },
  'audit.clear':()=>{store.clearAudit();changed();return true;}
 });
}
