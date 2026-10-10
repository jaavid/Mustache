import Phaser from 'phaser';
import { comboMilestone, phaseCaption, roundPhase, type RoundPhase } from '../logic/arcadePhases';

const PIXEL_FONT='"Courier New", monospace';

/** Reusable visual language for menu, play and results. Low-depth ornaments never block the lip. */
export function addArcadeAccents(scene:Phaser.Scene,portrait:boolean):void {
  const w=scene.scale.width,h=scene.scale.height;
  const g=scene.add.graphics().setDepth(59);
  const outer=portrait?10:15,corner=portrait?27:35;
  g.lineStyle(3,0x80619e,.66);
  for(const x of [outer,w-outer]){
    for(const y of [outer,h-outer]){
      const dx=x<w/2?1:-1,dy=y<h/2?1:-1;
      g.lineBetween(x,y,x+dx*corner,y);
      g.lineBetween(x,y,x,y+dy*corner);
    }
  }
}

/** Scene-owned layered fog, roaming leaves and light transitions: sunset -> twilight -> night. */
export function addLivingForest(scene:Phaser.Scene,portrait:boolean):(phase:RoundPhase)=>void{
  const w=scene.scale.width,h=scene.scale.height;
  const night=scene.add.rectangle(w/2,h/2,w,h,0x06172b,1).setDepth(-34).setAlpha(0);
  const warmth=scene.add.rectangle(w/2,h/2,w,h,0xfaa76d,1).setDepth(-33).setAlpha(.075);
  const farMist=scene.add.image(w/2,portrait?410:276,'mist')
    .setDepth(-24).setDisplaySize(w*1.23,portrait?190:95).setAlpha(.18).setTint(0xbddae0);
  const nearMist=scene.add.image(w/2,portrait?705:425,'mist')
    .setDepth(11).setDisplaySize(w*1.34,portrait?170:112).setAlpha(.09).setTint(0xd0b9eb);
  const reduceMotion=typeof window!=='undefined'&&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(!reduceMotion){
    scene.tweens.add({targets:farMist,x:w*.37,duration:9400,yoyo:true,repeat:-1,ease:'Sine.inOut'});
    scene.tweens.add({targets:nearMist,x:w*.63,duration:11500,yoyo:true,repeat:-1,ease:'Sine.inOut'});
    scene.time.addEvent({delay:1520,loop:true,callback:()=>{
      const leaf=scene.add.image(
        Phaser.Math.Between(0,w),Phaser.Math.Between(portrait?238:150,portrait?665:367),
        'leaf-'+Phaser.Math.Between(0,2)).setDepth(16).setAlpha(.68).setScale(1.15);
      scene.tweens.add({targets:leaf,
        x:leaf.x+Phaser.Math.Between(-65,85),y:leaf.y+Phaser.Math.Between(28,85),
        angle:Phaser.Math.Between(-90,90),alpha:0,
        duration:Phaser.Math.Between(2000,3300),onComplete:()=>leaf.destroy()});
    }});
  }
  let previous:RoundPhase|null=null;
  return phase=>{
    if(phase===previous)return;
    previous=phase;
    const alpha=phase==='WARMUP'?0:phase==='GROOVE'?.11:.25;
    scene.tweens.add({targets:night,alpha,duration:1450});
    scene.tweens.add({targets:warmth,alpha:phase==='WARMUP'?.075:phase==='GROOVE'?.037:0,duration:1450});
    scene.tweens.add({targets:farMist,alpha:phase==='FINALE'?.34:.19,duration:1500});
  };
}
export type PhaseHud={
  update:(secondsElapsed:number)=>void;
};
export function addPhaseHud(scene:Phaser.Scene,portrait:boolean,onPhase:(phase:RoundPhase)=>void):PhaseHud{
  const center=portrait?248:480;
  const top=portrait?201:138;
  const width=portrait?316:380;
  const background=scene.add.rectangle(center,top+18,width+6,14,0x152139,.97)
    .setStrokeStyle(2,0x634d78).setDepth(81);
  const fill=scene.add.rectangle(center-width/2,top+18,0,8,0xf2be82)
    .setOrigin(0,.5).setDepth(82);
  const marker=scene.add.text(center,top-4,'',{
    fontFamily:PIXEL_FONT,fontSize:portrait?'16px':'15px',fontStyle:'bold',
    color:'#ffe0a0',stroke:'#182033',strokeThickness:3,
  }).setOrigin(.5).setDepth(84);
  // Three slim ticks make the phase breaks legible without clutter.
  for(const point of [1/3,2/3]){
    scene.add.rectangle(center-width/2+point*width,top+18,3,14,0x1a263d).setDepth(83);
  }
  let phase:RoundPhase|null=null;
  const update=(elapsed:number)=>{
    const next=roundPhase(elapsed);
    fill.width=Math.max(1,width*Math.max(0,Math.min(1,elapsed/45)));
    if(phase!==next){
      phase=next;
      marker.setText(phaseCaption(next));
      marker.setColor(next==='FINALE'?'#ffaaa9':next==='GROOVE'?'#cbb7ff':'#ffe0a0');
      fill.setFillStyle(next==='FINALE'?0xff8c9d:next==='GROOVE'?0xbd9fff:0xffd08b);
      onPhase(next);
    }
  };
  background.setAlpha(.93);
  update(0);
  return {update};
}

export function announcePhase(scene:Phaser.Scene,portrait:boolean,phase:RoundPhase):void{
  if(phase==='WARMUP')return;
  const x=scene.scale.width/2,y=portrait?308:185;
  const headline=phase==='GROOVE'?'TWILIGHT TIME!':'FINAL 15 SECONDS!';
  const text=scene.add.text(x,y,headline,{
    fontFamily:PIXEL_FONT,fontSize:portrait?'28px':'26px',fontStyle:'bold',
    color:phase==='FINALE'?'#ffad8b':'#e3c2ff',
    stroke:'#142036',strokeThickness:5,
  }).setOrigin(.5).setDepth(110).setScale(.6);
  scene.tweens.add({targets:text,scale:1.05,alpha:0,y:y-40,
    duration:1350,ease:'Back.easeOut',onComplete:()=>text.destroy()});
}

export function celebrateCombo(scene:Phaser.Scene,portrait:boolean,combo:number):void{
  const title=comboMilestone(combo);
  if(!title)return;
  const x=scene.scale.width/2,y=portrait?322:177;
  const header=scene.add.text(x,y,title+'  ×'+combo,{
    fontFamily:PIXEL_FONT,fontSize:portrait?'27px':'29px',fontStyle:'bold',
    color:'#ffe59d',stroke:'#42265a',strokeThickness:6,
  }).setOrigin(.5).setDepth(110).setScale(.5);
  scene.tweens.add({targets:header,scale:1.07,y:y-32,alpha:0,
    duration:940,ease:'Back.easeOut',onComplete:()=>header.destroy()});
}

/** Expanding shockwave separate from sparkles and the short screen shake. */
export function impactRing(scene:Phaser.Scene,x:number,y:number,perfect:boolean):void{
  const circle=scene.add.circle(x,y,15,0xffffff,0).setDepth(99)
    .setStrokeStyle(perfect?5:3,perfect?0xffd88d:0xa9f3d0,.95);
  scene.tweens.add({targets:circle,
    scaleX:perfect?4.4:3.2,scaleY:perfect?4.4:3.2,alpha:0,
    duration:perfect?410:330,ease:'Cubic.easeOut',onComplete:()=>circle.destroy()});
}
/** Optional brief diegetic character taunts. Never block input or change hit geometry. */
export function raminMoment(scene:Phaser.Scene,hero:Phaser.GameObjects.Sprite,portrait:boolean):void{
  const sayings=['HEH!', '?!', 'PSST!', 'TRY ME!', 'OOPS!'];
  const x=Phaser.Math.Clamp(hero.x+(portrait?-72:84),portrait?70:70,scene.scale.width-70);
  const y=hero.y-(portrait?182:130);
  const txt=scene.add.text(x,y,sayings[Phaser.Math.Between(0,sayings.length-1)],{
    fontFamily:PIXEL_FONT,fontSize:portrait?'19px':'17px',fontStyle:'bold',
    color:'#ffe6ad',backgroundColor:'#263047',
    padding:{x:7,y:5},stroke:'#201b34',strokeThickness:2,
  }).setDepth(64).setOrigin(.5).setAlpha(0);
  scene.tweens.add({targets:txt,y:y-28,alpha:1,duration:190,yoyo:true,
    hold:340,onComplete:()=>txt.destroy()});
}
