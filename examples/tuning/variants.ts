/** Experimental model-facing variants. No production compiler/schema changes. */
export const profiles=['baseline','recipe','helper','lean','feedback'] as const;
export const helperSignature='async function collectPages<P extends {nextCursor:string|null}, R>(fetchPage:(input:{cursor?:string})=>Promise<P>, select:(page:P)=>R[]):Promise<R[]>;';
export const helperSource=`async function collectPages<P extends {nextCursor:string|null}, R>(fetchPage:(input:{cursor?:string})=>Promise<P>, select:(page:P)=>R[]):Promise<R[]> {
 const rows:R[]=[],seen=new Set<string>(); let cursor:string|undefined;
 for(let pageNumber=0;pageNumber<60;pageNumber++){
  const page=await fetchPage(cursor===undefined?{}:{cursor}); rows.push(...select(page));
  if(rows.length>10000)throw new Error('collectPages record limit exceeded');
  if(page.nextCursor===null)return rows;
  if(seen.has(page.nextCursor))throw new Error('collectPages repeated cursor');
  seen.add(page.nextCursor);cursor=page.nextCursor;
 }
 throw new Error('collectPages page limit exceeded');
}`;
export function features(profile:string):string[]{return profile==='candidate'?[]:profile==='baseline'?[]:[profile];}
export function modelDeclarations(text:string,lean:boolean){if(!lean)return text;const start=text.indexOf('declare module "@c/work"');if(start<0)throw new Error('Expected @c/work module');return 'declare const console: {log(...values:unknown[]):void};\n'+text.slice(start);}
export function recipe(op:string,field:string){return `\nWrite ordinary JavaScript-style TypeScript and let API calls infer row types. Prefer Map for lookup totals; avoid inventing generic page interfaces. Use actual response fields. A correct pagination pattern for ${op} is:\nconst rows=[]; let cursor:string|undefined; do {const page=await api.${op}(cursor?{cursor}:{});rows.push(...page.${field});cursor=page.nextCursor??undefined;} while(cursor);\nThis is only a pagination example; return the answer shape requested by the task. Remember which writes this attempt completed, even if later code fails.\n`;}
