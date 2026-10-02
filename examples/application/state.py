"""Independent domain-state grading from SQL rows, without upstream hash shortcuts."""
import hashlib,json

def fingerprints(collection):
 result={}
 collection.reset_db_home_path()
 for app,models in collection.items():
  for name,model in models.SQLModel.names_and_models():
   if name=='ModelHash' or (app=='supervisor' and name=='Task'):continue
   table=model.__tablename__;quoted='"'+table.replace('"','""')+'"'
   connection=models.SQLModel.db.connection
   columns=[r[1] for r in connection.execute('PRAGMA table_info('+quoted+')') if r[1]!='record_hash']
   if not columns:raise ValueError('Missing state table: '+app+'.'+name)
   selected=','.join('"'+c.replace('"','""')+'"' for c in columns)
   rows=[json.dumps(tuple(row),separators=(',',':'),default=lambda v: {'bytes':v.hex()}) for row in connection.execute('SELECT '+selected+' FROM '+quoted)]
   result[app+'.'+name]=hashlib.sha256(json.dumps([columns,sorted(rows)],separators=(',',':')).encode()).hexdigest()
 return result

def changed_models(start,end):
 before=fingerprints(start);after=fingerprints(end)
 return {name for name in before.keys()|after.keys() if before.get(name)!=after.get(name)}
