import type { PopPlan } from './gameplay';

export type RoundPhase = 'WARMUP' | 'GROOVE' | 'FINALE';
export const PHASE_SECONDS = [0,15,30] as const;

export type PhaseProfile = Readonly<{
  phase: RoundPhase;
  stage: 1 | 2 | 3;
  title: string;
  shortLabel: string;
  tempoBpm: number;
  minVisibleMs: number;
  maxVisibleMs: number;
  minEntryMs: number;
  pauseMs: number;
}>;

export const PHASE_PROFILES: Record<RoundPhase,PhaseProfile> = {
  WARMUP: {
    phase:'WARMUP',stage:1,title:'SUNSET · WARM-UP',shortLabel:'STAGE 1/3 · SUNSET',
    tempoBpm:112,minVisibleMs:1780,maxVisibleMs:2050,minEntryMs:325,pauseMs:335,
  },
  GROOVE: {
    phase:'GROOVE',stage:2,title:'TWILIGHT · KEEP MOVING',shortLabel:'STAGE 2/3 · TWILIGHT',
    tempoBpm:132,minVisibleMs:1260,maxVisibleMs:1510,minEntryMs:250,pauseMs:220,
  },
  FINALE: {
    phase:'FINALE',stage:3,title:'NIGHT RUSH · FINAL 15s',shortLabel:'STAGE 3/3 · NIGHT RUSH',
    tempoBpm:160,minVisibleMs:1050,maxVisibleMs:1190,minEntryMs:200,pauseMs:155,
  },
};

export function roundPhase(elapsed:number):RoundPhase {
  if(elapsed>=30)return 'FINALE';
  if(elapsed>=15)return 'GROOVE';
  return 'WARMUP';
}
export function phaseCaption(phase:RoundPhase):string {
  return PHASE_PROFILES[phase].shortLabel;
}

/** Explicit, visible difficulty bands, regardless of the spawn's motion type.
 * Every target is fully out of the tree for at least 1.05 seconds in the finale.
 */
export function tunePopPlan(plan:PopPlan,elapsed:number):PopPlan {
  const profile=PHASE_PROFILES[roundPhase(elapsed)];
  const desired=profile.phase==='WARMUP'?plan.visibleMs+350:
    profile.phase==='GROOVE'?plan.visibleMs+30:plan.visibleMs-80;
  return {
    ...plan,
    visibleMs:Math.round(Math.max(profile.minVisibleMs,Math.min(profile.maxVisibleMs,desired))),
    entryMs:Math.max(profile.minEntryMs,plan.entryMs+(profile.phase==='WARMUP'?55:profile.phase==='FINALE'?-35:0)),
    pauseMs:profile.pauseMs,
    exitMs:profile.phase==='FINALE'?Math.min(plan.exitMs,175):plan.exitMs,
  };
}
export function comboMilestone(combo:number):string|null {
  if(combo===3)return 'NICE STREAK!';
  if(combo===5)return 'ON FIRE!';
  if(combo===8)return 'UNSTOPPABLE!';
  if(combo>8&&combo%5===0)return 'STACHE MASTER!';
  return null;
}
