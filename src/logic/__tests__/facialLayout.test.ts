import {describe,expect,it} from 'vitest';
import {
 FACE_FRAME_INDEX,FACIAL_FRAME_HEIGHT,FACIAL_FRAME_WIDTH,FACE_PATCHES,
 facialPatchIsSafe,
} from '../facialLayout';

describe('complete Ramin expression frames',()=>{
 it('retains original four source frames and adds two unique expression frames',()=>{
  expect(FACE_FRAME_INDEX).toEqual({
   idle:0,blink:1,surprised:2,victory:3,wink:4,serious:5,
  });
  expect(FACIAL_FRAME_WIDTH).toBe(210);
  expect(FACIAL_FRAME_HEIGHT).toBe(362);
 });
 it('replaces eye and brow pixels only, preserving calibrated lip and dimensions',()=>{
  expect(facialPatchIsSafe(FACE_PATCHES.wink)).toBe(true);
  expect(facialPatchIsSafe(FACE_PATCHES.serious)).toBe(true);
  expect(FACE_PATCHES.wink.y).toBeGreaterThan(FACE_PATCHES.serious.y);
  expect(facialPatchIsSafe({x:0,y:134,width:20,height:20})).toBe(false);
 });
});
