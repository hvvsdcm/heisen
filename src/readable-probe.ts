import {isProbablyReaderable} from '@mozilla/readability';

export function probe():boolean{return isProbablyReaderable(document,{minContentLength:140,minScore:20});}
