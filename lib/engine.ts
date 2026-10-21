export type Player={id:string;alias:string;club:string};
export type Kind='xtreme'|'burst'|'over'|'spin'|'penalty'|'warning';
export type Event={kind:Kind;side:0|1};
export type Result={a:string;b:string;events:Event[];date:string};
export type Rules={xtreme:number;burst:number;over:number;spin:number;penalty:number;win:number;loss:number;participation:number};
export type Competition={id:string;name:string;type:'league'|'tournament';status:'active'|'completed'|'archived';rounds:number;target:number;playerIds:string[];rules:Rules;results:Record<string,Result>;createdAt:string};
export type State={version:1;players:Player[];competitions:Competition[]};
export type Match={id:string;a:string|null;b:string|null;round:number;ready:boolean;resolved:boolean;automatic:boolean;winner:string|null;result?:Result};
export const DEFAULT_RULES:Rules={xtreme:3,burst:2,over:2,spin:1,penalty:1,win:0,loss:0,participation:0};
export const labels:Record<keyof Rules,string>={xtreme:'Xtreme finish',burst:'Burst finish',over:'Over finish',spin:'Spin finish',penalty:'Penalización',win:'Bonus por victoria',loss:'Bonus por derrota',participation:'Por participación'};
export const emptyState=():State=>({version:1,players:[],competitions:[]});
export const uid=()=>crypto.randomUUID();
export function scoreEvents(events:Event[],target:number){
 const score=[0,0],warnings=[0,0],finishes=[{xtreme:0,burst:0,over:0,spin:0,penalty:0},{xtreme:0,burst:0,over:0,spin:0,penalty:0}];let battles=1;
 for(const e of events){if(score.some(s=>s>=target))break;const rival=1-e.side;
 if(e.kind==='warning'){warnings[e.side]++;if(warnings[e.side]===2){score[rival]++;finishes[e.side].penalty++;warnings[0]=warnings[1]=0;}continue;}
 if(e.kind==='penalty'){score[rival]++;finishes[e.side].penalty++;}else{score[e.side]+=DEFAULT_RULES[e.kind];finishes[e.side][e.kind]++;battles++;}warnings[0]=warnings[1]=0;
 }
 return {score,warnings,finishes,battles,finished:score.some(s=>s>=target),winner:score[0]>=target?0:score[1]>=target?1:null};
}
export function matches(c:Competition):Match[]{
 if(c.type==='league'){
 const out:Match[]=[];
 for(let r=0;r<c.rounds;r++)for(let i=0;i<c.playerIds.length;i++)for(let j=i+1;j<c.playerIds.length;j++){
 const a=c.playerIds[r===0?i:j],b=c.playerIds[r===0?j:i],id=`${a}:${b}`,result=c.results[id];const s=result&&scoreEvents(result.events,c.target);
 out.push({id,a,b,round:r,ready:true,automatic:false,resolved:!!s?.finished,winner:s?.finished?(s.winner===0?a:b):null,result});}return out;
 }
 let size=2;while(size<c.playerIds.length)size*=2;let seeds=[1,2];for(let n=4;n<=size;n*=2)seeds=seeds.flatMap(s=>[s,n+1-s]);
 const all:Match[]=[];let sources=seeds.map(s=>({player:c.playerIds[s-1]||null,resolved:true}));
 for(let round=0;sources.length>1;round++){
 const next:{player:string|null;resolved:boolean}[]=[];
 for(let i=0;i<sources.length;i+=2){const a=sources[i].player,b=sources[i+1].player,id=`r${round}m${i/2}`;
 const available=sources[i].resolved&&sources[i+1].resolved,automatic=available&&(!a||!b),ready=available&&!!a&&!!b;
 const raw=c.results[id],result=ready&&raw?.a===a&&raw?.b===b?raw:undefined,s=result&&scoreEvents(result.events,c.target);
 const resolved=automatic||!!s?.finished,winner=automatic?(a||b):s?.finished?(s.winner===0?a:b):null;
 const m={id,a,b,round,ready,automatic,resolved,winner,result};all.push(m);next.push({player:winner,resolved});}sources=next;
 }return all;
}
export function clearDescendants(c:Competition,id:string){if(c.type!=='tournament')return;const m=/^r(\d+)m(\d+)$/.exec(id);if(!m)return;let r=+m[1],i=+m[2];for(r++;r<7;r++){i=Math.floor(i/2);delete c.results[`r${r}m${i}`];}}
export function saveResult(c:Competition,id:string,events:Event[]){const m=matches(c).find(m=>m.id===id);if(!m?.ready||!m.a||!m.b)throw Error('Este enfrentamiento no está disponible.');if(!scoreEvents(events,c.target).finished)throw Error('Termina el combate antes de guardarlo.');clearDescendants(c,id);c.results[id]={a:m.a,b:m.b,events:structuredClone(events),date:new Date().toISOString()};}
export function deleteResult(c:Competition,id:string){clearDescendants(c,id);delete c.results[id];}
export function standings(c:Competition,players:Player[]){
 const rows=c.playerIds.map(id=>({id,alias:players.find(p=>p.id===id)?.alias||'Jugador',played:0,wins:0,losses:0,for:0,against:0,points:0,stage:0,champion:false}));const by=new Map(rows.map(r=>[r.id,r]));
 for(const m of matches(c)){if(m.automatic){if(m.winner)by.get(m.winner)!.stage=Math.max(by.get(m.winner)!.stage,m.round+1);continue;}if(!m.result||!m.resolved)continue;
 const s=scoreEvents(m.result.events,c.target);for(const [i,id] of [m.a,m.b].entries()){const r=by.get(id!)!;if(!r)continue;r.played++;r.for+=s.score[i];r.against+=s.score[1-i];r.stage=Math.max(r.stage,m.round);const win=m.winner===id;r.wins+=+win;r.losses+=+!win;
 const f=s.finishes[i];r.points+=f.xtreme*c.rules.xtreme+f.burst*c.rules.burst+f.over*c.rules.over+f.spin*c.rules.spin+s.finishes[1-i].penalty*c.rules.penalty+(win?c.rules.win:c.rules.loss)+c.rules.participation;
 if(win)r.stage=Math.max(r.stage,m.round+1);}}
 if(c.type==='tournament'){const final=matches(c).at(-1);if(final?.winner)by.get(final.winner)!.champion=true;}
 return rows.sort((a,b)=>c.type==='tournament'?(+b.champion-+a.champion||b.stage-a.stage||b.points-a.points||b.wins-a.wins||a.alias.localeCompare(b.alias)):(b.points-a.points||b.wins-a.wins||(b.for-b.against)-(a.for-a.against)||a.alias.localeCompare(b.alias)));
}
export function validateState(input:unknown):State{
 const s=input as State;if(!s||s.version!==1||!Array.isArray(s.players)||s.players.length>512||!Array.isArray(s.competitions)||s.competitions.length>100)throw Error('Copia EBC no válida.');
 const text=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
 const ids=new Set<string>();for(const p of s.players){if(!text(p.id,80)||!(/^[\w-]+$/).test(p.id)||ids.has(p.id)||!text(p.alias,40)||typeof p.club!=='string'||p.club.length>60)throw Error('Jugador no válido.');ids.add(p.id);}
 const comps=new Set();for(const c of s.competitions){if(!text(c.id,80)||comps.has(c.id)||!text(c.name,80)||!['league','tournament'].includes(c.type)||!['active','completed','archived'].includes(c.status)||![1,2].includes(c.rounds)||!Number.isInteger(c.target)||c.target<3||c.target>20||!Array.isArray(c.playerIds)||c.playerIds.length<2||c.playerIds.length>64||new Set(c.playerIds).size!==c.playerIds.length||c.playerIds.some(id=>!ids.has(id)))throw Error('Competición no válida.');comps.add(c.id);
 for(const k of Object.keys(DEFAULT_RULES) as (keyof Rules)[])if(!Number.isInteger(c.rules?.[k])||c.rules[k]<0||c.rules[k]>100)throw Error('Puntuación no válida.');
 if(!c.results||Array.isArray(c.results)||typeof c.results!=='object'||Object.keys(c.results).length>4096)throw Error('Resultados no válidos.');
 for(const [id,r] of Object.entries(c.results)){if(!ids.has(r.a)||!ids.has(r.b)||!Array.isArray(r.events)||!r.events.length||r.events.length>200)throw Error('Resultado no válido.');
 for(let i=0;i<r.events.length;i++){const e=r.events[i];if(![0,1].includes(e.side)||!['xtreme','burst','over','spin','penalty','warning'].includes(e.kind)||scoreEvents(r.events.slice(0,i),c.target).finished)throw Error('Jugada no válida.');}if(!scoreEvents(r.events,c.target).finished)throw Error('Combate incompleto.');
 }
 const computed=new Map(matches(c).map(m=>[m.id,m]));
 for(const [id,r] of Object.entries(c.results)){const m=computed.get(id);if(!m||!m.ready||m.a!==r.a||m.b!==r.b)throw Error('Bracket incoherente.');}
 }return structuredClone(s);
}
