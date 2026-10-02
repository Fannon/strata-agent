"""Model-free grader controls. Oracle values remain private and never reach an agent."""
import argparse,json,os
from pathlib import Path
from state import changed_models

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--root',required=True);args=parser.parse_args()
 root=Path(args.root).resolve();os.environ['APPWORLD_ROOT']=str(root);os.environ['APPWORLD_CACHE']=str(root/'cache')
 from appworld import AppWorld
 from appworld.environment import AppWorldServers
 from appworld.collections.models import ModelCollection
 with AppWorldServers(experiment_name='study065_grader_controls',remote_apis_port='{port}') as servers:
  with AppWorld(task_id='6bdbc26_1',**servers.defaults) as world:
   # Deliberate impossible numeric answer, independently checked by upstream.
   world.apis.supervisor.complete_task(answer='-99999999');world.save()
   wrong=world.evaluate();assert wrong.failures
  # One evaluation per fresh world, as in the campaign. Do not reuse upstream
  # cached end-state models across multiple saves/evaluations of a world.
  with AppWorld(task_id='6bdbc26_1',**servers.defaults) as world:
   world.apis.supervisor.complete_task(answer=world.task.ground_truth.answer);world.save()
   correct=world.evaluate();assert not correct.failures and correct.passes and world.task_completed()
   end=ModelCollection.load(to_db_home_path=':memory:study065_controls_end',from_db_home_path=world.output_db_home_path_on_disk,load_apps=world.task.allowed_apps)
   assert not changed_models(world.task.model_collection,end)
   # Destroy one record in the isolated grading copy, never in reference inputs.
   end.reset_db_home_path();songs=end.spotify.Song;assert songs.count()>0
   songs.db.connection.execute('DELETE FROM songs WHERE id = (SELECT id FROM songs LIMIT 1)');songs.db.connection.commit()
   assert 'spotify.Song' in changed_models(world.task.model_collection,end)
 print(json.dumps({'wrongAnswerRejected':True,'oracleAnswerAccepted':True,'unchangedStateAccepted':True,'domainMutationRejected':True,'paidCalls':0}))
if __name__=='__main__':main()
