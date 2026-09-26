import type { PracticeDelivery, PracticeLog } from '../../shared/pitch';
import { fail, textField } from '../http';
import type { Store } from '../store';
import { SCENARIOS } from './scenarios';

interface SavedRow { id:string; scenario_id:string; scenario_json:string; transcript:string; feedback:string; delivery_json:string|null; created_at:number; updated_at:number }
const readLog=(row:SavedRow):PracticeLog=>({id:row.id,scenarioId:row.scenario_id,scenario:JSON.parse(row.scenario_json),transcript:row.transcript,feedback:row.feedback,delivery:row.delivery_json?JSON.parse(row.delivery_json):null,createdAt:row.created_at,updatedAt:row.updated_at});
function entryId(value:unknown){const id=textField(value,'Practice ID',36);if(!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id))fail(400,'INVALID_PRACTICE','Choose a valid practice ID.');return id;}
function measurements(value:unknown):PracticeDelivery|null {
  if(value==null)return null;
  if(typeof value!=='object'||Array.isArray(value))fail(400,'INVALID_DELIVERY','Invalid recording measurements.');
  const d=value as Record<string,unknown>;
  for(const [key,max] of [['seconds',65],['samples',1000],['audiblePercent',100],['pauses',32],['levelRangeDb',120]] as const){
    if(key==='levelRangeDb'&&d[key]===null)continue;
    if(typeof d[key]!=='number'||!Number.isFinite(d[key])||d[key]<0||d[key]>max)fail(400,'INVALID_DELIVERY','Invalid recording measurements.');
  }
  return {seconds:d.seconds as number,samples:d.samples as number,audiblePercent:d.audiblePercent as number,pauses:d.pauses as number,levelRangeDb:d.levelRangeDb as number|null};
}
export async function practiceLogs(store:Store,playerId:string):Promise<PracticeLog[]> {
  const rows=(await store.sql('SELECT * FROM pitch_practice_logs WHERE player_id=? ORDER BY created_at DESC,id DESC LIMIT 50',playerId).all<SavedRow>()).results;
  return rows.map(readLog);
}
export async function savePractice(store:Store,playerId:string,body:Record<string,unknown>) {
  const id=entryId(body.id),scenario=SCENARIOS.find(s=>s.id===body.scenarioId);
  if(!scenario)fail(400,'INVALID_SCENARIO','Choose a practice scenario from the library.');
  const transcript=textField(body.transcript,'Response',6000),feedback=body.feedback===''||body.feedback===undefined?'':textField(body.feedback,'Feedback',2000),delivery=measurements(body.delivery),now=Date.now();
  await store.limit(`pitch-practice:${playerId}`,20);
  await store.sql(`INSERT INTO pitch_practice_logs(id,player_id,scenario_id,scenario_json,transcript,feedback,delivery_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)
    ON CONFLICT(player_id,id) DO UPDATE SET transcript=excluded.transcript,feedback=excluded.feedback,delivery_json=excluded.delivery_json,updated_at=excluded.updated_at
    WHERE pitch_practice_logs.scenario_id=excluded.scenario_id`,id,playerId,scenario.id,JSON.stringify(scenario),transcript,feedback,delivery?JSON.stringify(delivery):null,now,now).run();
  const row=(await store.sql('SELECT * FROM pitch_practice_logs WHERE player_id=? AND id=?',playerId,id).first<SavedRow>())!;
  if(row.scenario_id!==scenario.id)fail(409,'PRACTICE_CONFLICT','Start a new log for a different scenario.');
  return {practice:readLog(row)};
}
export async function deletePractice(store:Store,playerId:string,id:string) {
  entryId(id);
  await store.sql('DELETE FROM pitch_practice_logs WHERE player_id=? AND id=?',playerId,id).run();
  return {deleted:true};
}
