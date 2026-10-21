"""One-shot live API checks; prints only test account IDs, never passwords or tokens."""
import urllib.request, urllib.error, json, re, secrets
from pathlib import Path
config=Path('lib/supabase-config.ts').read_text()
base=re.search(r'SUPABASE_URL=(".*?")',config)[1]; base=json.loads(base)
key=json.loads(re.search(r'SUPABASE_KEY=(".*?")',config)[1])
users=[]
def call(path,body=None,token=None,method=None):
 headers={'apikey':key,'Content-Type':'application/json'}
 if token:headers['Authorization']='Bearer '+token
 req=urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method or ('POST' if body is not None else 'GET'))
 try:
  with urllib.request.urlopen(req,timeout=25) as r:
   raw=r.read();return r.status,json.loads(raw) if raw else None
 except urllib.error.HTTPError as e:return e.code,json.load(e)
for n in range(2):
 username='ebc_qa_'+secrets.token_hex(6);password=secrets.token_urlsafe(25)
 status,data=call('/functions/v1/ebc-register',{'username':username,'password':password})
 assert status==200,('register',status,data)
 status,session=call('/auth/v1/token?grant_type=password',{'email':username+'@ebc.invalid','password':password})
 assert status==200,('login',status)
 print('PASS: registration and login for QA account '+str(n+1),flush=True)
 users.append({'id':session['user']['id'],'token':session['access_token'],'refresh':session['refresh_token']})
s={'version':1,'players':[],'competitions':[]}
a,b=users
status,revision=call('/rest/v1/rpc/ebc_save_state',{'p_expected_revision':0,'p_state':s},a['token']);assert status==200 and revision==1,('save',status,revision)
status,rows=call('/rest/v1/ebc_states?select=state,revision',token=a['token']);assert status==200 and rows[0]['state']==s
status,rows=call('/rest/v1/ebc_states?select=owner_id',token=b['token']);assert status==200 and rows==[],('isolation',status)
status,rows=call('/rest/v1/ebc_states?select=owner_id');assert status in (401,403),('anonymous',status)
status,result=call('/rest/v1/rpc/ebc_save_state',{'p_expected_revision':0,'p_state':s},a['token']);assert status==400 and 'EBC_CONFLICT' in str(result),('conflict',status,result)
status,result=call('/rest/v1/ebc_states?owner_id=eq.'+a['id'],{'state':{'changed':True}},b['token'],'PATCH');assert status in (200,204)
status,rows=call('/rest/v1/ebc_states?select=state',token=a['token']);assert rows[0]['state']==s
status,refreshed=call('/auth/v1/token?grant_type=refresh_token',{'refresh_token':a['refresh']});assert status==200 and refreshed['access_token']
print(json.dumps({'pass':['registration','password login','save/read','organizer isolation','anonymous denied','revision conflict','cross-account update denied','session refresh'],'cleanup_user_ids':[u['id'] for u in users]}))
