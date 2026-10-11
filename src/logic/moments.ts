import type { RaminVariant } from './variety';
export type SpawnMoment='glasses-adjust'|'serious'|'taunt';
export type RaminMoment=SpawnMoment|'touch'|'slip';
export const MOMENT_COOLDOWN_MS=4800;
/** All decisions are deterministic and testable. Timer is scene-time, so pausing does not advance the cooldown. */
export function momentReady(now:number,last:number):boolean {
  return Number.isFinite(now)&&now-last>=MOMENT_COOLDOWN_MS;
}
export function selectSpawnMoment(variant:RaminVariant,random:number,now:number,last:number):SpawnMoment|null{
  if(!momentReady(now,last))return null;
  const roll=Math.max(0,Math.min(.999999,random));
  if((variant==='sunglasses'||variant==='round')&&roll<.22)return 'glasses-adjust';
  if(roll<.10)return 'serious';
  if(roll<.20)return 'taunt';
  return null;
}
export function selectHitMoment(grade:'perfect'|'good'|'miss',combo:number,random:number,now:number,last:number):'touch'|null {
  return grade==='perfect'&&combo>=2&&random<.42&&momentReady(now,last)?'touch':null;
}
export function selectExitMoment(random:number,now:number,last:number):'slip'|null {
  return random<.13&&momentReady(now,last)?'slip':null;
}
