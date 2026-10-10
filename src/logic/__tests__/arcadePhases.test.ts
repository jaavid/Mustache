import {describe,expect,it} from 'vitest';
import {roundPhase,tunePopPlan,comboMilestone} from '../arcadePhases';
import {popPlan} from '../gameplay';
describe('three-stage round balance',()=>{
 it('switches phases exactly at 15 and 30 seconds',()=>{
  expect(roundPhase(0)).toBe('WARMUP');
  expect(roundPhase(14.999)).toBe('WARMUP');
  expect(roundPhase(15)).toBe('GROOVE');
  expect(roundPhase(29.9)).toBe('GROOVE');
  expect(roundPhase(30)).toBe('FINALE');
 });
 it('gives new players a longer window, never unfairly short ones',()=>{
  for(const roll of [.1,.5,.9]) {
   const base=popPlan(20,roll);
   const warm=tunePopPlan(base,2),middle=tunePopPlan(base,20),end=tunePopPlan(base,40);
   expect(warm.visibleMs).toBeGreaterThan(middle.visibleMs);
   expect(middle.visibleMs).toBeGreaterThan(end.visibleMs);
   expect(end.visibleMs).toBeGreaterThanOrEqual(990);
   expect(end.entryMs).toBeGreaterThanOrEqual(200);
   expect(end.pauseMs).toBeGreaterThanOrEqual(165);
   expect(base.visibleMs).toBe(popPlan(20,roll).visibleMs);
  }
 });
 it('only celebrates meaningful milestones',()=>{
  expect(comboMilestone(2)).toBe(null);
  expect(comboMilestone(3)).toContain('STREAK');
  expect(comboMilestone(5)).toContain('FIRE');
  expect(comboMilestone(8)).toContain('UNSTOPPABLE');
  expect(comboMilestone(10)).toContain('MASTER');
  expect(comboMilestone(11)).toBe(null);
 });
});
