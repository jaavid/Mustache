import { describe, expect, it } from 'vitest';
import {
  DESKTOP_TREE_CENTERS, MOBILE_TREE_CENTERS,
  DESKTOP_PEEK_DISTANCE, MOBILE_PEEK_DISTANCE,
  chooseSpawnSide, peekPosition,
} from '../treeGeometry';
describe('tree spawn lanes and occlusion geometry',()=>{
  it('uses inward-facing exits at the outer trees',()=>{
    for(const preferred of [-1,1] as const){
      expect(chooseSpawnSide(0,3,preferred)).toBe(1);
      expect(chooseSpawnSide(2,3,preferred)).toBe(-1);
      expect(chooseSpawnSide(1,3,preferred)).toBe(preferred);
    }
  });
  it('keeps all playable centers away from mobile side clipping',()=>{
    const [left,mid,right]=MOBILE_TREE_CENTERS;
    expect(peekPosition(left,1,MOBILE_PEEK_DISTANCE)).toBeGreaterThan(130);
    expect(peekPosition(right,-1,MOBILE_PEEK_DISTANCE)).toBeLessThan(410);
    expect(mid-left).toBeGreaterThan(150);
    expect(right-mid).toBeGreaterThan(150);
  });
  it('never places an active face inside an occluding trunk',()=>{
    for(const centers of [DESKTOP_TREE_CENTERS,MOBILE_TREE_CENTERS]){
      for(let index=0;index<centers.length;index++){
        const side=chooseSpawnSide(index,centers.length,1);
        const distance=centers===DESKTOP_TREE_CENTERS?DESKTOP_PEEK_DISTANCE:MOBILE_PEEK_DISTANCE;
        const x=peekPosition(centers[index],side,distance);
        expect(Math.abs(x-centers[index])).toBeGreaterThan(75);
      }
    }
  });
  it('rejects invalid spawn positions',()=>{
    expect(()=>chooseSpawnSide(3,3,1)).toThrow(RangeError);
    expect(()=>chooseSpawnSide(-1,3,1)).toThrow(RangeError);
  });
});
