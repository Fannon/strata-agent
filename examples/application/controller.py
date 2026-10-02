"""065 fresh AppWorld cell. Only aggregate grades/state changes leave this controller.
Never reads solutions or uses task databases to solve; data comparison is post-run grading.
"""
from __future__ import annotations
import argparse,json,os,subprocess,traceback
from freezegun.api import real_perf_counter
from pathlib import Path
from state import changed_models

# Freezegun rewrites module globals, but leaves function defaults intact.
def clock(real_clock=real_perf_counter):return real_clock()

def main():
 p=argparse.ArgumentParser();p.add_argument('--config',required=True);args=p.parse_args()
 config_path=Path(args.config).resolve();c=json.loads(config_path.read_text());root=Path(c['root'])
 out=Path(c['out']);repo=Path(__file__).resolve().parents[2]
 if not out.is_relative_to(repo/'.work') or not root.is_relative_to(repo/'.work'):raise ValueError('Artifacts/root must stay ignored under .work')
 os.environ['APPWORLD_ROOT']=str(root);os.environ['APPWORLD_CACHE']=str(root/'cache')
 from appworld import AppWorld
 from appworld.environment import AppWorldServers
 from appworld.collections.models import ModelCollection
 experiment='study065_'+c['id'];start=clock();agent_exit=None;timed_out=False;grade_error=None;stage='agent'
 result={}
 with AppWorldServers(experiment_name=experiment,remote_apis_port='{port}') as servers:
  with AppWorld(task_id=c['task'],**servers.defaults) as world:
   c['remoteApisUrl']=str(servers.defaults['remote_apis_url'])
   prompt=world.task.instruction+'\nSubmit the requested answer through supervisor__complete_task. Finish with that same answer value as pure JSON, without commentary or an answer wrapper.'
   (out/'task-prompt.txt').write_text(prompt)
   config_path.write_text(json.dumps(c))
   env=dict(os.environ);env.update({'STRATA_APPLICATION_CONFIG':str(config_path),'PI_CODING_AGENT_DIR':c['profileDir'],'PI_OFFLINE':'1','PI_TELEMETRY':'0'})
   if c.get('scripted'):
    command=['bun',str(repo/'examples/application/model-free.ts'),'--config',str(config_path)]
   else:
    command=['bun',c['piCli'],'--offline','--provider','openrouter','--model',c['model'],'--thinking',c['thinking'],'--no-session','--no-extensions','--no-skills','--no-prompt-templates','--no-context-files','--no-builtin-tools','--mode','json','-e',str(repo/'examples/application/extension.ts'),'-p',prompt]
   agent_start=clock()
   with (out/'events.jsonl').open('wb') as stdout,(out/'stderr.txt').open('wb') as stderr:
    # Outer driver owns the entire controller/server/Pi process group.
    proc=subprocess.Popen(command,cwd=out,env=env,stdout=stdout,stderr=stderr)
    try:agent_exit=proc.wait(timeout=c['timeoutSeconds'])
    except subprocess.TimeoutExpired:
     timed_out=True;proc.terminate()
     try:agent_exit=proc.wait(timeout=5)
     except subprocess.TimeoutExpired:proc.kill();agent_exit=proc.wait()
   agent_ms=(clock()-agent_start)*1000
   try:
    stage='save';world.save();stage='evaluate';tracker=world.evaluate();stage='completion';completed=bool(world.task_completed())
    # Independent full-row check includes every app, beyond exposed tools. Only
    # supervisor task submission and internal record hashes are excluded.
    # Never materialize .db snapshots in task inputs: upstream prefers those to
    # .jsonl change logs, silently losing initial changes on later saved runs.
    stage='state-load';end=ModelCollection.load(to_db_home_path=f':memory:study065_{c["id"]}_grading',from_db_home_path=world.output_db_home_path_on_disk,load_apps=world.task.allowed_apps)
    stage='state-compare'
    changed=changed_models(world.task.model_collection,end)
    result={'completed':completed,'passes':len(tracker.passes),'failures':len(tracker.failures),'effectsCorrect':len(changed)==0,'changedModelCount':len(changed)}
   except Exception as exc:
    grade_error=f'{type(exc).__name__}: {exc}';(out/'grade-error.txt').write_text(traceback.format_exc())
 result.update({'agentExit':agent_exit,'timedOut':timed_out,'gradeError':grade_error,'gradeStage':stage,'agentMs':agent_ms,'elapsedMs':(clock()-start)*1000})
 (out/'grade.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));return 0 if grade_error is None else 1
if __name__=='__main__':raise SystemExit(main())
