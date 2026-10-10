import Phaser from 'phaser';
import { createArt } from './art';
import {addSoundToggle,playSfx} from './sound';
import { addForestLife, burstLeaves, burstStars } from './ambience';
import { applyRaminMood, ensureRaminAnimations, makeRamin, preloadRamin, RAMIN_DESKTOP_SCALE, raminLipPoint } from './ramin';
import { evaluateShot, readBestScore, ROUND_LENGTH_SECONDS, saveBestScore } from '../logic/scoring';

const WIDTH = 960;
const HEIGHT = 540;
const SPAWN_POINTS = [255, 535, 810] as const;
const FONT = '"Courier New", monospace';

function label(scene: Phaser.Scene, x:number, y:number, message:string, size:number, color='#ffffff') {
  return scene.add.text(x,y,message,{fontFamily:FONT,fontSize:`${size}px`,fontStyle:'bold',color,stroke:'#211d34',strokeThickness:4,align:'center'}).setOrigin(.5).setDepth(85);
}
function button(scene: Phaser.Scene, x:number,y:number,w:number,h:number, message:string, onPress:()=>void) {
  const shadow = scene.add.rectangle(x+4,y+6,w,h,0x141c2d).setDepth(75);
  const fill = scene.add.rectangle(x,y,w,h,0xa779f2).setStrokeStyle(5,0x3b2a61).setDepth(76).setInteractive({ useHandCursor: true });
  const shine = scene.add.rectangle(x,y-h/2+6,w-12,5,0xdab5ff,.65).setDepth(77);
  const text = label(scene,x,y,message,Math.min(26,h*.42),'#ffffff');
  fill.on('pointerover',()=>{fill.setFillStyle(0xc28bff);text.setScale(1.05);});
  fill.on('pointerout',()=>{fill.setFillStyle(0xa779f2);text.setScale(1);});
  fill.on('pointerdown',()=>onPress());
  return {fill,shadow,shine,text};
}
function backdrop(scene:Phaser.Scene, withFireflies=true) {
  scene.add.image(480,270,'forest').setDisplaySize(WIDTH,HEIGHT).setDepth(-40);
  addForestLife(scene);
  if (withFireflies) {
    for(let i=0;i<26;i++){
      const x=(i*173+101)%WIDTH;
      const y=(i*97+53)%420;
      const dot=scene.add.rectangle(x,y, i%3===0?5:3,i%3===0?5:3,i%2?0xffd88a:0x8df8c7,.55).setDepth(12);
      scene.tweens.add({targets:dot,y:y-14,alpha:.1,duration:1100+i*94,yoyo:true,repeat:-1,delay:i*55});
    }
  }
}
function addTrees(scene:Phaser.Scene) {
  for (const x of SPAWN_POINTS) {
    const tree=scene.add.image(x-62,300,'tree').setDisplaySize(184,412).setDepth(28);
    scene.tweens.add({ targets: tree, angle: 0.8, duration: 2600 + x, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }
}

export class BootScene extends Phaser.Scene {
  constructor(){super('Boot');}
  preload(){
    const w=this.scale.width,h=this.scale.height;
    this.add.rectangle(w/2,h/2,w,h,0x10182a);
    this.add.text(w/2,h/2-67,'N5 · MUSTACHE MAYHEM',{
      fontFamily:'"Courier New", monospace',fontSize:'25px',fontStyle:'bold',color:'#ffd681'
    }).setOrigin(.5);
    const progressText=this.add.text(w/2,h/2+55,'LOADING 0%',{
      fontFamily:'"Courier New", monospace',fontSize:'18px',color:'#dec2ff'
    }).setOrigin(.5);
    const bar=this.add.graphics();
    const redraw=(value:number)=>{
      bar.clear();
      bar.fillStyle(0x332d46).fillRect(w/2-166,h/2-9,332,30);
      bar.fillStyle(0xb58af1).fillRect(w/2-162,h/2-5,324*value,22);
      progressText.setText('LOADING '+Math.round(value*100)+'%');
    };
    redraw(0);
    this.load.on('progress',redraw);
    preloadRamin(this);
  }
  create(){ createArt(this); ensureRaminAnimations(this); this.scene.start('Menu'); }
}

export class MenuScene extends Phaser.Scene {
  constructor(){super('Menu');}
  create(){
    backdrop(this);
    // Woodland signboard and stacked arcade title.
    this.add.rectangle(325,202,568,304,0x101b29,.74).setStrokeStyle(5,0x735745).setDepth(40);
    this.add.rectangle(325,73,552,11,0x92704b).setDepth(41);
    this.add.rectangle(325,332,552,11,0x92704b).setDepth(41);
    label(this,104,56,'◈ N5 ARCADE',22,'#f7c86d').setOrigin(0,.5);
    label(this,310,140,'MUSTACHE',55,'#ffd173').setShadow(4,5,'#3c1a35',0,true,true);
    label(this,310,207,'MAYHEM',65,'#c49bff').setShadow(4,5,'#38193e',0,true,true);
    label(this,310,267,'AIM  ·  SHOOT  ·  STACHE',18,'#e4dbb7');
    const start=()=>{playSfx('start');this.scene.start('Play');};
    addSoundToggle(this,895,42);
    button(this,305,385,285,68,'▶  PLAY NOW',start);
    label(this,305,454,'45 SECONDS  •  3 STYLES  •  BIG COMBOS',15,'#e3d5e6');
    const hero=makeRamin(this,775,326,RAMIN_DESKTOP_SCALE,'blink').setDepth(41);
    hero.setAngle(-5);
    this.tweens.add({targets:hero,y:312,duration:1400,ease:'Sine.inOut',yoyo:true,repeat:-1});
    const menuStache=this.add.image(775,278,'stache-0').setDisplaySize(68,38).setDepth(46).setAngle(-5);
    this.events.on(Phaser.Scenes.Events.UPDATE,()=>{
      const lip=raminLipPoint(hero);
      menuStache.setPosition(lip.x,lip.y);
    });
    this.add.image(862,106,'coin').setScale(1.6).setDepth(46);
    label(this,790,481,'MEET RAMIN!',23,'#ffe19a');
    label(this,310,513,'Click his upper lip, not his nose!',14,'#c0efd8');
    this.input.keyboard?.once('keydown-ENTER',start);
    this.input.keyboard?.once('keydown-SPACE',start);
  }
}

export class PlayScene extends Phaser.Scene {
  private score=0;
  private combo=0;
  private remaining=ROUND_LENGTH_SECONDS;
  private selectedStyle=0;
  private hero!:Phaser.GameObjects.Sprite;
  private sticker!:Phaser.GameObjects.Image;
  private scoreText!:Phaser.GameObjects.Text;
  private timerText!:Phaser.GameObjects.Text;
  private comboText!:Phaser.GameObjects.Text;
  private styleMarkers:Phaser.GameObjects.Rectangle[]=[];
  private active=false;
  private roundOver=false;
  private shooting=false;
  private spawnSerial=0;
  private previousSlot=-1;
  private cursor!:Phaser.GameObjects.Graphics;

  constructor(){super('Play');}
  create(){
    this.score=0;this.combo=0;this.remaining=ROUND_LENGTH_SECONDS;this.selectedStyle=0;
    this.active=false;this.roundOver=false;this.shooting=false;this.spawnSerial=0;this.previousSlot=-1;
    backdrop(this);addTrees(this);
    this.hero=makeRamin(this,-200,324,RAMIN_DESKTOP_SCALE,'idle').setVisible(false);
    this.sticker=this.add.image(-200,320,'stache-0').setDisplaySize(66,37).setDepth(31).setVisible(false);
    this.createHud();
    addSoundToggle(this,895,36);
    this.createSelector();
    this.cursor=this.add.graphics().setDepth(95);
    this.input.on('pointermove',(pointer:Phaser.Input.Pointer)=>this.drawCursor(pointer.x,pointer.y));
    this.input.on('pointerdown',(pointer:Phaser.Input.Pointer)=>this.handlePointer(pointer));
    this.input.keyboard?.on('keydown-ONE',()=>this.selectStyle(0));
    this.input.keyboard?.on('keydown-TWO',()=>this.selectStyle(1));
    this.input.keyboard?.on('keydown-THREE',()=>this.selectStyle(2));
    this.input.keyboard?.on('keydown-ESC',()=>{if(!this.roundOver)this.finishRound();});
    this.time.addEvent({delay:1000,loop:true,callback:()=>{
      if(this.roundOver)return;
      this.remaining--;
      this.timerText.setText(`00:${String(Math.max(this.remaining,0)).padStart(2,'0')}`);
      if(this.remaining<=10)this.timerText.setColor('#ff929c');
      if(this.remaining<=0)this.finishRound();
    }});
    label(this,480,109,'WAIT FOR RAMIN...',18,'#fff0c2').setDepth(55).setAlpha(.75);
    this.time.delayedCall(650,()=>this.popTarget());
  }
  private createHud(){
    const top=this.add.rectangle(480,36,938,66,0x131d2b,.92).setStrokeStyle(4,0x6e547e).setDepth(72);
    top.setAlpha(.96);
    this.add.image(54,36,'coin').setDisplaySize(51,51).setDepth(80);
    label(this,155,23,'SCORE',15,'#dcc59f');
    this.scoreText=label(this,160,48,'00000',23,'#fff6ce');
    label(this,475,22,'TIME LEFT',15,'#d9cbb4');
    this.timerText=label(this,477,49,'00:45',26,'#ffffff');
    label(this,772,22,'COMBO',15,'#d9cbb4');
    this.comboText=label(this,773,49,'× 0',25,'#bca1ff');
    const under=this.add.rectangle(480,102,700,31,0x131c2d,.65).setDepth(68);
    under.setStrokeStyle(2,0x525970,.8);
    label(this,480,102,'TARGET: THE SPACE BELOW HIS NOSE!',16,'#e6e8c3');
  }
  private createSelector(){
    const board=this.add.rectangle(480,498,952,78,0x121d29,.96).setStrokeStyle(4,0x765a79).setDepth(70);
    board.setAlpha(.97);
    label(this,116,476,'CHOOSE YOUR',14,'#d5c9a7');
    label(this,116,499,'MUSTACHE',19,'#ffce7c');
    label(this,118,523,'1 · 2 · 3',12,'#a9c5b6');
    this.styleMarkers=[];
    for(let i=0;i<3;i++){
      const x=355+i*124;
      const mark=this.add.rectangle(x,498,102,62,0x2c2d49).setStrokeStyle(4,0x68627c).setDepth(73).setInteractive({useHandCursor:true});
      mark.on('pointerdown',()=>this.selectStyle(i));
      this.add.image(x,498,`stache-${i}`).setDisplaySize(86,40).setDepth(74);
      label(this,x-43,472,String(i+1),12,'#fbd88e');
      this.styleMarkers.push(mark);
    }
    this.selectStyle(0);
    label(this,813,482,'CLICK / TAP',17,'#f6da90');
    label(this,815,508,'TO LAUNCH!',16,'#e3caff');
  }
  private selectStyle(style:number){
    this.selectedStyle=style;
    this.styleMarkers.forEach((m,i)=>m.setStrokeStyle(4,i===style?0xffcd62:0x68627c).setFillStyle(i===style?0x55436d:0x2c2d49));
  }
  private drawCursor(x:number,y:number){
    this.cursor.clear();
    if(y>=451||this.roundOver)return;
    const color=0xffe5aa;
    this.cursor.lineStyle(2,color,.85);
    this.cursor.strokeCircle(x,y,13);
    this.cursor.lineBetween(x-22,y,x-8,y);
    this.cursor.lineBetween(x+8,y,x+22,y);
    this.cursor.lineBetween(x,y-22,x,y-8);
    this.cursor.lineBetween(x,y+8,x,y+22);
  }
  private popTarget(){
    if(this.roundOver)return;
    let slot=Phaser.Math.Between(0,SPAWN_POINTS.length-1);
    if(slot===this.previousSlot)slot=(slot+1+Phaser.Math.Between(0,1))%SPAWN_POINTS.length;
    this.previousSlot=slot;
    const serial=++this.spawnSerial;
    this.active=true;
    applyRaminMood(this.hero,'idle');
    this.hero.setPosition(SPAWN_POINTS[slot],354).setAlpha(0).setVisible(true).setAngle(Phaser.Math.Between(-5,5));
    burstLeaves(this,SPAWN_POINTS[slot]-53,385,7);
    this.sticker.setVisible(false);
    this.tweens.add({targets:this.hero,y:315,alpha:1,duration:240,ease:'Back.easeOut'});
    this.time.delayedCall(Phaser.Math.Between(1450,1900),()=>{
      if(serial!==this.spawnSerial||!this.active||this.roundOver)return;
      this.active=false;
      this.hideTarget(()=>this.time.delayedCall(220,()=>this.popTarget()));
    });
  }
  private hideTarget(onEnd:()=>void){
    this.tweens.add({targets:this.hero,y:365,alpha:0,duration:210,ease:'Quad.easeIn',onComplete:()=>{
      this.hero.setVisible(false);this.sticker.setVisible(false);onEnd();
    }});
  }
  private handlePointer(pointer:Phaser.Input.Pointer){
    if(this.roundOver||this.shooting||pointer.y>450)return;
    // Prevent accidental shooting at the HUD when changing an option.
    if(pointer.y<125)return;
    this.shooting=true;
    const lip = raminLipPoint(this.hero);
    const targetX=lip.x;
    const targetY=lip.y;
    const distance=Phaser.Math.Distance.Between(pointer.x,pointer.y,targetX,targetY);
    const result=evaluateShot(distance,this.combo,this.active);
    if(result.grade!=='miss'){
      this.active=false;
      this.spawnSerial++; // invalidates the old appearance timeout
      this.score+=result.points;
      this.combo=result.combo;
      this.scoreText.setText(String(this.score).padStart(5,'0'));
      this.comboText.setText(`× ${this.combo}`);
    }else{
      this.combo=0;
      this.comboText.setText('× 0');
    }
    playSfx('shot');
    const startX=480, startY=459;
    const projectile=this.add.image(startX,startY,`stache-${this.selectedStyle}`).setDisplaySize(76,36).setDepth(92);
    projectile.setRotation(Phaser.Math.Angle.Between(startX,startY,pointer.x,pointer.y)*.18);
    this.tweens.add({targets:projectile,x:pointer.x,y:pointer.y,scaleX:.72,scaleY:.72,rotation:0,duration:240,ease:'Quad.easeOut',onComplete:()=>{
      projectile.destroy();
      this.shooting=false;
      if(this.roundOver)return;
      if(result.grade==='miss'){
        playSfx('miss');
        this.popFeedback(pointer.x,pointer.y,'MISS!', '#ff848f');
        burstLeaves(this,pointer.x,pointer.y,3);
      }else{
        playSfx(result.grade==='perfect'?'perfect':'good');
        applyRaminMood(this.hero,'surprised');
        const mouth = raminLipPoint(this.hero);
        this.sticker.setTexture(`stache-${this.selectedStyle}`).setPosition(mouth.x,mouth.y).setVisible(true);
        burstStars(this,mouth.x,mouth.y,result.grade==='perfect');
        if(result.grade==='perfect')this.cameras.main.shake(100,0.0025);
        this.popFeedback(mouth.x,this.hero.y-165,result.grade==='perfect'?`+${result.points} PERFECT!`:`+${result.points} GOOD!`,result.grade==='perfect'?'#ffd16c':'#a7efc0');
        this.tweens.add({targets:this.hero,scaleX:RAMIN_DESKTOP_SCALE*1.04,scaleY:RAMIN_DESKTOP_SCALE*1.04,duration:90,yoyo:true});
        this.time.delayedCall(510,()=>this.hideTarget(()=>this.time.delayedCall(180,()=>this.popTarget())));
      }
    }});
  }
  update(){
    if(this.hero?.active && this.sticker?.visible){
      const lip=raminLipPoint(this.hero);
      this.sticker.setPosition(lip.x,lip.y);
    }
  }
  private popFeedback(x:number,y:number,message:string,color:string){
    const cappedX=Phaser.Math.Clamp(x,170,790);
    const cappedY=Phaser.Math.Clamp(y,162,411);
    const text=label(this,cappedX,cappedY,message,message.length>11?26:32,color).setDepth(96);
    this.tweens.add({targets:text,y:cappedY-44,alpha:0,scale:1.08,duration:740,ease:'Cubic.easeOut',onComplete:()=>text.destroy()});
  }
  private finishRound(){
    if(this.roundOver)return;
    this.roundOver=true;this.active=false;this.input.enabled=false;
    playSfx('finish');
    const best=Math.max(this.score,readBestScore());
    saveBestScore(best);
    this.scene.start('Results',{score:this.score,best});
  }
}

type ResultsData = { score:number; best:number };
export class ResultsScene extends Phaser.Scene {
  private finalScore=0;
  private bestScore=0;
  constructor(){super('Results');}
  init(data:ResultsData){this.finalScore=data.score??0;this.bestScore=data.best??0;}
  create(){
    backdrop(this);
    this.add.rectangle(500,271,885,445,0x142036,.94).setStrokeStyle(7,0x806048).setDepth(40);
    this.add.rectangle(501,59,860,10,0xc49c65).setDepth(41);
    label(this,466,118,'ROUND COMPLETE!',43,'#ffcb6e');
    addSoundToggle(this,861,79);
    const resultsHero=makeRamin(this,220,318,RAMIN_DESKTOP_SCALE,'victory').setDepth(53);
    const resultsLip = raminLipPoint(resultsHero);
    const resultStache = this.add.image(resultsLip.x, resultsLip.y,'stache-0').setDisplaySize(70,40).setDepth(54);
    this.tweens.add({targets:resultsHero,y:312,angle:2,duration:1400,yoyo:true,repeat:-1,ease:'Sine.inOut'});
    this.events.on(Phaser.Scenes.Events.UPDATE,()=>{
      const mouth=raminLipPoint(resultsHero);
      resultStache.setPosition(mouth.x,mouth.y);
    });
    this.add.image(317,221,'coin').setScale(1.2).setDepth(55);
    label(this,640,204,'YOUR SCORE',22,'#d7bee8');
    label(this,640,259,String(this.finalScore).padStart(5,'0'),62,'#fff2bf');
    label(this,640,312,`PERSONAL BEST: ${this.bestScore}`,21,'#b5f6c6');
    label(this,645,351,'Saved on this device only',16,'#b5b9c5');
    const again=()=>{playSfx('start');this.scene.start('Play');};
    button(this,642,432,324,67,'↻  PLAY AGAIN',again);
    label(this,493,511,'NO REAL TOKENS · PRACTICE MODE',16,'#d1bbdb');
    this.input.keyboard?.once('keydown-ENTER',again);
    this.input.keyboard?.once('keydown-SPACE',again);
  }
}
