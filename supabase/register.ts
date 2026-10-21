// Runs only in Supabase Edge Functions. Service credentials never leave this function.
declare const Deno: {env:{get:(key:string)=>string|undefined},serve:(f:(r:Request)=>Promise<Response>)=>void};
const url=Deno.env.get('SUPABASE_URL')!;
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async(req)=>{
 try{
  if(req.method!=='POST')return json({error:'Método no permitido'},405);
  if(Number(req.headers.get('content-length')||0)>2000)return json({error:'Solicitud demasiado grande'},413);
  const raw=await req.text(); if(raw.length>2000)return json({error:'Solicitud demasiado grande'},413);
  const {username,password}=JSON.parse(raw);
  if(typeof username!=='string'||!(/^[a-z0-9._-]{3,32}$/).test(username)||typeof password!=='string'||password.length<10||password.length>128)return json({error:'Usuario de 3–32 caracteres y contraseña de 10–128 caracteres.'},400);
  const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
  const budget=await fetch(url+'/rest/v1/rpc/ebc_signup_budget',{method:'POST',headers,body:JSON.stringify({p_bucket:new Date().toISOString().slice(0,13).replace(/[-T]/g,'')})});
  if(!budget.ok||await budget.json()!==true)return json({error:'Límite temporal de registros. Inténtalo más tarde.'},429);
  const created=await fetch(url+'/auth/v1/admin/users',{method:'POST',headers,body:JSON.stringify({email:username+'@ebc.invalid',password,email_confirm:true,user_metadata:{username}})});
  if(!created.ok)return json({error:'No se pudo crear la cuenta. Prueba otro usuario y una contraseña diferente.'},400);
  return json({ok:true});
 }catch{return json({error:'No se ha podido completar el registro.'},500)}
});
