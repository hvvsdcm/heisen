import {Menu,Tray} from 'electron';
import {trayImage} from './platform-app.ts';
export type TrayActions={newWindow:()=>void;quit:()=>void;show:()=>void};
export function refreshTray(tray:Tray,deps:TrayActions,status:{tasks:number;routines:number}):void{
 tray.setContextMenu(Menu.buildFromTemplate([
  {id:'tray-new-window',label:'새 창',click:deps.newWindow},
  {id:'tray-tasks',label:`실행 중인 작업 ${status.tasks}`,enabled:false},
  {id:'tray-routines',label:`예약된 루틴 ${status.routines}`,enabled:false},
  {type:'separator'},
  {id:'tray-quit',label:'Heisen 종료',click:deps.quit}
 ]));
 tray.setToolTip(`Heisen · 작업 ${status.tasks} · 루틴 ${status.routines}`);
}
export function installTray(deps:TrayActions):Tray{
 const tray=new Tray(trayImage());refreshTray(tray,deps,{tasks:0,routines:0});
 if(process.platform==='win32')tray.on('click',deps.show);
 return tray;
}
