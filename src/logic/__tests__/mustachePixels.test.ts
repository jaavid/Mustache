import {describe,expect,it} from 'vitest';
import {decodeMustache,MUSTACHE_WIDTH,MUSTACHE_HEIGHT,MUSTACHE_NAMES} from '../mustachePixels';
describe('approved moustache silhouettes',()=>{
  it('decodes all three complete 2-bit textures',()=>{
    for(let i=0;i<MUSTACHE_NAMES.length;i++){
      const p=decodeMustache(i);
      expect(p).toHaveLength(MUSTACHE_WIDTH*MUSTACHE_HEIGHT);
      expect(Math.max(...p)).toBeLessThanOrEqual(3);
      expect(p.some(v=>v>1)).toBe(true);
    }
  });
  it('provides distinct shapes, not duplicates',()=>{
    const signatures=[0,1,2].map(i=>Array.from(decodeMustache(i),n=>n?'1':'0').join(''));
    expect(new Set(signatures).size).toBe(3);
  });
  it('rejects invalid styles',()=>expect(()=>decodeMustache(3)).toThrow(RangeError));
});
