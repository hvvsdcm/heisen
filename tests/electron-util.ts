import assert from 'node:assert/strict';
import type {ElectronApplication,Page} from 'playwright';

// Playwright 1.64.1 auto-attaches every page and Chromium then reports capture=true.
// Its public CDP API creates a *different* session, which cannot disable that root's
// auto-attach. Keep the pinned-version adapter shared by the sleep test and benchmark.
// Call before opening/visiting web tabs: detach existing targets, then track only UI.
export async function attachOnlyLocalUI(app:ElectronApplication,ui:Page):Promise<Page>{
 type RootSession={send(method:string,args?:object):Promise<any>};
 type InProcessApp={_connection:{toImpl(app:ElectronApplication):{_browserContext:{_browser:{_session:RootSession}}}}};
 // Playwright omits the in-process implementation bridge from its public typings.
 const inProcessApp=app as unknown as InProcessApp,connection=inProcessApp._connection;
 assert.equal(typeof connection?.toImpl,'function','Playwright root-session adapter needs updating');
 assert.ok(ui.url().startsWith('file:'),'Only the local UI may be attached');
 const cdp=connection.toImpl(app)._browserContext._browser._session;
 const targets=await cdp.send('Target.getTargets'),target=targets.targetInfos.find((t:{url:string})=>t.url===ui.url());assert.ok(target,'local UI target missing');
 const closed=ui.waitForEvent('close');await cdp.send('Target.setAutoAttach',{autoAttach:false,waitForDebuggerOnStart:false,flatten:true});await closed;
 const window=app.waitForEvent('window');await cdp.send('Target.attachToTarget',{targetId:target.targetId,flatten:true});return await window;
}
