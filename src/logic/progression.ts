import type { RoundSummary } from './roundStats';

export type MissionId='score'|'perfect'|'combo';
export type MissionResult={id:MissionId;title:string;current:number;target:number;done:boolean};
export type AchievementId='first'|'sharpshooter'|'combo-king'|'high-roller'|'flawless';
export type Achievement={id:AchievementId;title:string};

export function missionsForRound(stats:RoundSummary,score:number):MissionResult[] {
  const goals=[
    {id:'score',title:'SCORE HUNTER',current:score,target:500},
    {id:'perfect',title:'PERFECT TRIO',current:stats.perfect,target:3},
    {id:'combo',title:'COMBO x4',current:stats.maxCombo,target:4},
  ] as const;
  return goals.map(goal=>({...goal,done:goal.current>=goal.target}));
}
export function achievementsForRound(stats:RoundSummary,score:number):Achievement[] {
  const results:Achievement[]=[];
  if(stats.hits>=1)results.push({id:'first',title:'FIRST STACHE'});
  if(stats.perfect>=4&&stats.accuracy>=70)results.push({id:'sharpshooter',title:'SHARPSHOOTER'});
  if(stats.maxCombo>=5)results.push({id:'combo-king',title:'COMBO KING'});
  if(score>=1200)results.push({id:'high-roller',title:'HIGH ROLLER'});
  if(stats.shots>=5&&stats.misses===0)results.push({id:'flawless',title:'FLAWLESS RUN'});
  return results;
}
export const ACHIEVEMENT_KEY='n5-local-achievements-v1';
export function readAchievements():AchievementId[] {
  try{
    const value=JSON.parse(localStorage.getItem(ACHIEVEMENT_KEY)||'[]');
    const allowed=new Set<AchievementId>(['first','sharpshooter','combo-king','high-roller','flawless']);
    if(!Array.isArray(value))return [];
    return [...new Set(value.filter((x:unknown):x is AchievementId=>typeof x==='string'&&allowed.has(x as AchievementId)))];
  }catch{return [];}
}
export function storeNewAchievements(items:Achievement[]):Achievement[] {
  const current=new Set(readAchievements());
  const fresh=items.filter(item=>!current.has(item.id));
  for(const item of fresh)current.add(item.id);
  try{localStorage.setItem(ACHIEVEMENT_KEY,JSON.stringify([...current]));}catch{/* optional */}
  return fresh;
}
export function scoreShareText(score:number,stats:RoundSummary):string {
  return [
    'N5 MUSTACHE MAYHEM',
    'Score: '+Math.max(0,Math.floor(score))+' · '+stats.medal+' medal',
    'Accuracy: '+stats.accuracy+'% · Perfect: '+stats.perfect+' · Max combo: '+stats.maxCombo,
    'Can you beat me? https://mustache.alexa.ir/',
    '(Local practice score · not independently verified)',
  ].join('\n');
}
