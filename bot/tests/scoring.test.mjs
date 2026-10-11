import test from 'node:test';
import assert from 'node:assert/strict';
import { mondayUtc, verifyRoundShots } from '../src/scoring.js';
import { issueSession, authenticate, startRound, finishRound, leaderboard } from '../src/sessions.js';

test('weekly boundaries are Monday 00:00 UTC, including year crossings', () => {
  assert.equal(new Date(mondayUtc(Date.UTC(2026,9,11))).toISOString(), '2026-10-05T00:00:00.000Z');
  assert.equal(new Date(mondayUtc(Date.UTC(2027,0,1))).toISOString(), '2026-12-28T00:00:00.000Z');
});

test('server recalculates shot points and combos', () => {
  const shots = [
    { tMs: 2500, aim: {x:289,y:280}, lip:{x:289,y:280}, variant:'normal', comboBefore:0 },
    { tMs: 4800, aim: {x:299,y:280}, lip:{x:289,y:280}, variant:'gold', comboBefore:1 },
    { tMs: 7200, aim: {x:200,y:410}, lip:{x:289,y:280}, variant:'normal', comboBefore:2 },
    { tMs: 9800, aim: {x:289,y:280}, lip:{x:289,y:280}, variant:'sunglasses', comboBefore:0 },
  ];
  assert.equal(verifyRoundShots(shots,false,385).score,385);
  assert.throws(() => verifyRoundShots(shots,false,99999),/SCORE_MISMATCH/);
  assert.throws(() => verifyRoundShots([...shots, shots[3]],false,385),/IMPOSSIBLE_SHOT_RATE/);
  assert.throws(() => verifyRoundShots([{...shots[0],lip:{x:289,y:1}}],false,100),/INVALID_TARGET/);
  assert.throws(() => verifyRoundShots([{...shots[0],comboBefore:9}],false,100),/INVALID_COMBO/);
});

test('server validates portrait target dimensions', () => {
  const shots = [{tMs:1000, aim:{x:174,y:540},lip:{x:174,y:540},variant:'sunglasses',comboBefore:0}];
  assert.equal(verifyRoundShots(shots,true,125).score,125);
  assert.throws(() => verifyRoundShots(shots,false,125),/INVALID_AIM/);
});

class MemoryD1 {
  constructor() { this.users=new Map(); this.sessions=new Map(); this.rounds=new Map(); }
  prepare(sql) {
    const db=this;
    return { bind(...args) {
      return {
        async run() {
          if(sql.startsWith('INSERT INTO game_rounds')) {
            const [id, token_hash, user_id, portrait, started_at, expires_at]=args;
            db.rounds.set(id, {id,token_hash,user_id,portrait,started_at,expires_at,score:null,week_start:null,telegram_synced:0});
            return {meta:{changes:1}};
          }
          if(sql.startsWith('UPDATE game_rounds SET score=')) {
            const [score, week_start, finished_at, id, token_hash, now] = args;
            const row=db.rounds.get(id);
            if(!row || row.token_hash!==token_hash || row.score!==null || row.expires_at<now) return {meta:{changes:0}};
            Object.assign(row,{score,week_start,finished_at});
            return {meta:{changes:1}};
          }
          return {meta:{changes:0}};
        },
        async first() {
          if(sql.startsWith('SELECT token_hash,')) {
            const [hash,now]=args,session=db.sessions.get(hash);
            return session?.expires_at>now?session:null;
          }
          if(sql.includes('FROM game_rounds WHERE id=? AND token_hash=?')) {
            const row=db.rounds.get(args[0]);
            return row?.token_hash===args[1]&&row?.user_id===args[2]?row:null;
          }
          if(sql.startsWith('SELECT score, week_start')) return db.rounds.get(args[0]) || null;
          return null;
        },
        async all() {
          const week=args[0];
          const best=new Map();
          for (const r of db.rounds.values()) if (r.week_start===week && r.score!==null) {
            best.set(r.user_id, Math.max(best.get(r.user_id)??0,r.score));
          }
          return {results:[...best].map(([user_id,score])=>({user_id,score,display_name:db.users.get(user_id)})).sort((a,b)=>b.score-a.score||a.user_id-b.user_id).slice(0,10)};
        },
      };
    }};
  }
  async batch(statements) { return statements.map(()=>({success:true})); }
}

test('sessions are callback-bound and round submission is idempotent', async () => {
  const db=new MemoryD1();
  const now=Date.UTC(2026,9,11,8);
  const callback={from:{id:123,first_name:'Player A'},message:{message_id:44,chat:{id:55}}};
  const url=await issueSession(db,callback,'https://mustache.alexa.ir/',now);
  const token=new URL(url).searchParams.get('tg_session');
  assert.match(token,/^[a-f0-9]{64}$/);
  // D1 session binding from the actual Telegram callback.
  const {sha256}=await import('../src/sessions.js');
  const hash=await sha256(token);
  db.sessions.set(hash,{token_hash:hash,user_id:123,chat_id:55,message_id:44,inline_message_id:null,expires_at:now+3600000});
  db.users.set(123,'Player A');
  const session=await authenticate(db,new Request('https://game.invalid',{headers:{authorization:'Bearer '+token}}),now);
  assert.equal(session.user_id,123);
  const started=await startRound(db,session,false,now);
  const shots=[{tMs:1000,aim:{x:289,y:280},lip:{x:289,y:280},variant:'normal',comboBefore:0}];
  const submitted=await finishRound(db,session,{roundId:started.roundId,score:100,shots},now+45000);
  assert.equal(submitted.score,100);
  const duplicate=await finishRound(db,session,{roundId:started.roundId,score:9000,shots:[]},now+47000);
  assert.equal(duplicate.score,100);
  assert.equal(duplicate.duplicate,true);
  assert.equal((await leaderboard(db,now+45000)).players[0].score,100);
  assert.equal(await authenticate(db,new Request('https://game.invalid',{headers:{authorization:'Bearer '+token}}),now+4000000),null);
});

test('abnormally short rounds are rejected', async () => {
  const db=new MemoryD1();
  const session={token_hash:'hash',user_id:1};
  const started=await startRound(db,session,false,1000);
  await assert.rejects(finishRound(db,session,{roundId:started.roundId,score:0,shots:[]},2000),/INVALID_ROUND_DURATION/);
});
