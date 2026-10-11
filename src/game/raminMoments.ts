import Phaser from 'phaser';
import {selectExitMoment, selectHitMoment, selectSpawnMoment} from '../logic/moments';
import type {RaminVariant} from '../logic/variety';
import {raminLipPoint} from './ramin';

/** All character gags live in foreground-only overlays. The hero, lip point,
 * aim window and score calculation are not moved by these effects.
 */
export class RaminMomentController {
 private lastAt=-100000;
 private emote:Phaser.GameObjects.Image;
 private hand:Phaser.GameObjects.Image;
 private eyebrowMotion={shift:0,opacity:1};
 private glassesMotion={lift:0};
 private handMotion={x:45,y:37};
 constructor(
  private scene:Phaser.Scene,
  private hero:Phaser.GameObjects.Sprite,
  private glasses:Phaser.GameObjects.Image,
  private portrait:boolean,
 ) {
  this.emote=scene.add.image(-300,-300,'ramin-emote-serious').setDepth(24).setVisible(false);
  this.hand=scene.add.image(-300,-300,'ramin-emote-hand').setDepth(45).setVisible(false);
 }
 /** Reset only visual props. Do not reset cooldown on every appearance. */
 clear():void {
  this.scene.tweens.killTweensOf(this.eyebrowMotion);
  this.scene.tweens.killTweensOf(this.glassesMotion);
  this.scene.tweens.killTweensOf(this.handMotion);
  this.eyebrowMotion={shift:0,opacity:1};
  this.glassesMotion={lift:0};
  this.handMotion={x:45,y:37};
  this.emote.setVisible(false);
  this.hand.setVisible(false);
 }
 onSpawn(variant:RaminVariant):void{
  const kind=selectSpawnMoment(variant,Math.random(),this.scene.time.now,this.lastAt);
  if(!kind)return;
  this.lastAt=this.scene.time.now;
  if(kind==='glasses-adjust'){
   // This lift affects only the separate glasses texture, never the face.
   this.scene.tweens.add({targets:this.glassesMotion,lift:-17,
    duration:165,ease:'Cubic.easeOut',yoyo:true,hold:160});
   return;
  }
  this.emote.setTexture(kind==='serious'?'ramin-emote-serious':'ramin-emote-wink').setVisible(true);
  this.scene.tweens.add({targets:this.eyebrowMotion,shift:kind==='serious'?-4:4,
   duration:160,yoyo:true,repeat:1});
  this.scene.tweens.add({targets:this.eyebrowMotion,opacity:0,
   duration:220,delay:420,onComplete:()=>this.emote.setVisible(false)});
 }
 onHit(grade:'perfect'|'good'|'miss',combo:number):void{
  const kind=selectHitMoment(grade,combo,Math.random(),this.scene.time.now,this.lastAt);
  if(kind!=='touch')return;
  this.lastAt=this.scene.time.now;
  this.handMotion={x:45,y:37};
  this.hand.setVisible(true).setAlpha(1);
  this.scene.tweens.add({targets:this.handMotion,x:13,y:8,duration:170,ease:'Back.easeOut',
   onComplete:()=>{
    this.scene.tweens.add({targets:this.handMotion,x:46,y:41,
      duration:160,delay:90,ease:'Cubic.easeIn',onComplete:()=>this.hand.setVisible(false)});
   }});
 }
 shouldSlip():boolean{
  const kind=selectExitMoment(Math.random(),this.scene.time.now,this.lastAt);
  if(kind!=='slip')return false;
  this.lastAt=this.scene.time.now;
  const pos=raminLipPoint(this.hero);
  const dust=this.scene.add.image(pos.x,pos.y+this.hero.displayHeight*.38,'leaf-1')
   .setDepth(49).setScale(this.portrait?3.8:2.8).setAlpha(.9);
  this.scene.tweens.add({targets:dust,y:dust.y-12,x:dust.x+21,alpha:0,angle:110,
   duration:350,onComplete:()=>dust.destroy()});
  return true;
 }
 update():void{
  if(!this.hero.active)return;
  if(this.emote.visible){
   const rot=this.hero.rotation;
   const shift=this.eyebrowMotion.shift*this.hero.scaleY;
   this.emote.setPosition(this.hero.x-Math.sin(rot)*shift,this.hero.y+Math.cos(rot)*shift)
    .setRotation(rot).setScale(this.hero.scaleX,this.hero.scaleY)
    .setAlpha(this.eyebrowMotion.opacity*this.hero.alpha).setVisible(this.hero.visible);
  }
  const rot=this.hero.rotation,dy=this.glassesMotion.lift*this.hero.scaleY;
  // Called AFTER syncAccessory, preserving gesture position through bob/rotation.
  if(this.glasses.visible)this.glasses.setPosition(this.glasses.x-Math.sin(rot)*dy,this.glasses.y+Math.cos(rot)*dy);
  if(this.hand.visible){
   const lip=raminLipPoint(this.hero),s=this.portrait?1.4:1.08;
   const x=this.handMotion.x*this.hero.scaleX,y=this.handMotion.y*this.hero.scaleY;
   this.hand.setPosition(lip.x+x*Math.cos(rot)-y*Math.sin(rot),lip.y+x*Math.sin(rot)+y*Math.cos(rot))
    .setRotation(rot-.26).setScale(s).setAlpha(this.hero.alpha);
  }
 }
}
