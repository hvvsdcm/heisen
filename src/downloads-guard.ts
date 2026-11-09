import path from 'node:path';

export const DANGEROUS_EXTENSIONS=new Set(['exe','msi','msix','msixbundle','appx','bat','cmd','com','scr','pif','ps1','psm1','vbs','vbe','js','jse','wsf','wsh','hta','cpl','reg','lnk','jar','dll','sys','inf','dmg','pkg','mpkg','app','command','sh','zsh','tool','action','workflow','apk','deb','rpm','appimage','iso','img','vhd','vhdx','xpi','crx','terminal','url','scf','desktop','appref-ms','jnlp','msc','wsc','sct','py','pyw','ws']);
// Windows discards trailing dots/spaces; classify the effective final extension.
export function dangerousName(name:string):boolean{return DANGEROUS_EXTENSIONS.has(path.extname(name.replace(/[. ]+$/,'')).slice(1).toLowerCase());}
export type DownloadRow={id:string;name:string;url:string;received:number;total:number;state:string;path:string;incognito:boolean;at:number;danger?:string};
