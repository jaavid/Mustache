import Phaser from 'phaser';
import { comboMilestone, phaseCaption, roundPhase, type RoundPhase } from '../logic/arcadePhases';
import { raminLipPoint } from './ramin';

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

/** A visible 3-state light rig. It affects trees + character + foreground,
 * but lives behind the HUD and hit FX. Warm sunlight, violet dusk and
 * deep-blue night each have their own color wash and visible sky landmarks.
 */
export type ForestLighting = {
  setPhase: (phase: RoundPhase) => void;
  follow: (hero: Phaser.GameObjects.Sprite) => void;
};
export function addLivingForest(scene:Phaser.Scene,portrait:boolean):ForestLighting {
  const w=scene.scale.width,h=scene.scale.height;
  const reduceMotion=typeof window!=='undefined'&&!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // Depth 41 intentionally covers the trunk, Ramin and foreground. Previous
  // version dimmed only the distant forest (< tree depths) at <= 25% alpha.
  const sunlight=scene.add.rectangle(w/2,h/2,w,h,0xffb06b,1).setDepth(41).setAlpha(.17);
  const twilight=scene.add.rectangle(w/2,h/2,w,h,0x6553b4,1).setDepth(41.1).setAlpha(0);
  const midnight=scene.add.rectangle(w/2,h/2,w,h,0x05122e,1).setDepth(41.2).setAlpha(0);
  const skyX=portrait?w*.76:w*.82;
  const skyY=portrait?319:195;
  const sunHalo=scene.add.circle(skyX,skyY,portrait?62:57,0xffad70,.25).setDepth(42);
  const sun=scene.add.circle(skyX,skyY,portrait?30:27,0xffdf9c,.9).setDepth(43);
  // Moon and stars appear only at dusk/night, making the phase change visible
  // without waiting to notice a small numerical change in the timer.
  const moonHalo=scene.add.circle(skyX,skyY,portrait?60:56,0xaecaff,.20).setDepth(42).setAlpha(0);
  const moon=scene.add.circle(skyX,skyY,portrait?25:23,0xf1f2da,.95).setDepth(43).setAlpha(0);
  const stars:Phaser.GameObjects.Rectangle[]=[];
  for(let i=0;i<30;i++){
    const x=15+(i*109+23)%(w-30);
    const y=(portrait?275:155)+(i*47+17)%(portrait?145:93);
    // Avoid the moon itself and HUD/top controls.
    if(Math.hypot(x-skyX,y-skyY)<61)continue;
    const star=scene.add.rectangle(x,y,i%4===0?4:2,i%4===0?4:2,
      i%3===0?0xffe7a5:0xc0e6ff,.95).setDepth(43).setAlpha(0);
    stars.push(star);
    if(!reduceMotion)scene.tweens.add({
      targets:star,scale:1.7,duration:850+i*31,repeat:-1,yoyo:true,ease:'Sine.inOut',
    });
  }
  const farMist=scene.add.image(w/2,portrait?420:276,'mist')
    .setDepth(4).setDisplaySize(w*1.35,portrait?195:110).setAlpha(.11).setTint(0xffdfc8);
  const nearMist=scene.add.image(w/2,portrait?683:408,'mist')
    .setDepth(12).setDisplaySize(w*1.38,portrait?165:120).setAlpha(.11).setTint(0xe4b8c5);
  if(!reduceMotion){
    scene.tweens.add({targets:farMist,x:w*.38,duration:9200,yoyo:true,repeat:-1,ease:'Sine.inOut'});
    scene.tweens.add({targets:nearMist,x:w*.62,duration:11400,yoyo:true,repeat:-1,ease:'Sine.inOut'});
    scene.time.addEvent({delay:1330,loop:true,callback:()=>{
      const leaf=scene.add.image(
        Phaser.Math.Between(0,w),Phaser.Math.Between(portrait?335:166,portrait?670:365),
        'leaf-'+Phaser.Math.Between(0,2)).setDepth(16).setAlpha(.7).setScale(1.15);
      scene.tweens.add({targets:leaf,
        x:leaf.x+Phaser.Math.Between(-80,95),y:leaf.y+Phaser.Math.Between(35,95),
        angle:Phaser.Math.Between(-90,90),alpha:0,
        duration:Phaser.Math.Between(2000,3400),onComplete:()=>leaf.destroy()});
    }});
  }

  // A small additive face light restores lip contrast during the much
  // darker final stage. It does not change or obscure the aiming geometry.
  const key='n5-dynamic-face-light';
  if(!scene.textures.exists(key)){
    const texture=scene.textures.createCanvas(key,256,256);
    if(texture){
      const ctx=texture.getContext();
      const radius=ctx.createRadialGradient(128,128,6,128,128,126);
      radius.addColorStop(0,'rgba(255,238,202,.66)');
      radius.addColorStop(.35,'rgba(235,214,175,.26)');
      radius.addColorStop(1,'rgba(255,237,195,0)');
      ctx.fillStyle=radius;
      ctx.fillRect(0,0,256,256);
      texture.refresh();
    }
  }
  const faceLight=scene.add.image(-300,-300,key).setDepth(44)
    .setDisplaySize(portrait?225:186,portrait?225:186).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);

  const transition=(target:Phaser.GameObjects.GameObject & {alpha:number},alpha:number)=>{
    scene.tweens.add({targets:target,alpha,duration:1050,ease:'Sine.easeInOut'});
  };
  let previous:RoundPhase|null=null;
  const setPhase=(phase:RoundPhase)=>{
    if(phase===previous)return;
    previous=phase;
    transition(sunlight,phase==='WARMUP'?.17:0);
    transition(twilight,phase==='GROOVE'?.32:phase==='FINALE'?.17:0);
    transition(midnight,phase==='FINALE'?.43:0);
    transition(sunHalo,phase==='WARMUP'?.25:0);
    transition(sun,phase==='WARMUP'?.92:0);
    transition(moonHalo,phase==='FINALE'?.36:phase==='GROOVE'?.18:0);
    transition(moon,phase==='FINALE'?.98:phase==='GROOVE'?.52:0);
    transition(faceLight,phase==='FINALE'?.8:phase==='GROOVE'?.37:.12);
    scene.tweens.add({targets:farMist,alpha:phase==='FINALE'?.36:phase==='GROOVE'?.25:.11,
      duration:1100});
    scene.tweens.add({targets:nearMist,alpha:phase==='FINALE'?.28:phase==='GROOVE'?.19:.11,
      duration:1100});
    farMist.setTint(phase==='FINALE'?0xaccaff:phase==='GROOVE'?0xc7b6ff:0xffdfc8);
    nearMist.setTint(phase==='FINALE'?0x8ba9d5:phase==='GROOVE'?0xc8b4ee:0xe4b8c5);
    for(const star of stars)transition(star,phase==='FINALE'?.95:phase==='GROOVE'?.35:0);
  };
  const follow=(hero:Phaser.GameObjects.Sprite)=>{
    faceLight.setVisible(hero?.visible??false);
    if(!hero?.visible)return;
    const mouth=raminLipPoint(hero);
    faceLight.setPosition(mouth.x,mouth.y-13);
  };
  return {setPhase,follow};
}

export type PhaseHud={
  update:(secondsElapsed:number)=>void;
};
export function addPhaseHud(scene:Phaser.Scene,portrait:boolean,onPhase:(phase:RoundPhase)=>void):PhaseHud{
  const center=portrait?270:480;
  const top=portrait?201:138;
  const width=portrait?375:412;
  const background=scene.add.rectangle(center,top+18,width+6,14,0x152139,.97)
    .setStrokeStyle(2,0x634d78).setDepth(81);
  const fill=scene.add.rectangle(center-width/2,top+18,0,8,0xf2be82)
    .setOrigin(0,.5).setDepth(82);
  const marker=scene.add.text(center,top-4,'',{
    fontFamily:PIXEL_FONT,fontSize:portrait?'17px':'16px',fontStyle:'bold',
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
  const x=scene.scale.width/2,y=portrait?318:217;
  const headline=phase==='GROOVE'?'STAGE 2 / 3 · TWILIGHT':'STAGE 3 / 3 · NIGHT RUSH!';
  const under=scene.add.rectangle(x,y,portrait?470:570,portrait?65:66,0x111b31,.95)
    .setStrokeStyle(4,phase==='FINALE'?0xffab9c:0xb8a5ff).setDepth(108);
  const text=scene.add.text(x,y,headline,{
    fontFamily:PIXEL_FONT,fontSize:portrait?'25px':'30px',fontStyle:'bold',
    color:phase==='FINALE'?'#ffad8b':'#e3c2ff',
    stroke:'#142036',strokeThickness:5,
  }).setOrigin(.5).setDepth(110).setScale(.6);
  scene.tweens.add({targets:[text,under],alpha:0,y:y-26,
    duration:2200,delay:450,ease:'Sine.easeOut',onComplete:()=>{text.destroy();under.destroy();}});
  scene.tweens.add({targets:text,scale:1.04,duration:250,ease:'Back.easeOut'});
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
  const y=hero.y-(portrait?182:92);
  const txt=scene.add.text(x,y,sayings[Phaser.Math.Between(0,sayings.length-1)],{
    fontFamily:PIXEL_FONT,fontSize:portrait?'19px':'17px',fontStyle:'bold',
    color:'#ffe6ad',backgroundColor:'#263047',
    padding:{x:7,y:5},stroke:'#201b34',strokeThickness:2,
  }).setDepth(64).setOrigin(.5).setAlpha(0);
  scene.tweens.add({targets:txt,y:y-28,alpha:1,duration:190,yoyo:true,
    hold:340,onComplete:()=>txt.destroy()});
}

/** Compact, always-readable quest tracker; updated only after an actual shot impact. */
export function addMissionStrip(scene:Phaser.Scene,portrait:boolean):{update:(score:number,perfect:number,combo:number)=>void}{
  const center=scene.scale.width/2;
  const y=portrait?250:183;
  const fontSize=portrait?'15px':'14px';
  scene.add.rectangle(center,y,portrait?501:506,31,0x142138,.77)
    .setStrokeStyle(2,0x72578a,.65).setDepth(85);
  const txt=scene.add.text(center,y,'',{
    fontFamily:PIXEL_FONT,fontSize,fontStyle:'bold',color:'#f4dcb5',
    stroke:'#1a2035',strokeThickness:2,
  }).setOrigin(.5).setDepth(86);
  const update=(score:number,perfect:number,combo:number)=>{
    const a=Math.min(500,score),b=Math.min(3,perfect),c=Math.min(4,combo);
    txt.setText('QUESTS  '+a+'/500 SCORE  ·  '+b+'/3 PERFECT  ·  '+c+'/4 COMBO');
    txt.setColor(a===500&&b===3&&c===4?'#b2ffd5':'#f4dcb5');
  };
  update(0,0,0);
  return {update};
}

/** A very brief tween-only slow-motion accent on exceptional Perfect streaks.
 * Never modifies Phaser's round clock or input timing, so scoring stays fair.
 */
export function rarePerfectSlowMo(scene:Phaser.Scene,perfect:boolean,combo:number):void{
  if(!perfect||combo<5)return;
  const previous=scene.tweens.timeScale;
  scene.tweens.timeScale=.48;
  scene.time.delayedCall(145,()=>{if(scene.tweens)scene.tweens.timeScale=previous;});
}
