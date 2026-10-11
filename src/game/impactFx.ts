import Phaser from 'phaser';
import type {Grade,AimPoint} from '../logic/scoring';
import {impactPlan,treeAtImpact,type TrunkBounds} from '../logic/impactPersonality';
import {burstLeaves} from './ambience';

/** Bounce the visual sticker at the actual landing coordinate.
 * A rotation offset is stored separately so scene.update follows hero rotation
 * without erasing the twirl animation or teleporting the sticker to the mouth.
 */
export function attachMustache(
 scene:Phaser.Scene,sticker:Phaser.GameObjects.Image,style:number,grade:Grade,
):void {
 const plan=impactPlan(style,grade);
 scene.tweens.killTweensOf(sticker);
 const baseX=sticker.scaleX,baseY=sticker.scaleY;
 const twist={offset:plan.rotation};
 sticker.setData('impactTwist',twist);
 sticker.setScale(baseX*plan.startScale,baseY*plan.startScale);
 scene.tweens.add({targets:twist,offset:0,duration:plan.durationMs,ease:'Cubic.easeOut'});
 scene.tweens.add({
   targets:sticker,scaleX:baseX*plan.peakScale,scaleY:baseY*plan.peakScale,
   duration:plan.durationMs,ease:'Back.easeOut',
   onComplete:()=>{
    if(!sticker.active)return;
    scene.tweens.add({targets:sticker,scaleX:baseX,scaleY:baseY,
     duration:95,ease:'Sine.easeInOut'});
   },
 });
}

/** Never pull a missed shot sideways to a tree. Only physically overlapping
 * the bark makes it stick; all other misses tumble from the real impact point.
 */
export function resolveMissImpact(
 scene:Phaser.Scene,texture:string,aim:AimPoint,
 trees:TrunkBounds,width:number,height:number,
):void {
 const bark=treeAtImpact(aim,trees);
 const item=scene.add.image(aim.x,aim.y,texture)
  .setDisplaySize(width,height).setDepth(50).setTint(0xffbbc3).setAlpha(.95);
 if(bark!==null){
   scene.tweens.add({
     targets:item,angle:aim.x<bark?-14:14,scaleX:item.scaleX*.84,scaleY:item.scaleY*.84,
     duration:105,ease:'Sine.easeOut',
     onComplete:()=>{
       if(!item.active)return;
       burstLeaves(scene,aim.x,aim.y,4);
       scene.tweens.add({targets:item,y:aim.y+24,alpha:0,angle:item.angle+20,
        duration:260,delay:290,ease:'Quad.easeIn',onComplete:()=>item.destroy()});
     },
   });
 }else {
   // Air/cheek/ground miss: the mustache falls away, never snaps to another tree.
   scene.tweens.add({targets:item,y:aim.y+76,x:aim.x+22,
     angle:90,alpha:0,scaleX:item.scaleX*.55,scaleY:item.scaleY*.55,
     duration:520,ease:'Quad.easeIn',onComplete:()=>item.destroy()});
 }
}

/** Brief mark at real landing center. GOOD also shows ideal lip center. */
export function showLandingPrecision(
 scene:Phaser.Scene,aim:AimPoint,lip:AimPoint,grade:Grade,
):void {
 const g=scene.add.graphics().setDepth(107);
 const color=grade==='perfect'?0xffdc85:grade==='good'?0xaaf4c4:0xff919c;
 g.lineStyle(3,color,.98);
 g.strokeCircle(aim.x,aim.y,9);
 g.lineBetween(aim.x-14,aim.y,aim.x-7,aim.y);
 g.lineBetween(aim.x+7,aim.y,aim.x+14,aim.y);
 g.lineBetween(aim.x,aim.y-14,aim.x,aim.y-7);
 g.lineBetween(aim.x,aim.y+7,aim.x,aim.y+14);
 if(grade==='good'){
   g.lineStyle(1,0xffe3a0,.85);
   g.strokeCircle(lip.x,lip.y,5);
   g.lineBetween(aim.x,aim.y,lip.x,lip.y);
 }
 scene.tweens.add({targets:g,alpha:0,duration:430,delay:130,
  onComplete:()=>g.destroy()});
}
