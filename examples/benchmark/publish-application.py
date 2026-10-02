"""Publish aggregate 065 evidence; never read prompts, schemas, answers or databases."""
import argparse,hashlib,json,random,statistics
from pathlib import Path

REPO=Path(__file__).resolve().parents[2]
TOTALS=['requests','completedRequests','toolCalls','capabilityCalls','capabilityAttempts',
        'inputTokens','outputTokens','cacheReadTokens','cacheWriteTokens','reportedTokens',
        'compileErrors','diagnostics','compileMs','validationFailures','policyFailures',
        'toolErrors','delivered']

def quantile(values,q):
 if not values:return None
 values=sorted(values);k=(len(values)-1)*q;a=int(k);b=min(a+1,len(values)-1)
 return values[a]+(values[b]-values[a])*(k-a)

def cost_bounds(cell):
 if cell['costUsd'] is not None:return [cell['costUsd']]*2
 return [cell['reconciliation']['costLowerUsd'],cell['reconciliation']['costUpperUsd']]

def summarize(cells):
 n=len(cells);success=sum(c['businessSuccess'] for c in cells)
 lower=sum(cost_bounds(c)[0] for c in cells);upper=sum(cost_bounds(c)[1] for c in cells)
 timed=[c for c in cells if not c.get('reconciliation',{}).get('timeUnavailable')]
 durations=[c['ms']/1000 for c in timed]
 reasoning=[c['reasoningTokens'] if c['requests'] else 0 for c in cells]
 return {
  'attempts':n,'distinctDefinitions':len({c['family'] for c in cells}),
  'distinctInstances':len({c['task'] for c in cells}),
  'answerCorrect':sum(c['answerCorrect'] for c in cells),
  'effectsCorrect':sum(c['effectsCorrect'] is True for c in cells),
  'businessSuccess':success,'strictSuccess':sum(c['strictSuccess'] for c in cells),
  'pureJson':sum(c['pureJson'] for c in cells),
  'matchesSubmission':sum(c['finalMatchesSubmission'] for c in cells),
  'healthy':sum(c['healthy'] for c in cells),
  'costBoundsUsd':[lower,upper],'costPerAttemptBounds':[lower/n,upper/n],
  'costPerSuccessBounds':[lower/success,upper/success] if success else None,
  'missingUsageAttempts':sum(not c['usageKnown'] for c in cells),
  'missingTimingAttempts':n-len(timed),
  'missingEffectGrades':sum(c['effectsCorrect'] is None for c in cells),
  'medianSeconds':statistics.median(durations) if timed else None,
  'p90Seconds':quantile(durations,.9),
  'medianAgentSeconds':statistics.median(c['agentMs']/1000 for c in timed) if timed else None,
  'meanObservedSeconds':statistics.mean(durations) if timed else None,
  'reasoningTokens':sum(reasoning) if all(r is not None for r in reasoning) else None,
  'totals':{k:sum(c[k] for c in cells) for k in TOTALS},
  'meanRequests':sum(c['requests'] for c in cells)/n,
  'meanReportedTokens':sum(c['reportedTokens'] for c in cells)/n,
 }

def comparisons(cells):
 results=[]
 for model in ['muse','glm']:
  blocks=[]
  for family in sorted({c['family'] for c in cells}):
   arms=[[c for c in cells if c['modelKey']==model and c['family']==family and c['profile']==p] for p in ['native','checked']]
   assert all(len(a)==3 for a in arms)
   blocks.append([[sum(cost_bounds(c)[i] for c in arm) for i in [0,1]] for arm in arms])
  assert len(blocks)==6
  rng=random.Random(6502);low=[];high=[]
  for _ in range(10000):
   sampled=rng.choices(blocks,k=6);denominator=sum(b[0][0] for b in sampled)
   low.append(sum(b[1][0] for b in sampled)/denominator)
   high.append(sum(b[1][1] for b in sampled)/denominator)
  native=sum(b[0][0] for b in blocks)
  results.append({'model':model,
   'checkedToNativeCostRatioBounds':[sum(b[1][i] for b in blocks)/native for i in [0,1]],
   'descriptiveTaskBlock95Bounds':[quantile(low,.025),quantile(high,.975)],
   'method':'10000 six-family bootstrap draws, sibling worlds kept together, seed 6502. Bounds include unreported-request cost uncertainty. Descriptive, not population inference.'})
 return results

def main():
 p=argparse.ArgumentParser();p.add_argument('--out',default=str(REPO/'.work/application-20261002-v2'));p.add_argument('--publish',action='store_true');args=p.parse_args()
 out=Path(args.out).resolve();matrix=json.loads((out/'matrix.json').read_text())
 cells=[json.loads((out/c['id']/'result.json').read_text()) for c in matrix['cells']]
 for cell in cells:
  if not cell.get('reconciliation'):continue
  recovered=json.loads((out/cell['id']/'recovered-grade.json').read_text())
  assert not cell['businessSuccess'] and not recovered['completed'] and recovered['effectsCorrect']
  for key in ['completed','passes','failures','effectsCorrect','changedModelCount']:cell[key]=recovered[key]
  cell.update(gradeError=None,gradeRecovery=recovered)
  cell['reconciliation'].update(originalFinalStateGradeUnavailable=True,finalStateGradeUnavailable=False)
 assert len(cells)==76
 evaluation=[c for c in cells if c['phase']=='evaluation'];assert len(evaluation)==72
 interrupted={c['task'] for c in cells if c.get('reconciliation')}
 rows=[{'model':m,'profile':p,**summarize([c for c in evaluation if c['modelKey']==m and c['profile']==p])} for m in ['muse','glm'] for p in ['native','checked']]
 for r in rows:assert r['attempts']==18 and r['distinctDefinitions']==6 and r['distinctInstances']==18
 lower=sum(cost_bounds(c)[0] for c in cells);upper=sum(cost_bounds(c)[1] for c in cells)
 assert upper<matrix['maxBatchCostUsd']
 source_labels={k if not k.startswith('/') else 'installed-pi/'+k.split('/pi-coding-agent/')[1]:v for k,v in matrix['sources'].items()}
 report={
  'version':matrix['version'],'date':'2026-10-02','sourceCommit':'c8d9acb',
  'piVersion':matrix['piVersion'],'appworldSource':matrix['appworldSource'],
  'models':matrix['models'],'evaluationAttempts':72,'developmentAttempts':4,
  'sampling':matrix['sampling'],'limits':matrix['limits'],
  'primaryScoring':matrix['scoring'],
  'strictScoring':'Additionally pure JSON and identical JSON serialization to the submitted answer. Primary AppWorld grading is preserved.',
  'tokenAccounting':'Input excludes cache; output includes reasoning. GLM checked totals are lower bounds for one unreported request. Reasoning is not added again.',
  'costAccounting':'Catalog estimates, not bills. One unreported GLM request is bounded by frozen request/output limits and rates. Interrupted cells retained, not replaced.',
  'timingAccounting':'Two suspended/interrupted attempt timings are unavailable. Timing summaries use observed timings and state missing counts; no complete all-attempt latency average for checked rows.',
  'calibration':summarize([c for c in cells if c['phase']=='dev']),
  'rows':rows,'comparisons':comparisons(evaluation),
  'sensitivity':{'excludedTaskInstances':sorted(interrupted),'reason':'Exclude the matched interrupted instance from both arms and both models; primary scores stay unchanged.',
   'rows':[{'model':m,'profile':p,**summarize([c for c in evaluation if c['modelKey']==m and c['profile']==p and c['task'] not in interrupted])} for m in ['muse','glm'] for p in ['native','checked']]},
  'familyRows':[{'model':m,'profile':p,'family':f,**summarize([c for c in evaluation if c['modelKey']==m and c['profile']==p and c['family']==f])} for m in ['muse','glm'] for p in ['native','checked'] for f in sorted({c['family'] for c in evaluation})],
  'totalCostBoundsUsd':[lower,upper],'totalRequests':sum(c['requests'] for c in cells),
  'matrixSha256':hashlib.sha256((out/'matrix.json').read_bytes()).hexdigest(),
  'sources':source_labels,'inputHashes':matrix['inputs'],
  'audit':json.loads((out/'audit.json').read_text()),'cells':cells,
 }
 # Error descriptions are not necessary evidence and could contain private values.
 for c in report['cells']:
  if c['gradeError']:c['gradeError']=c['gradeError'].split(':')[0]
 destination=REPO/'docs/evaluations/application-2026-10-02.json' if args.publish else out/'published-summary.json'
 destination.write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps({'rows':rows,'comparisons':report['comparisons'],'costBoundsUsd':[lower,upper],'requests':report['totalRequests']},indent=2))
if __name__=='__main__':main()
