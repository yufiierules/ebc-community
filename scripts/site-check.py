"""Live HTTP checks of the deployed Site. Creates one temporary organizer."""
import urllib.request, urllib.error, http.cookiejar, json, secrets, sys, base64
origin=sys.argv[1].rstrip('/')
jar=http.cookiejar.CookieJar();client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def parse(raw):
 if not raw:return None
 try:return json.loads(raw)
 except ValueError:return {'error':raw.decode(errors='replace')[:300]}
def call(body=None,forged=False):
 headers={'Content-Type':'application/json','User-Agent':'EBC-Integration-Check/1.0'}
 if body is not None:headers['Origin']='https://invalid.example' if forged else origin
 req=urllib.request.Request(origin+'/api/ebc',data=json.dumps(body).encode() if body is not None else None,headers=headers)
 try:
  with client.open(req,timeout=30) as r:
   raw=r.read();return r.status,parse(raw)
 except urllib.error.HTTPError as e:
  raw=e.read();return e.code,parse(raw)
status,data=call();assert status==401,('anonymous API',status,data)
username='ebc_qa_'+secrets.token_hex(6);password=secrets.token_urlsafe(25)
status,data=call({'action':'register','username':username,'password':password});assert status==200,('register through Site',status,data)
print('PASS: organizer registration through Site',flush=True)
access=next(c for c in jar if c.name=='ebc_access');assert access.secure and access.has_nonstandard_attr('HttpOnly')
segment=access.value.split('.')[1];claims=json.loads(base64.urlsafe_b64decode(segment+'='*(-len(segment)%4)))
print('QA_USER_ID='+claims['sub'],flush=True)
status,data=call();assert status==200 and data['username']==username and data['revision']==0
state={'version':1,'players':[{'id':'qap1','alias':'QA1','club':'EBC'},{'id':'qap2','alias':'QA2','club':'EBC'}],'competitions':[{'id':'qa_comp','name':'QA League','type':'league','status':'active','rounds':1,'target':4,'playerIds':['qap1','qap2'],'rules':{'xtreme':3,'burst':2,'over':2,'spin':1,'penalty':1,'win':3,'loss':0,'participation':0},'results':{'qap1:qap2':{'a':'qap1','b':'qap2','events':[{'kind':'xtreme','side':0},{'kind':'spin','side':0}],'date':'2026-10-20T00:00:00Z'}},'createdAt':'2026-10-20T00:00:00Z'}]}
status,data=call({'action':'save','revision':0,'state':state});assert status==200 and data['revision']==1,('save through Site',status,data)
status,data=call();assert status==200 and data['state']==state and data['revision']==1
status,data=call({'action':'save','revision':0,'state':state});assert status==409,('conflict through Site',status,data)
status,data=call({'action':'save','revision':1,'state':state},True);assert status==403,('CSRF origin',status)
status,data=call({'action':'logout'});assert status==200
status,data=call();assert status==401,('logout',status)
status,data=call({'action':'login','username':username,'password':password});assert status==200
status,data=call();assert status==200 and data['state']==state
call({'action':'logout'})
print('PASS: HttpOnly/Secure cookies, own state load, competition/result persistence, revision conflict, origin rejection, logout and repeat login.',flush=True)
