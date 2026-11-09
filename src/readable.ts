import {Readability} from '@mozilla/readability';
import DOMPurify from 'dompurify';

export type Article={title:string;byline:string|null;siteName:string|null;lang:string|null;dir:string|null;content:string;length:number};
export function extract():Article|null{
 const r=new Readability(document.cloneNode(true) as Document,{keepClasses:false}).parse();if(!r||!r.content)return null;
 const content=DOMPurify.sanitize(r.content,{FORBID_TAGS:['script','style','iframe','form','input','button','textarea','select','object','embed','svg','math','link','meta','base','template','video','audio','source','track'],FORBID_ATTR:['style','srcset','sizes','loading','ping','target'],ALLOWED_URI_REGEXP:/^(?:https?:|data:image\/|#|\/)/i});
 return {title:r.title??'',byline:r.byline??null,siteName:r.siteName??null,lang:r.lang??null,dir:r.dir??null,content,length:r.length??0};
}
