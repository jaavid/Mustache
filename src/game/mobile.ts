import Phaser from 'phaser';
import { burstLeaves, burstStars } from './ambience';
import {addSoundToggle,playSfx} from './sound';
import { applyRaminMood, makeRamin, RAMIN_MOBILE_SCALE, raminLipPoint } from './ramin';
import { evaluateShot, readBestScore, ROUND_LENGTH_SECONDS, saveBestScore } from '../logic/scoring';
import { normalizeTouchDistance } from '../logic/touch';

/** Dedicated 540 × 960 portrait experience. Desktop scenes remain unchanged. */
const W = 540;
const H = 960;
const SPAWNS = [134, 270, 406] as const;
const FONT = '"Courier New", monospace';
const SELECTOR_TOP = 768;
const HUD_BOTTOM = 164;
const FACE_Y = 547;
// Slightly more forgiving hit zones on touchscreens without changing the scoring contract.


function text(scene: Phaser.Scene, x: number, y: number, words: string, size: number, color = '#ffffff') {
  return scene.add.text(x, y, words, {
    fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color,
    stroke: '#211c33', strokeThickness: 4, align: 'center',
  }).setOrigin(.5).setDepth(90);
}

function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, fill = 0x15243a, alpha = .96, depth = 70) {
  return scene.add.rectangle(x, y, w, h, fill, alpha).setStrokeStyle(4, 0x745c83).setDepth(depth);
}

function largeButton(scene: Phaser.Scene, x: number, y: number, caption: string, onClick: () => void) {
  scene.add.rectangle(x+4, y+7, 380, 84, 0x111a2b).setDepth(80);
  const surface = scene.add.rectangle(x, y, 380, 84, 0x9b6bef)
    .setStrokeStyle(5, 0x463064).setDepth(81).setInteractive({useHandCursor: true});
  scene.add.rectangle(x, y-33, 360, 7, 0xdbb3ff, .75).setDepth(82);
  text(scene, x, y, caption, 30, '#fff5ff');
  surface.on('pointerdown', onClick);
  return surface;
}

function portraitBackdrop(scene: Phaser.Scene) {
  scene.add.rectangle(W/2, H/2, W, H, 0x101b31).setDepth(-45);
  // Crop the existing landscape art instead of stretching it into a portrait texture.
  scene.add.image(W/2, 466, 'forest').setDisplaySize(1300, 735).setDepth(-40);
  scene.add.image(W/2, 798, 'forest').setDisplaySize(1250, 710).setAlpha(.65).setTint(0x7aa398).setDepth(-39);
  scene.add.rectangle(W/2, 850, W, 235, 0x122c31, .72).setDepth(-10);
  for (let i = 0; i < 20; i++) {
    const x = 23 + (i*79)%500;
    const y = 192 + (i*151)%565;
    const dot = scene.add.image(x, y, 'spark').setScale(i%3 ? .7 : 1).setDepth(12)
      .setTint(i%2 ? 0xffe29b : 0x9ce8b3).setAlpha(.3);
    scene.tweens.add({targets: dot, alpha: .8, y: y-14, duration: 1900+i*90, yoyo: true, repeat: -1});
  }
}

function trees(scene: Phaser.Scene) {
  for (const x of SPAWNS) {
    const tree = scene.add.image(x-88, 552, 'tree').setDisplaySize(146, 430).setDepth(28);
    scene.tweens.add({ targets: tree, angle: .65, duration: 2450+x, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }
  scene.add.image(270, 748, 'forest-front').setDisplaySize(545, 125).setDepth(40);
}

export class MobileMenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }
  create() {
    portraitBackdrop(this);
    panel(this, 270, 192, 496, 292, 0x122037, .91, 45);
    text(this, 270, 79, '✦ N5 ARCADE ✦', 25, '#ffe199');
    text(this, 270, 151, 'MUSTACHE', 52, '#ffce77');
    text(this, 270, 216, 'MAYHEM', 64, '#c5a2ff');
    text(this, 270, 288, 'AIM · SHOOT · STACHE', 20, '#e1dac7');
    const hero = makeRamin(this, 270, 530, RAMIN_MOBILE_SCALE, 'blink').setDepth(43);
    const lip = raminLipPoint(hero);
    const menuStache=this.add.image(lip.x, lip.y, 'stache-0').setDisplaySize(80,44).setDepth(44);
    this.events.on(Phaser.Scenes.Events.UPDATE,()=>{
      const target=raminLipPoint(hero);
      menuStache.setPosition(target.x,target.y).setRotation(hero.rotation);
    });
    this.add.image(451, 390, 'coin').setDisplaySize(70, 70).setDepth(48);
    this.tweens.add({targets: hero, y: 498, duration: 1550, yoyo:true, repeat:-1, ease: 'Sine.inOut'});
    text(this, 270, 691, 'CATCH RAMIN IN THE FOREST!', 22, '#fbe8bc');
    addSoundToggle(this,468,38,118);
    const start=()=>{playSfx('start');this.scene.start('Play');};
    largeButton(this,270,792,'▶ PLAY NOW',start);
    text(this, 270, 871, '45 SEC  ·  3 STYLES  ·  COMBOS', 17, '#decbea');
    text(this, 270, 924, 'Tap just below his nose!', 18, '#b0efcf');
    this.input.keyboard?.once('keydown-ENTER',start);
  }
}

export class MobilePlayScene extends Phaser.Scene {
  private score = 0;
  private combo = 0;
  private remaining = ROUND_LENGTH_SECONDS;
  private selectedStyle = 0;
  private activeTarget = false;
  private shooting = false;
  private roundOver = false;
  private spawnSerial = 0;
  private previousSlot = -1;
  private hero!: Phaser.GameObjects.Sprite;
  private sticker!: Phaser.GameObjects.Image;
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private selector: Phaser.GameObjects.Rectangle[] = [];

  constructor() { super('Play'); }
  create() {
    this.score=0; this.combo=0; this.remaining=ROUND_LENGTH_SECONDS; this.selectedStyle=0;
    this.activeTarget=false; this.shooting=false; this.roundOver=false;
    this.spawnSerial=0; this.previousSlot=-1;
    portraitBackdrop(this);
    trees(this);
    this.hero = makeRamin(this, -300, FACE_Y + 18, RAMIN_MOBILE_SCALE, 'idle').setVisible(false);
    this.sticker = this.add.image(-300, FACE_Y, 'stache-0').setDisplaySize(82,46).setDepth(31).setVisible(false);
    this.hud();
    addSoundToggle(this,469,27,112);
    this.styles();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.shoot(pointer));
    this.input.keyboard?.on('keydown-ONE',()=>this.chooseStyle(0));
    this.input.keyboard?.on('keydown-TWO',()=>this.chooseStyle(1));
    this.input.keyboard?.on('keydown-THREE',()=>this.chooseStyle(2));
    this.input.keyboard?.on('keydown-ESC',()=>this.finish());
    this.time.addEvent({delay:1000,loop:true,callback:()=>{
      if (this.roundOver) return;
      this.remaining--;
      this.timeText.setText(`00:${String(Math.max(0,this.remaining)).padStart(2,'0')}`);
      if(this.remaining<=10) this.timeText.setColor('#ff929c');
      if(this.remaining<=0) this.finish();
    }});
    text(this,270,214,'WAIT FOR RAMIN...',22,'#f5e8bb').setDepth(50);
    this.time.delayedCall(650,()=>this.pop());
  }

  private hud() {
    panel(this,270,89,526,156,0x131c2d,.97,75);
    text(this,270,26,'N5 · MUSTACHE MAYHEM',18,'#f4c66d');
    this.add.image(36,99,'coin').setDisplaySize(44,44).setDepth(86);
    for(const [x,title] of [[108,'SCORE'],[270,'TIME'],[430,'COMBO']] as const) {
      text(this,x,73,title,18,'#d7c9bd');
    }
    this.scoreText = text(this,108,115,'00000',29,'#fff3c2');
    this.timeText = text(this,270,115,'00:45',30,'#ffffff');
    this.comboText = text(this,430,115,'× 0',29,'#ceb0ff');
    text(this,270,151,'TAP THE SPACE UNDER HIS NOSE',17,'#caeccf');
  }

  private styles() {
    panel(this,270,859,526,190,0x111c2e,.98,75);
    text(this,270,793,'CHOOSE YOUR MUSTACHE',21,'#ffe3a4');
    this.selector=[];
    for(let i=0;i<3;i++){
      const x=101+i*169;
      const hit=this.add.rectangle(x,863,146,97,0x302b48)
        .setStrokeStyle(5,0x6c6282).setDepth(79).setInteractive({useHandCursor:true});
      hit.on('pointerdown',()=>this.chooseStyle(i));
      this.add.image(x,869,`stache-${i}`).setDisplaySize(115,54).setDepth(80);
      text(this,x-53,833,String(i+1),19,'#fff2bb');
      this.selector.push(hit);
    }
    this.chooseStyle(0);
    text(this,270,936,'TAP THE FACE TO LAUNCH!',17,'#d2bbff');
  }
  private chooseStyle(i:number) {
    this.selectedStyle=i;
    this.selector.forEach((box,index)=>box.setFillStyle(index===i?0x594171:0x302b48)
      .setStrokeStyle(5,index===i?0xffd374:0x6c6282));
  }
  private pop() {
    if(this.roundOver) return;
    let slot=Phaser.Math.Between(0,SPAWNS.length-1);
    if(slot===this.previousSlot) slot=(slot+1+Phaser.Math.Between(0,1))%SPAWNS.length;
    this.previousSlot=slot;
    const serial=++this.spawnSerial;
    this.activeTarget=true;
    const x=SPAWNS[slot];
    applyRaminMood(this.hero,'idle');
    this.hero.setPosition(x,FACE_Y+54).setAlpha(0).setVisible(true)
      .setAngle(Phaser.Math.Between(-5,5));
    this.sticker.setVisible(false);
    burstLeaves(this,x-55,650,9);
    this.tweens.add({targets:this.hero,y:FACE_Y,alpha:1,duration:265,ease:'Back.easeOut'});
    this.time.delayedCall(Phaser.Math.Between(1650,2000),()=>{
      if(serial!==this.spawnSerial||!this.activeTarget||this.roundOver)return;
      this.activeTarget=false;
      this.hide(()=>this.time.delayedCall(170,()=>this.pop()));
    });
  }
  private hide(next:()=>void) {
    this.tweens.add({targets:this.hero,y:FACE_Y+66,alpha:0,duration:220,ease:'Quad.easeIn',onComplete:()=>{
      this.hero.setVisible(false);
      this.sticker.setVisible(false);
      next();
    }});
  }
  private shoot(pointer:Phaser.Input.Pointer) {
    const x=pointer.x, y=pointer.y;
    if(this.roundOver||this.shooting||y < HUD_BOTTOM||y > SELECTOR_TOP) return;
    this.shooting=true;
    const lip = raminLipPoint(this.hero);
    const distance=Phaser.Math.Distance.Between(x,y,lip.x,lip.y);
    const result=evaluateShot(normalizeTouchDistance(distance),this.combo,this.activeTarget);
    if(result.grade!=='miss') {
      this.activeTarget=false;
      this.spawnSerial++;
      this.combo=result.combo;
      this.score+=result.points;
      this.scoreText.setText(String(this.score).padStart(5,'0'));
      this.comboText.setText(`× ${this.combo}`);
    } else {
      this.combo=0;
      this.comboText.setText('× 0');
    }
    playSfx('shot');
    const projectile=this.add.image(270,772,`stache-${this.selectedStyle}`)
      .setDisplaySize(100,45).setDepth(96);
    projectile.setRotation(Phaser.Math.Angle.Between(270,772,x,y)*.18);
    this.tweens.add({targets:projectile,x,y,rotation:0,scaleX:.8,scaleY:.8,duration:235,
      ease:'Quad.easeOut',onComplete:()=>{
        projectile.destroy(); this.shooting=false;
        if(this.roundOver) return;
        if(result.grade==='miss'){
          playSfx('miss');
          this.feedback(x,y,'MISS!','#ff8eaa');
          burstLeaves(this,x,y,3);
        }else{
          playSfx(result.grade==='perfect'?'perfect':'good');
          applyRaminMood(this.hero,'surprised');
          const mouth = raminLipPoint(this.hero);
          this.sticker.setTexture(`stache-${this.selectedStyle}`)
            .setPosition(mouth.x,mouth.y).setRotation(this.hero.rotation).setVisible(true);
          burstStars(this,mouth.x,mouth.y,result.grade==='perfect');
          this.feedback(mouth.x,this.hero.y-190,
            result.grade==='perfect'?`+${result.points} PERFECT!`:`+${result.points} GOOD!`,
            result.grade==='perfect'?'#ffe083':'#aaf3d4');
          this.tweens.add({targets:this.hero,scale:RAMIN_MOBILE_SCALE*1.04,duration:110,yoyo:true});
          this.time.delayedCall(460,()=>this.hide(()=>this.time.delayedCall(170,()=>this.pop())));
        }
      }});
  }
  update(){
    if(this.hero?.active && this.sticker?.visible){
      const lip=raminLipPoint(this.hero);
      this.sticker.setPosition(lip.x,lip.y).setRotation(this.hero.rotation);
    }
  }
  private feedback(x:number,y:number,words:string,color:string){
    const sx=Phaser.Math.Clamp(x,110,430);
    const sy=Phaser.Math.Clamp(y,230,685);
    const floating=text(this,sx,sy,words,words.length>10?25:32,color).setDepth(97);
    this.tweens.add({targets:floating,y:sy-55,alpha:0,duration:850,ease:'Cubic.easeOut',onComplete:()=>floating.destroy()});
  }
  private finish(){
    if(this.roundOver) return;
    this.roundOver=true; this.activeTarget=false; this.input.enabled=false;
    playSfx('finish');
    const best=Math.max(this.score,readBestScore());
    saveBestScore(best);
    this.scene.start('Results',{score:this.score,best});
  }
}

type ResultData={score:number;best:number};
export class MobileResultsScene extends Phaser.Scene {
  private score=0;
  private best=0;
  constructor(){super('Results');}
  init(data:ResultData){this.score=data.score??0;this.best=data.best??0;}
  create(){
    portraitBackdrop(this);
    panel(this,270,481,512,848,0x132137,.96,50);
    text(this,270,108,'ROUND COMPLETE!',38,'#ffd281');
    addSoundToggle(this,460,58,112);
    const hero = makeRamin(this,270,382,RAMIN_MOBILE_SCALE * 1.06,'victory').setDepth(55);
    const lip = raminLipPoint(hero);
    const resultsStache = this.add.image(lip.x,lip.y,'stache-0').setDisplaySize(88,48).setDepth(56);
    this.tweens.add({targets:hero,y:375,angle:2,duration:1500,yoyo:true,repeat:-1,ease:'Sine.inOut'});
    this.events.on(Phaser.Scenes.Events.UPDATE,()=>{
      const mouth=raminLipPoint(hero);
      resultsStache.setPosition(mouth.x,mouth.y).setRotation(hero.rotation);
    });
    this.add.image(433,247,'coin').setDisplaySize(74,74).setDepth(57);
    text(this,270,549,'YOUR SCORE',24,'#d9c8e4');
    text(this,270,616,String(this.score).padStart(5,'0'),67,'#fff0b1');
    text(this,270,687,`PERSONAL BEST: ${this.best}`,22,'#adf3c8');
    text(this,270,729,'Saved on this device only',16,'#bbbfca');
    largeButton(this,270,826,'↻ PLAY AGAIN',()=>{playSfx('start');this.scene.start('Play');});
    text(this,270,915,'PRACTICE MODE · NO REAL TOKENS',16,'#dccae7');
    this.input.keyboard?.once('keydown-ENTER',()=>this.scene.start('Play'));
  }
}
