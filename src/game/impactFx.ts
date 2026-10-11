import Phaser from 'phaser';
import type {Grade} from '../logic/scoring';
import {closestTree, impactPlan} from '../logic/impactPersonality';
import {burstLeaves} from './ambience';

/** Animate the already mouth-anchored sticker, without touching Ramin's hit point. */
export function attachMustache(
 scene:Phaser.Scene,sticker:Phaser.GameObjects.Image,style:number,grade:Grade,
):void{
 const plan=impactPlan(style,grade);
 scene.tweens.killTweensOf(sticker);
 const baseX=sticker.scaleX,baseY=sticker.scaleY,rotation=sticker.rotation;
 sticker.setScale(baseX*plan.startScale,baseY*plan.startScale);
 sticker.setRotation(rotation+plan.rotation);
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

/** A missed shot skids away and harmlessly sticks to the nearest trunk for a beat.
 * This is only a visual after-impact effect; grades and combo have been resolved.
 */
export function missToTree(
 scene:Phaser.Scene,texture:string,aim:{x:number;y:number},
 centers:readonly number[],trunkY:number,width:number,height:number,
):void{
 const treeX=closestTree(aim.x,centers);
 const impactY=Phaser.Math.Clamp(aim.y,trunkY-78,trunkY+110);
 const stuck=scene.add.image(aim.x,aim.y,texture)
  .setDisplaySize(width,height).setDepth(50).setTint(0xf6a8af).setAlpha(.9);
 const direction=treeX<aim.x?-1:1;
 scene.tweens.add({
  targets:stuck,x:treeX+direction*9,y:impactY,angle:direction*24,
  scaleX:stuck.scaleX*.77,scaleY:stuck.scaleY*.77,
  duration:240,ease:'Quad.easeOut',
  onComplete:()=>{
   if(!stuck.active)return;
   burstLeaves(scene,stuck.x,stuck.y,4);
   scene.tweens.add({targets:stuck,alpha:0,angle:direction*38,
    duration:270,delay:280,onComplete:()=>stuck.destroy()});
  },
 });
}
