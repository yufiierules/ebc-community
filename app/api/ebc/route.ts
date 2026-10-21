import { NextRequest, NextResponse } from 'next/server';
import { emptyState, validateState } from '@/lib/engine';
import { SUPABASE_URL as SB_URL, SUPABASE_KEY as KEY } from '@/lib/supabase-config';
export const dynamic='force-dynamic';
type SessionData={access_token:string;refresh_token:string;expires_in:number};
type AuthUser={id:string;email:string;user_metadata?:{username?:string}};
const response=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function call(path:string,token?:string,body?:unknown,method?:string){return fetch(SB_URL+path,{method:method||(body?'POST':'GET'),headers:{apikey:KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'});}
function cookies(r:NextResponse,s:{access_token:string;refresh_token:string;expires_in:number}){for(const [name,value,age] of [['ebc_access',s.access_token,s.expires_in],['ebc_refresh',s.refresh_token,60*60*24*30]] as const)r.cookies.set(name,value,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:age});return r;}
async function session(req:NextRequest){let token=req.cookies.get('ebc_access')?.value;let changed:SessionData|undefined;let user=token?await call('/auth/v1/user',token):null;
 if(!user?.ok){const refresh=req.cookies.get('ebc_refresh')?.value;if(!refresh)return null;const r=await call('/auth/v1/token?grant_type=refresh_token',undefined,{refresh_token:refresh});if(!r.ok)return null;changed=await r.json() as SessionData;token=changed.access_token;user=await call('/auth/v1/user',token);}
 if(!user?.ok)return null;return {token:token!,user:await user.json() as AuthUser,changed};}
export async function GET(req:NextRequest){try{const s=await session(req);if(!s)return response({error:'Inicia sesión para acceder.'},401);const r=await call('/rest/v1/ebc_states?select=state,revision',s.token);if(!r.ok)return response({error:'No se pudieron cargar los datos.'},502);const rows=await r.json() as {state:unknown;revision:number}[];const out=response({username:s.user.user_metadata?.username||s.user.email,state:rows[0]?.state||emptyState(),revision:rows[0]?.revision||0});return s.changed?cookies(out,s.changed):out;}catch{return response({error:'No hay conexión con el servidor. Inténtalo de nuevo.'},503)}}
export async function POST(req:NextRequest){try{
 const origin=req.headers.get('origin');if(!origin||new URL(origin).host!==new URL(req.url).host)return response({error:'Origen no permitido.'},403);
 if(Number(req.headers.get('content-length')||0)>2100000)return response({error:'Archivo demasiado grande.'},413);
 const raw=await req.text();if(raw.length>2100000)return response({error:'Archivo demasiado grande.'},413);const body=JSON.parse(raw);
 if(body.action==='login'||body.action==='register'){
 const username=String(body.username||'').trim().toLowerCase(),password=body.password;
 if(!/^[a-z0-9._-]{3,32}$/.test(username)||typeof password!=='string'||password.length>128)return response({error:'Usuario o contraseña no válidos.'},400);
 if(body.action==='register'){const reg=await call('/functions/v1/ebc-register',undefined,{username,password});if(!reg.ok){const d=await reg.json() as {error?:string};return response({error:d.error||'No se pudo crear la cuenta.'},reg.status);}}
 const r=await call('/auth/v1/token?grant_type=password',undefined,{email:username+'@ebc.invalid',password});if(!r.ok)return response({error:'Usuario o contraseña incorrectos. Si es tu primera vez, crea una cuenta.'},401);const data=await r.json() as SessionData;return cookies(response({ok:true}),data);
 }
 if(body.action==='logout'){const token=req.cookies.get('ebc_access')?.value;if(token)await call('/auth/v1/logout',token,{},'POST');const out=response({ok:true});out.cookies.delete('ebc_access');out.cookies.delete('ebc_refresh');return out;}
 const s=await session(req);if(!s)return response({error:'Tu sesión ha caducado. Vuelve a entrar.'},401);
 if(body.action==='save'){
 let state;try{state=validateState(body.state)}catch(e){return response({error:(e as Error).message},400)}
 if(!Number.isSafeInteger(body.revision)||body.revision<0)return response({error:'Revisión no válida.'},400);
 const r=await call('/rest/v1/rpc/ebc_save_state',s.token,{p_expected_revision:body.revision,p_state:state});if(!r.ok){const text=await r.text();return response({error:text.includes('EBC_CONFLICT')?'Los datos han cambiado en otra pestaña. Descarga tu copia y recarga la página.':'No se pudieron guardar los datos.'},text.includes('EBC_CONFLICT')?409:502)}
 const out=response({revision:await r.json()});return s.changed?cookies(out,s.changed):out;
 }return response({error:'Acción desconocida.'},400);
 }catch{return response({error:'No se pudo completar la solicitud.'},503)}}
