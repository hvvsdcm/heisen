import {app,type BaseWindow,type BaseWindowConstructorOptions} from 'electron';

// Enabled by main only after the same dev/test-package gate as HEISEN_BETA_URL.
export let testBackground=false;
export function enableTestBackground():void{
 testBackground=true;
 // Keep real visible/rendering pages, not hidden windows or disabled throttling.
 app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
 if(process.platform==='darwin')app.setActivationPolicy('accessory');
 app.on('browser-window-created',(_event,win)=>quietWindow(win));
}
// browser-window-created skips BaseWindow popups, so Browser calls this for them.
export function quietWindow(win:BaseWindow):void{
 win.setFocusable(false);win.setIgnoreMouseEvents(true);
 if(process.platform!=='linux')win.setOpacity(0);
}
export function testWindowOptions():BaseWindowConstructorOptions{
 return testBackground?{show:false,focusable:false,skipTaskbar:true,...(process.platform==='linux'?{}:{opacity:0})}:{};
}
export function showWindow(win:BaseWindow,inactive=false):void{
 if(testBackground||inactive)win.showInactive();else win.show();
}
export function focusWindow(win:BaseWindow):void{
 if(!testBackground)win.focus();
}
