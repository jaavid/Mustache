import Phaser from 'phaser';

export type SoundEffect = 'start'|'select'|'shot'|'perfect'|'good'|'miss'|'finish';
const KEY='n5-mustache-sfx-enabled-v1';
let enabled=true;
try{enabled=localStorage.getItem(KEY)!=='false';}catch{ /* optional */ }
let audio:AudioContext|null=null;

function getAudio():AudioContext|null{
  if(!enabled||typeof AudioContext==='undefined')return null;
  try{
    audio??=new AudioContext();
    if(audio.state==='suspended')void audio.resume().catch(()=>undefined);
    return audio;
  }catch{return null;}
}
function beep(ctx:AudioContext,at:number,hz:number,duration:number,shape:OscillatorType='triangle',volume=.055):void{
  const osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.type=shape;osc.frequency.setValueAtTime(hz,at);
  gain.gain.setValueAtTime(.0001,at);
  gain.gain.exponentialRampToValueAtTime(volume,at+.012);
  gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
  osc.connect(gain);gain.connect(ctx.destination);
  osc.start(at);osc.stop(at+duration+.012);
}
export function playSfx(effect:SoundEffect):void{
  const ctx=getAudio();if(!ctx)return;
  const t=ctx.currentTime+.013;
  switch(effect){
    case 'select':beep(ctx,t,520,.07,'square',.022);break;
    case 'start':
      beep(ctx,t,392,.12);beep(ctx,t+.11,587,.14);beep(ctx,t+.24,784,.2);break;
    case 'shot':
      beep(ctx,t,340,.07,'sawtooth',.036);beep(ctx,t+.04,220,.10,'triangle',.038);break;
    case 'good':
      beep(ctx,t,560,.09);beep(ctx,t+.10,740,.16,'sine');break;
    case 'perfect':
      beep(ctx,t,660,.10);beep(ctx,t+.085,880,.11);beep(ctx,t+.18,1175,.21,'sine');break;
    case 'miss':
      beep(ctx,t,196,.12,'sawtooth',.03);beep(ctx,t+.09,140,.16,'triangle',.025);break;
    case 'finish':
      beep(ctx,t,523,.13);beep(ctx,t+.14,659,.14);beep(ctx,t+.29,784,.14);beep(ctx,t+.46,1047,.3,'sine');break;
  }
}
export function toggleSfx():boolean{
  enabled=!enabled;
  try{localStorage.setItem(KEY,String(enabled));}catch{/* optional */}
  if(enabled)playSfx('select');
  return enabled;
}
/** Scene-owned on/off button; survives orientation changes through module state. */
export function addSoundToggle(scene:Phaser.Scene,x:number,y:number,width=106):void{
  const background=scene.add.rectangle(x,y,width,38,0x142338,.96)
    .setStrokeStyle(3,0xc5a0fa).setDepth(119).setInteractive({useHandCursor:true});
  const label=scene.add.text(x,y,'',{
    fontFamily:'"Courier New", monospace',fontSize:'15px',
    fontStyle:'bold',color:'#f3d7ff'
  }).setOrigin(.5).setDepth(120);
  const render=()=>{
    label.setText(enabled?'SFX ON':'SFX OFF');
    background.setStrokeStyle(3,enabled?0xc5a0fa:0x617083);
  };
  background.on('pointerdown',()=>{toggleSfx();render();});
  render();
}
