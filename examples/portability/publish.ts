/** Publish only audited numeric metadata; raw prompts, programs and service state stay local. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dir,'../..'),out=resolve(process.env.STRATA_PORTABILITY_OUT??join(root,'.work/portability-20261001-v1'));
async function run(file:string){
 const child=Bun.spawn(['bun',join(import.meta.dir,file)],{cwd:root,env:process.env,stdout:'pipe',stderr:'inherit'});
 const text=await new Response(child.stdout).text();if(await child.exited!==0)throw Error(file+' failed');return JSON.parse(text);
}
const audit=await run('audit.ts');await run('summarize.ts');
const matrix=JSON.parse(await readFile(join(out,'matrix.json'),'utf8')),path=join(root,'docs/evaluations/portability-2026-10-01.json'),data=JSON.parse(await readFile(path,'utf8'));
data.audit=audit;
data.protocol.maxBatchCostUsd=matrix.maxBatchCostUsd;
data.protocol.amendments=matrix.amendments??[];
data.protocol.modelConfigurationNote='Muse medium and GLM low retained; Ling Pi thinking off emits no reasoning parameter. Ling provider still reports reasoning tokens. No model-specific Strata prompts, tools or checking. Provider routing/cache/default reasoning uncontrolled.';
data.protocol.implementationBase='207648b';
data.protocol.comparisonScope='New model holdout only; six existing task definitions and three existing data worlds. Shared current 052/053/058 in both arms; exact 060 recipe in candidate. No native Pi arm or causal feature ablations.';
await writeFile(path,JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify({publishedAttempts:data.cells.length,...audit}));
