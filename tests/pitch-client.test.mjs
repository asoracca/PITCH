import test from 'node:test';
import assert from 'node:assert/strict';
import { PitchApi, PitchApiError } from '../build/client/pitch-api.js';

test('client exposes protected-host errors and does not erase a newer login on an old 401', async () => {
  const protectedClient=new PitchApi('',async()=>new Response('<html>Sign in</html>',{headers:{'content-type':'text/html'}}));
  await assert.rejects(protectedClient.config(),e=>e instanceof PitchApiError&&e.code==='HOST_SIGN_IN_REQUIRED');
  let finish;const client=new PitchApi('',()=>new Promise(resolve=>{finish=resolve;}));client.token='previous-session';
  const pending=client.me();client.token='new-session';finish(Response.json({error:{code:'SESSION_EXPIRED',message:'Sign in again'}},{status:401}));
  await assert.rejects(pending,e=>e instanceof PitchApiError&&e.status===401);assert.equal(client.token,'new-session');
  const oldApi=new PitchApi('',async()=>Response.json({apiVersion:'pitch.v0'}));
  await assert.rejects(oldApi.config(),e=>e.code==='API_VERSION_MISMATCH');
});

test('unmounting a queue screen cancels its request and suppresses late UI updates', async () => {
  let finish,signal;let updates=0,errors=0;
  const client=new PitchApi('',(_input,init)=>{signal=init.signal;return new Promise(resolve=>{finish=resolve;});});
  const stop=client.watchQueue({onUpdate:()=>updates++,onError:()=>errors++});
  stop();assert.equal(signal.aborted,true);
  finish(Response.json({status:'waiting',serverTime:Date.now()}));
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(updates,0);assert.equal(errors,0);
});

test('a waiting screen stops polling after a terminal queue state', async () => {
  let signal;
  const client=new PitchApi('',async(_input,init)=>{signal=init.signal;return Response.json({status:'expired',serverTime:Date.now(),message:'Try again'});});
  await new Promise((resolve,reject)=>{client.watchQueue({onUpdate:value=>{assert.equal(value.status,'expired');resolve();},onError:reject});});
  await new Promise(resolve=>setTimeout(resolve,0));assert.equal(signal.aborted,true);
});
