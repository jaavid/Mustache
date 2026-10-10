import Phaser from 'phaser';

type Ctx = CanvasRenderingContext2D;
const SW = 480;
const SH = 270;

function makeCanvas(scene: Phaser.Scene, key: string, width: number, height: number, draw: (ctx: Ctx) => void) {
  const tex = scene.textures.createCanvas(key, width, height);
  if (!tex) throw new Error(`Canvas texture creation failed: ${key}`);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  tex.refresh();
}
function rect(c: Ctx, x: number, y: number, w: number, h: number, color: string) {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, color: string) {
  c.fillStyle = color;
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI); c.fill();
}
function rand(seed: number) {
  let v = seed >>> 0;
  return () => { v = (1664525 * v + 1013904223) >>> 0; return v / 4294967296; };
}

function forestBackground(c: Ctx) {
  const r = rand(7005);
  const sky = c.createLinearGradient(0, 0, 0, 200);
  sky.addColorStop(0, '#18263f');sky.addColorStop(.45, '#465580');sky.addColorStop(.75, '#8973a5');sky.addColorStop(1, '#4a617e');
  c.fillStyle = sky; c.fillRect(0,0,SW,SH);
  // Dawn reflected beyond an ancient forest.
  ellipse(c, 250, 92, 97, 71, '#c4a3a050');
  ellipse(c, 248, 80, 54, 37, '#f4c7a850');
  ellipse(c, 273, 72, 16, 16, '#f4dab0');
  ellipse(c, 279, 66, 14, 14, '#465580');
  for(let i=0;i<80;i++) rect(c, r()*480,r()*130, r()*2+1, r()*2+1, r()>.5?'#b8d5bd66':'#ffffff42');
  // Many layers of vertical tree silhouettes, read as parallax depth.
  for(let layer=0;layer<3;layer++){
    const trunk= ['#34445c','#2b4652','#213b47'][layer];
    const canopy=['#344c65','#2c505a','#21484b'][layer];
    for(let j=0;j<18;j++){
      const x=j*31-22+r()*19;
      const top=10+r()*60+layer*15;
      rect(c,x,top,5+layer*3,195,trunk);
      rect(c,x-7,top+34,16,3,trunk);
      ellipse(c,x,top,25+layer*4,24+layer*3,canopy);
      ellipse(c,x-14,top+14,21,16,canopy);
      ellipse(c,x+11,top+15,19,22,canopy);
    }
  }
  // Mountain valley and waterfalls.
  c.fillStyle='#52667b';c.beginPath();c.moveTo(0,171);c.lineTo(57,132);c.lineTo(108,158);c.lineTo(159,117);c.lineTo(226,152);c.lineTo(311,121);c.lineTo(384,144);c.lineTo(480,104);c.lineTo(480,220);c.lineTo(0,220);c.closePath();c.fill();
  c.fillStyle='#324f55';c.beginPath();c.moveTo(0,179);c.lineTo(68,150);c.lineTo(125,172);c.lineTo(195,145);c.lineTo(271,164);c.lineTo(352,135);c.lineTo(480,173);c.lineTo(480,235);c.lineTo(0,235);c.closePath();c.fill();
  rect(c,390,124,23,110,'#88cad0');rect(c,394,127,4,105,'#bfe6dd');rect(c,404,124,2,116,'#c9edeb');
  for(let i=0;i<30;i++) rect(c,385+r()*40,227+r()*16,2+r()*5,1,'#d3ddd188');
  rect(c,0,179,480,91,'#253f3f');
  // Ruined mossy bridge behind stage.
  rect(c,320,140,140,7,'#6d665f');rect(c,318,143,144,4,'#3b434d');
  for(let x=330;x<463;x+=20){rect(c,x,129,4,17,'#55535c');rect(c,x+4,133,16,3,'#8a7e78');}
  // Lush ground blocks with exposed rocky edge.
  rect(c,0,188,480,82,'#233e37');
  for(let i=0;i<110;i++){
    let x=Math.floor(r()*480), y=184+Math.floor(r()*56);
    rect(c,x,y,2+Math.floor(r()*9),1+Math.floor(r()*4),['#375c44','#2b5a4b','#47664d','#566d4f'][Math.floor(r()*4)]);
  }
  for(let i=0;i<40;i++){
    const x=Math.floor(r()*480),y=233+Math.floor(r()*36);
    rect(c,x,y,3+Math.floor(r()*12),2+Math.floor(r()*6),'#1b3335');
  }
  // Moss covered stepping stones and glowing mushrooms.
  for(let i=0;i<15;i++){
    const x=Math.floor(r()*480),y=217+Math.floor(r()*51);
    ellipse(c,x,y,8+r()*8,3+r()*3,'#526b5a');
    rect(c,x-5,y-2,8,2,'#7e8965');
  }
  for(let i=0;i<28;i++){
    const x=Math.floor(r()*470)+4,y=Math.floor(200+r()*58);
    rect(c,x,y-2,2,5,'#c9c8a2');
    ellipse(c,x+1,y-3,5,3, r()>.55?'#c875e4':'#a8a0ff');
    rect(c,x,y-4,2,1,'#ffdcfa');
  }
  // Hanging drapery of canopy: strong top framing.
  for(let x=-22;x<500;x+=13){
    const len=8+Math.floor(r()*36);
    ellipse(c,x,0,24,len,'#112f35');
    ellipse(c,x+6,4,18,len*.6,'#17473c');
    for(let j=0;j<4;j++) rect(c,x-9+r()*24,7+r()*len,3,3,'#286048');
  }
  // Side vignettes, no dependency on external assets.
  for(const x of [-7,470]){
    rect(c,x,0,14,210,'#1a303b');
    rect(c,x+3,0,4,200,'#3a4a47');
  }
  // Back fireflies
  for(let i=0;i<52;i++){
    const x=Math.floor(r()*480),y=Math.floor(r()*210);
    rect(c,x,y,2,2,i%3===0?'#f7dc86':'#73d7a377');
  }
}

function trunk(c: Ctx) {
  const r=rand(2026);
  // Tree trunk with liana, canopy, bark ridges and golden lamp.
  rect(c,31,0,33,194,'#172f34');
  rect(c,36,0,23,191,'#514337');
  rect(c,43,0,12,191,'#6b4d3b');
  rect(c,57,0,4,180,'#302d2d');
  rect(c,35,16,3,121,'#816342');
  for(let i=0;i<35;i++){
    const x=38+r()*18,y=r()*180;
    rect(c,x,y,1+r()*4,3+r()*11, i%3===0?'#986f4a':'#322e2f');
  }
  // Roots and left-screen silhouette.
  ellipse(c,46,193,47,14,'#273c36');
  rect(c,5,184,62,10,'#4b4137');
  ellipse(c,24,186,34,9,'#2f463a');
  // Leaf branches jut toward the top.
  for(let i=0;i<40;i++){
    const x=r()*90,y=r()*65-13;
    ellipse(c,x,y,8+r()*18,6+r()*14,['#133c3a','#195244','#285940','#315b44'][i%4]);
  }
  // Vine curls.
  rect(c,29,0,3,98,'#2a6447');
  for(let y=9;y<96;y+=13){rect(c,24,y,8,2,'#41784d');rect(c,28,y+3,6,2,'#3d8b54');}
  // Mini hanging lantern from bough.
  rect(c,72,44,2,30,'#937755');rect(c,67,73,13,17,'#302e36');
  rect(c,69,76,9,10,'#e1ab62');rect(c,71,77,5,9,'#ffe6a4');
  rect(c,66,90,15,3,'#191c2c');
  rect(c,20,180,30,3,'#64a059');
  for(let i=0;i<20;i++)rect(c,r()*80,172+r()*30,3+r()*5,2,'#39664a');
}
function hero(c: Ctx) {
  // 64×88 heroic portrait sprite; original pixel character inspired by Ramin's short dark hair and black hoodie.
  // feet/body and hood
  rect(c,16,76,12,12,'#101b24');rect(c,38,76,12,12,'#101b24');
  rect(c,17,84,15,4,'#efefed');rect(c,38,84,15,4,'#efefed');
  ellipse(c,32,71,27,22,'#0b161e');
  rect(c,10,57,44,30,'#131a26');
  rect(c,16,62,31,24,'#171d27');
  rect(c,21,55,23,12,'#27303b');
  // dark hood collar
  ellipse(c,32,56,22,13,'#090f17');
  ellipse(c,32,52,16,10,'#28303b');
  // arms, sleeve shading, hands
  rect(c,6,60,10,19,'#0b141d');rect(c,48,60,11,19,'#0b141d');
  rect(c,9,65,4,9,'#30323a');rect(c,50,64,3,9,'#30323a');
  rect(c,12,76,9,7,'#e6a47b');rect(c,44,76,9,7,'#e6a47b');
  // ears
  rect(c,14,34,5,10,'#d08b66');rect(c,46,34,5,10,'#d08b66');
  rect(c,16,36,3,8,'#f2bd96');rect(c,46,36,3,8,'#f2bd96');
  // face with square jagged silhouette at pixel edges
  rect(c,20,14,24,35,'#dc9d77');
  rect(c,17,23,30,22,'#e7a985');
  rect(c,19,19,27,26,'#f0bc96');
  rect(c,21,25,24,22,'#f6c8a1');
  rect(c,24,46,17,6,'#e5a37f');
  // forehead and fringe
  rect(c,18,18,29,6,'#272127');
  rect(c,19,13,25,9,'#29252a');
  rect(c,24,9,20,8,'#26272c');
  rect(c,30,6,12,5,'#27252b');
  rect(c,36,9,8,4,'#171a20');
  rect(c,17,22,5,5,'#2d2729');
  rect(c,43,21,4,6,'#2d2729');
  rect(c,20,15,9,3,'#403035');
  // soft eyebrows and lively dark eyes
  rect(c,22,28,8,2,'#65453b');rect(c,36,28,8,2,'#65453b');
  rect(c,24,32,4,3,'#271f29');rect(c,38,32,4,3,'#271f29');
  rect(c,25,32,1,1,'#faf4de');rect(c,39,32,1,1,'#faf4de');
  // nose and smiling bare lip (target at y=42)
  rect(c,31,36,3,5,'#dc9a78');rect(c,29,40,7,2,'#ce8b6d');
  rect(c,26,47,14,1,'#925b57');rect(c,28,48,10,1,'#ae7470');
  // hoodie highlights and tiny embroidered N5 pixels
  rect(c,25,64,2,13,'#747783');rect(c,41,64,2,13,'#747783');
  rect(c,29,72,8,2,'#9678db');rect(c,29,76,3,3,'#d8bc6f');rect(c,34,76,3,3,'#d8bc6f');
  rect(c,18,81,30,5,'#111521');
}
function mustache(c: Ctx, style: number) {
  // Each style uses a very readable silhouette against the face, pixel-indexed canvas 38x18.
  const dark='#11141e', glint='#31303d';
  const segments: Array<[number,number,number,number]> = style===1 ?
    [[3,8,9,3],[1,6,5,3],[9,9,10,3],[17,8,5,4],[21,9,9,3],[29,8,7,3],[32,5,5,4],[15,7,8,2]] :
    style===2 ? [[1,5,9,5],[5,9,11,3],[13,8,12,4],[24,9,10,3],[31,6,7,5],[1,4,4,2],[34,3,3,4],[17,6,5,3]] :
    [[3,6,8,4],[2,3,4,5],[8,7,9,5],[15,8,9,4],[21,7,10,5],[29,6,7,4],[33,2,4,6],[17,6,5,2]];
  for(const [x,y,w,h] of segments)rect(c,x,y,w,h,dark);
  rect(c,10,6,5,1,glint);rect(c,24,6,5,1,glint);
  rect(c,16,10,6,2,dark);
}
function icon(c:Ctx){
  ellipse(c,20,20,19,19,'#8a551c');ellipse(c,20,19,17,17,'#ffc450');ellipse(c,20,19,13,13,'#d79a32');
  c.strokeStyle='#ffefad';c.lineWidth=2;c.strokeRect(10,11,20,15);
  rect(c,12,14,4,10,'#fff0b3');rect(c,16,14,4,3,'#fff0b3');rect(c,19,18,3,3,'#fff0b3');rect(c,24,13,4,10,'#fff0b3');
}
export function createArt(scene: Phaser.Scene) {
  makeCanvas(scene,'forest',SW,SH,forestBackground);
  makeCanvas(scene,'tree',92,206,trunk);
  makeCanvas(scene,'ramin',64,88,hero);
  makeCanvas(scene,'coin',40,40,icon);
  for(let style=0;style<3;style++)makeCanvas(scene,`stache-${style}`,38,18,ctx=>mustache(ctx,style));
}
