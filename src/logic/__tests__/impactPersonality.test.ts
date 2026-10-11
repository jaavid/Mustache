import {describe,expect,it} from 'vitest';
import {impactCharacter,impactPlan,closestTree} from '../impactPersonality';
describe('visual-only mustache style impact',()=>{
 it('gives three recognizable impact patterns, independent of points',()=>{
  expect([0,1,2].map(impactCharacter)).toEqual(['snap','twirl','heavy']);
  const plans=[0,1,2].map(s=>impactPlan(s,'perfect'));
  expect(plans[0].startScale).toBeLessThan(plans[2].startScale);
  expect(plans[1].peakScale).toBeGreaterThan(plans[0].peakScale);
  expect(plans.every(p=>p.durationMs>0&&p.durationMs<250)).toBe(true);
 });
 it('uses gentler pops for GOOD',()=>{
  for(const style of [0,1,2])expect(impactPlan(style,'good').peakScale).toBeLessThan(impactPlan(style,'perfect').peakScale);
 });
 it('selects visually nearest trunk for missed stickers',()=>{
  expect(closestTree(195,[100,300,500])).toBe(100);
  expect(closestTree(480,[100,300,500])).toBe(500);
  expect(()=>closestTree(1,[])).toThrow(RangeError);
 });
});
