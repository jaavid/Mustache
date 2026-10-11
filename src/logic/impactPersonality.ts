import type {Grade} from './scoring';
export type ImpactCharacter='snap'|'twirl'|'heavy';
export function impactCharacter(style:number):ImpactCharacter{
  return style===1?'twirl':style===2?'heavy':'snap';
}
export type ImpactPlan=Readonly<{startScale:number;peakScale:number;durationMs:number;rotation:number}>;
/** Deterministic motion presets; never change score or aim windows based on mustache style. */
export function impactPlan(style:number,grade:Grade):ImpactPlan{
  const character=impactCharacter(style);
  const perfect=grade==='perfect';
  if(character==='twirl')return {startScale:.42,peakScale:perfect?1.38:1.20,durationMs:perfect?215:180,rotation:-.13};
  if(character==='heavy')return {startScale:.82,peakScale:perfect?1.12:1.07,durationMs:perfect?165:142,rotation:.07};
  return {startScale:.38,peakScale:perfect?1.28:1.14,durationMs:perfect?170:145,rotation:0};
}
export function closestTree(x:number,centers:readonly number[]):number{
  if(!centers.length)throw new RangeError('At least one tree required');
  return centers.reduce((best,next)=>Math.abs(next-x)<Math.abs(best-x)?next:best,centers[0]);
}
