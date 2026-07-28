'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const ui={intro:document.getElementById('intro'),result:document.getElementById('result'),controls:document.getElementById('controls'),startBtn:document.getElementById('startBtn'),retryBtn:document.getElementById('retryBtn'),resultTitle:document.getElementById('resultTitle'),resultText:document.getElementById('resultText'),loadingText:document.getElementById('loadingText'),stick:document.getElementById('stick'),knob:document.getElementById('knob')};
const W=1000,H=600,FIELD={cx:500,cy:310,rx:425,ry:225,goalT:235,goalB:385,gateDepth:78};
const keys={},input={x:0,y:0,dash:false,kick:false,jump:false,skill:false};
let players=[],slime,score=[0,0],timeLeft=75,running=false,last=0,message='',messageLife=0,shake=0,freeze=0,particles=[],chiefLine='',chiefLife=0;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const norm=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d}};
const rand=(a,b)=>a+Math.random()*(b-a);
const teamColor=t=>t?'#d95757':'#3e9cdc';

function insideEllipse(x,y,margin=0){const rx=FIELD.rx-margin,ry=FIELD.ry-margin;return ((x-FIELD.cx)**2)/(rx*rx)+((y-FIELD.cy)**2)/(ry*ry)<=1;}
function constrainToField(o){const inGate=o.y>FIELD.goalT&&o.y<FIELD.goalB;if(inGate&&o.x<FIELD.cx-FIELD.rx+o.r)return;if(inGate&&o.x>FIELD.cx+FIELD.rx-o.r)return;const rx=FIELD.rx-o.r,ry=FIELD.ry-o.r,dx=o.x-FIELD.cx,dy=o.y-FIELD.cy,q=(dx*dx)/(rx*rx)+(dy*dy)/(ry*ry);if(q>1){const k=1/Math.sqrt(q);o.x=FIELD.cx+dx*k;o.y=FIELD.cy+dy*k;const nx=dx/(rx*rx),ny=dy/(ry*ry),n=norm(nx,ny),dot=o.vx*n.x+o.vy*n.y;if(dot>0){o.vx-=1.75*dot*n.x;o.vy-=1.75*dot*n.y;}}}

class Player{
 constructor(team,x,y,isHuman=false,index=0){Object.assign(this,{team,x,y,isHuman,index,vx:0,vy:0,r:25,faceX:team?-1:1,faceY:0,dashTime:0,dashCd:0,kickCd:0,kickTime:0,jumpT:0,stun:0,skillCd:0,aiThink:0,aiX:0,aiY:0});}
 update(dt){
  this.dashCd=Math.max(0,this.dashCd-dt);this.kickCd=Math.max(0,this.kickCd-dt);this.skillCd=Math.max(0,this.skillCd-dt);this.stun=Math.max(0,this.stun-dt);this.kickTime=Math.max(0,this.kickTime-dt);this.jumpT=Math.max(0,this.jumpT-dt);
  let ix=0,iy=0,actions={};
  if(this.isHuman){ix=input.x+(keys.ArrowRight||keys.d?1:0)-(keys.ArrowLeft||keys.a?1:0);iy=-(input.y)+(keys.ArrowDown||keys.s?1:0)-(keys.ArrowUp||keys.w?1:0);actions={dash:input.dash||keys.Shift,kick:input.kick||keys.j,jump:input.jump||keys.k,skill:input.skill||keys.l};}
  else ({ix,iy,actions}=this.ai(dt));
  if(this.stun<=0){
   if(Math.hypot(ix,iy)>.15){const n=norm(ix,iy);this.faceX=n.x;this.faceY=0;let sp=this.dashTime>0?390:190;this.vx+=n.x*sp*dt*8;this.vy+=n.y*sp*dt*8;}
   if(actions.dash&&this.dashCd<=0){this.dashTime=.22;this.dashCd=.8;burst(this.x,this.y,teamColor(this.team),8);}
   if(actions.jump&&this.jumpT<=0)this.jumpT=.55;
   if(actions.kick&&this.kickCd<=0)this.kick();
   if(actions.skill&&this.skillCd<=0)this.skill();
  }
  this.dashTime=Math.max(0,this.dashTime-dt);const drag=Math.pow(.0008,dt);this.vx*=drag;this.vy*=drag;this.x+=this.vx*dt;this.y+=this.vy*dt;constrainToField(this);
 }
 ai(dt){
  this.aiThink-=dt;if(this.aiThink<=0){this.aiThink=rand(.1,.25);const target=this.index===2?players.find(p=>p.team!==this.team&&p.index===0):slime;let tx=target.x,ty=target.y;if(this.index===1){tx+=(this.team?1:-1)*120;ty+=this.team?90:-90;}const n=norm(tx-this.x,ty-this.y);this.aiX=n.x;this.aiY=n.y;}
  const d=Math.hypot(slime.x-this.x,slime.y-this.y),enemyNear=players.some(p=>p.team!==this.team&&Math.hypot(p.x-this.x,p.y-this.y)<80);
  return{ix:this.aiX,iy:this.aiY,actions:{dash:d>150&&Math.random()<.03,kick:(d<92||enemyNear)&&Math.random()<.16,jump:d<110&&Math.random()<.025,skill:this.skillCd<=0&&Math.random()<.004}};
 }
 kick(){
  this.kickCd=.42;this.kickTime=.18;const sliding=this.dashTime>0,air=this.jumpT>0;let power=sliding?760:air?680:560;if(sliding&&air)power=900;const fx=this.faceX,fy=this.faceY,dx=slime.x-this.x,dy=slime.y-this.y;
  if(Math.hypot(dx,dy)<95+slime.r){const n=norm(dx+fx*25,dy+fy*25);slime.vx+=n.x*power;slime.vy+=n.y*power;slime.wobble+=rand(-2,2);shake=Math.max(shake,sliding?10:6);burst(slime.x,slime.y,'#b9efff',14);}
  for(const p of players){if(p===this||p.team===this.team)continue;const px=p.x-this.x,py=p.y-this.y,n=norm(px,py);if(Math.hypot(px,py)<88&&n.x*fx+n.y*fy>-.1){p.vx+=fx*power*.85;p.vy+=fy*power*.85;p.stun=Math.max(p.stun,sliding?.7:.35);shake=Math.max(shake,8);burst(p.x,p.y,'#fff1a3',10);}}
 }
 skill(){this.skillCd=12;if(this.team===0){freeze=2.2;message='時間停止！';messageLife=1.1;}else{for(const p of players)if(p.team===0)p.stun=Math.max(p.stun,1.6);message='ナイトメア！';messageLife=1.1;}burst(this.x,this.y,'#d98cff',28);}
 draw(){
  const jump=this.jumpT>0?Math.sin((1-this.jumpT/.55)*Math.PI)*28:0,ang=Math.atan2(this.faceY,this.faceX);ctx.save();ctx.translate(this.x,this.y-jump);
  ctx.fillStyle='#0004';ctx.beginPath();ctx.ellipse(0,27+jump,29,10,0,0,Math.PI*2);ctx.fill();
  ctx.rotate(ang);const kicking=this.kickTime>0;
  ctx.fillStyle='#5b3b25';ctx.strokeStyle='#29180e';ctx.lineWidth=4;
  ctx.beginPath();ctx.ellipse(-8,21,19,11,-.2,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.ellipse(kicking?31:13,kicking?4:21,kicking?25:19,11,kicking?-.15:.2,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle=teamColor(this.team);ctx.strokeStyle=this.isHuman?'#ffe45c':'#fff';ctx.lineWidth=this.isHuman?5:3;ctx.beginPath();ctx.roundRect(-19,-8,38,39,10);ctx.fill();ctx.stroke();
  ctx.fillStyle='#f2c895';ctx.strokeStyle='#5d3924';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,-24,18,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#2b1b15';ctx.beginPath();ctx.arc(7,-28,2.5,0,7);ctx.fill();ctx.restore();
  if(this.stun>0){ctx.font='24px sans-serif';ctx.fillText('★',this.x-12,this.y-jump-55);}if(this.skillCd>0){ctx.fillStyle='#0009';ctx.fillRect(this.x-24,this.y+37,48,5);ctx.fillStyle='#d98cff';ctx.fillRect(this.x-24,this.y+37,48*(1-this.skillCd/12),5);}
 }
}

function reset(afterGoal=false){players=[];for(let i=0;i<3;i++){players.push(new Player(0,250,[225,310,395][i],i===0,i));players.push(new Player(1,750,[225,310,395][i],false,i));}slime={x:500,y:310,vx:0,vy:0,r:37,wobble:0,think:rand(1.5,3.5),hop:0};if(afterGoal)for(const p of players)p.stun=.45;message='始めぇぇ！！';messageLife=1;chiefLine='褒美は用意してあるぞー！';chiefLife=2;}
function startGame(){score=[0,0];timeLeft=75;particles=[];freeze=0;running=true;ui.intro.classList.add('hidden');ui.result.classList.add('hidden');ui.controls.classList.remove('hidden');reset();last=performance.now();requestAnimationFrame(loop);}
function endGame(){running=false;ui.controls.classList.add('hidden');ui.result.classList.remove('hidden');const win=score[0]>score[1],draw=score[0]===score[1];ui.resultTitle.textContent=draw?'引き分け！':win?'褒美獲得！':'スライムを押し付けられた…';ui.resultText.textContent=`あなたの村 ${score[0]} － ${score[1]} となり村`;}
function update(dt){if(!running)return;timeLeft-=dt;if(timeLeft<=0)return endGame();messageLife=Math.max(0,messageLife-dt);chiefLife=Math.max(0,chiefLife-dt);shake=Math.max(0,shake-dt*24);const stopped=freeze>0;freeze=Math.max(0,freeze-dt);for(const p of players)if(!stopped||p.team===0)p.update(dt);updateSlime(dt,stopped);collisions();updateParticles(dt);input.dash=input.kick=input.jump=input.skill=false;}
function updateSlime(dt,stopped){if(stopped)return;slime.think-=dt;slime.hop=Math.max(0,slime.hop-dt);if(slime.think<=0){slime.think=rand(1.1,3);const a=rand(0,Math.PI*2),f=rand(60,165);slime.vx+=Math.cos(a)*f;slime.vy+=Math.sin(a)*f;slime.wobble=rand(-3,3);slime.hop=.45;}
 slime.vx*=Math.pow(.12,dt);slime.vy*=Math.pow(.12,dt);slime.x+=slime.vx*dt;slime.y+=slime.vy*dt;slime.wobble*=Math.pow(.05,dt);constrainToField(slime);if(slime.x<-slime.r){score[1]++;goal(1);}else if(slime.x>W+slime.r){score[0]++;goal(0);}}
function goal(team){message='押し込み成功！';messageLife=1.3;chiefLine=team===0?'見事だ！ 褒美に近づいたぞ！':'押し返せー！ まだ終わっておらん！';chiefLife=2.2;shake=18;if(Math.max(...score)>=3)return endGame();reset(true);}
function collisions(){for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++){const a=players[i],b=players[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),min=a.r+b.r;if(d<min){const n=norm(dx,dy),push=(min-d)*.5;a.x-=n.x*push;b.x+=n.x*push;a.y-=n.y*push;b.y+=n.y*push;}}
 for(const p of players){const dx=slime.x-p.x,dy=slime.y-p.y,d=Math.hypot(dx,dy),min=p.r+slime.r;if(d<min){const n=norm(dx,dy),push=min-d;slime.x+=n.x*push;slime.y+=n.y*push;slime.vx+=n.x*80;slime.vy+=n.y*80;}}}
function burst(x,y,color,n){for(let i=0;i<n;i++){const a=rand(0,7),s=rand(50,240);particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.25,.7),color});}}
function updateParticles(dt){for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.94;p.vy*=.94;}particles=particles.filter(p=>p.life>0);}
function draw(){ctx.save();if(shake)ctx.translate(rand(-shake,shake),rand(-shake,shake));drawField();drawChiefs();for(const p of players)p.draw();drawSlime();for(const p of particles){ctx.globalAlpha=Math.min(1,p.life*3);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,5,0,7);ctx.fill();}ctx.globalAlpha=1;drawHud();ctx.restore();}
function drawField(){ctx.fillStyle='#6cad47';ctx.fillRect(0,0,W,H);ctx.fillStyle='#4f8739';for(let x=0;x<W;x+=80)ctx.fillRect(x,0,40,H);ctx.fillStyle='#c9a96a';ctx.beginPath();ctx.ellipse(FIELD.cx,FIELD.cy,FIELD.rx+16,FIELD.ry+16,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#6d4728';ctx.lineWidth=22;ctx.stroke();ctx.fillStyle='#d8bf82';ctx.beginPath();ctx.ellipse(FIELD.cx,FIELD.cy,FIELD.rx-3,FIELD.ry-3,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff8';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(FIELD.cx,FIELD.cy,FIELD.rx-25,FIELD.ry-25,0,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(500,88);ctx.lineTo(500,532);ctx.stroke();ctx.beginPath();ctx.arc(500,310,72,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#4f84a4';ctx.fillRect(0,FIELD.goalT,95,FIELD.goalB-FIELD.goalT);ctx.fillStyle='#a34f4f';ctx.fillRect(905,FIELD.goalT,95,FIELD.goalB-FIELD.goalT);ctx.fillStyle='#6d4728';ctx.fillRect(0,FIELD.goalT-12,95,12);ctx.fillRect(0,FIELD.goalB,95,12);ctx.fillRect(905,FIELD.goalT-12,95,12);ctx.fillRect(905,FIELD.goalB,95,12);ctx.fillStyle='#fff';ctx.font='bold 17px sans-serif';ctx.textAlign='center';ctx.fillText('あなたの村',47,220);ctx.fillText('となり村',953,220);}
function drawChiefs(){drawChief(105,42,0);drawChief(895,42,1);if(chiefLife>0){ctx.fillStyle='#fff';ctx.strokeStyle='#573d28';ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(330,66,340,42,12);ctx.fill();ctx.stroke();ctx.fillStyle='#2c241d';ctx.font='bold 17px sans-serif';ctx.textAlign='center';ctx.fillText(chiefLine,500,93);}}
function drawChief(x,y,team){ctx.save();ctx.translate(x,y);ctx.fillStyle='#f1c798';ctx.strokeStyle='#4b3021';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,21,0,7);ctx.fill();ctx.stroke();ctx.fillStyle='#eee';ctx.beginPath();ctx.arc(0,15,17,0,Math.PI);ctx.fill();ctx.fillStyle=teamColor(team);ctx.fillRect(-22,21,44,14);ctx.fillStyle='#2a1812';ctx.beginPath();ctx.arc(-7,-4,2,0,7);ctx.arc(7,-4,2,0,7);ctx.fill();ctx.restore();}
function drawSlime(){const speed=Math.hypot(slime.vx,slime.vy),squash=clamp(speed/900,0,.3),hop=slime.hop>0?Math.sin((1-slime.hop/.45)*Math.PI)*17:0;ctx.save();ctx.translate(slime.x,slime.y-hop);ctx.rotate(slime.wobble*.08);ctx.scale(1+squash,1-squash);const g=ctx.createRadialGradient(-10,-15,4,0,0,45);g.addColorStop(0,'#e8fbff');g.addColorStop(.35,'#61ccff');g.addColorStop(1,'#0874da');ctx.fillStyle=g;ctx.strokeStyle='#073d92';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(0,4,slime.r,slime.r*.78,0,0,7);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.globalAlpha=.8;ctx.beginPath();ctx.ellipse(-13,-12,10,7,-.5,0,7);ctx.fill();ctx.restore();}
function drawHud(){ctx.fillStyle='#10202be8';ctx.fillRect(330,8,340,52);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='900 28px sans-serif';ctx.fillText(`${score[0]}  -  ${score[1]}`,500,38);ctx.font='bold 15px sans-serif';ctx.fillText(`${Math.ceil(timeLeft)}秒 / 3回押し込み`,500,56);if(messageLife>0){ctx.fillStyle='#fff4a3';ctx.font='900 36px sans-serif';ctx.fillText(message,500,145);}if(freeze>0){ctx.fillStyle='#b9efff';ctx.font='900 25px sans-serif';ctx.fillText(`TIME STOP ${freeze.toFixed(1)}`,500,174);}ctx.textAlign='left';ctx.font='bold 14px sans-serif';ctx.fillStyle='#fff';ctx.fillText('ダッシュ中キック＝スライディング　ジャンプ中キック＝空中キック',18,585);}
function loop(t){if(!running)return;const dt=Math.min(.033,(t-last)/1000);last=t;update(dt);draw();requestAnimationFrame(loop);}

addEventListener('keydown',e=>{keys[e.key]=true;keys[e.key.toLowerCase()]=true;e.preventDefault();});addEventListener('keyup',e=>{keys[e.key]=false;keys[e.key.toLowerCase()]=false;});ui.startBtn.onclick=startGame;ui.retryBtn.onclick=startGame;
let stickId=null;function stickMove(e){const r=ui.stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.32,d=Math.hypot(dx,dy)||1,k=Math.min(1,max/d);input.x=dx/d*k;input.y=dy/d*k;ui.knob.style.transform=`translate(${input.x*max}px,${input.y*max}px)`;}
ui.stick.addEventListener('pointerdown',e=>{stickId=e.pointerId;ui.stick.setPointerCapture(e.pointerId);stickMove(e);});ui.stick.addEventListener('pointermove',e=>{if(e.pointerId===stickId)stickMove(e);});ui.stick.addEventListener('pointerup',e=>{if(e.pointerId===stickId){stickId=null;input.x=input.y=0;ui.knob.style.transform='';}});document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('pointerdown',e=>{input[b.dataset.action]=true;e.preventDefault();}));

const loadingLines=['画像を読み込み中…','村人を招集中…','スライムを捕獲中…','村長が褒美を準備中…','準備完了！'];let loadIndex=0;const loadingTimer=setInterval(()=>{loadIndex++;ui.loadingText.textContent=loadingLines[Math.min(loadIndex,loadingLines.length-1)];if(loadIndex>=loadingLines.length-1){clearInterval(loadingTimer);ui.startBtn.classList.remove('hidden');}},650);
draw();
