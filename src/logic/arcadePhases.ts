import type { PopPlan } from './gameplay';
export type RoundPhase = 'WARMUP'|'GROOVE'|'FINALE';
export const PHASE_SECONDS=[0,15,30] as const;

export function roundPhase(elapsed:number):RoundPhase {
  if(elapsed>=30)return 'FINALE';
  if(elapsed>=15)return 'GROOVE';
  return 'WARMUP';
}
export function phaseCaption(phase:RoundPhase):string {
  return phase==='WARMUP'?'SUNSET · GET READY':
    phase==='GROOVE'?'TWILIGHT · KEEP IT GOING':'NIGHTFALL · FINAL RUSH';
}
export function tunePopPlan(plan:PopPlan,elapsed:number):PopPlan {
  const phase=roundPhase(elapsed);
  // First 15s offer generous aiming; later phases feel faster but remain fair.
  return {...plan,
    visibleMs:Math.max(990,plan.visibleMs+(phase==='WARMUP'?180:phase==='GROOVE'?35:-70)),
    entryMs:Math.max(200,plan.entryMs+(phase==='WARMUP'?35:phase==='FINALE'?-14:0)),
    pauseMs:Math.max(165,plan.pauseMs+(phase==='WARMUP'?65:phase==='FINALE'?-35:0)),
  };
}
export function comboMilestone(combo:number):string|null {
  if(combo===3)return 'NICE STREAK!';
  if(combo===5)return 'ON FIRE!';
  if(combo===8)return 'UNSTOPPABLE!';
  if(combo>8&&combo%5===0)return 'STACHE MASTER!';
  return null;
}
