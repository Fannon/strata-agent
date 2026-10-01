/** Apply the frozen development gate once; no holdout result is used. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const out=resolve(process.env.STRATA_TUNING_OUT??join(import.meta.dir,'../../.work/tuning-20261001-v1'));
const rows=JSON.parse(await readFile(join(out,'summary.json'),'utf8')).filter((c:any)=>c.phase==='dev');if(rows.length!==60)throw Error('Need 60 development cells');
try{await readFile(join(out,'selection.json'));throw Error('Selection already exists; preserve it');}catch(e){if((e as any).code!=='ENOENT')throw e;}
const mean=(a:number[])=>a.reduce((n,x)=>n+x,0)/a.length,median=(a:number[])=>{const b=[...a].sort((a,b)=>a-b);return (b[2]!+b[3]!)/2;};
const decisions:any[]=[];
for(const profile of ['recipe','helper','lean','feedback']){
 const comparisons=['muse','glm'].map(model=>{const base=rows.filter((c:any)=>c.modelKey===model&&c.profile==='baseline'),arm=rows.filter((c:any)=>c.modelKey===model&&c.profile===profile);if(base.length!==6||arm.length!==6)throw Error('Incomplete development');return {model,business:arm.filter((c:any)=>c.businessSuccess).length,baselineBusiness:base.filter((c:any)=>c.businessSuccess).length,effects:arm.filter((c:any)=>c.effectsCorrect).length,baselineEffects:base.filter((c:any)=>c.effectsCorrect).length,costRatio:mean(arm.map((c:any)=>c.costUsd))/mean(base.map((c:any)=>c.costUsd)),medianTimeRatio:median(arm.map((c:any)=>c.ms))/median(base.map((c:any)=>c.ms))};});
 const eligible=comparisons.every(c=>c.business>=c.baselineBusiness&&c.effects>=c.baselineEffects&&c.costRatio<=1.10&&c.medianTimeRatio<=1.25)&&comparisons.some(c=>c.costRatio<=.9);
 decisions.push({profile,eligible,comparisons,meanCostRatio:mean(comparisons.map(c=>c.costRatio))});
}
const features=decisions.filter(d=>['lean','helper'].includes(d.profile)&&d.eligible).map(d=>d.profile);
const presentation=decisions.filter(d=>['recipe','feedback'].includes(d.profile)&&d.eligible).sort((a,b)=>a.meanCostRatio-b.meanCostRatio)[0];if(presentation)features.push(presentation.profile);
const result={version:'060-v1',selectedAt:new Date().toISOString(),developmentCells:60,features,decisions,rule:'Eligibility gates and combination limit were frozen in matrix.json. Among eligible recipe/feedback profiles, selection uses the lower average model-normalized mean cost; this precise tie-break is a development choice before confirmation.',caveat:'Six reused definitions per model/arm are development evidence; feedback with no compilation rejection has no activated treatment and cannot establish a feedback benefit.'};
await writeFile(join(out,'selection.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
