(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const TILE = 32, W = 24, H = 16;
  const creatures = {
    spriglet: { name:'Spriglet', type:'Leaf', icon:'✿', color:'#78a56a', hp:26, attack:7 },
    bubbun: { name:'Bubbun', type:'Water', icon:'◉', color:'#69a9aa', hp:28, attack:6 },
    cindercub: { name:'Cindercub', type:'Ember', icon:'☼', color:'#d99559', hp:24, attack:8 },
    mossling: { name:'Mossling', type:'Leaf', icon:'❋', color:'#83a65e', hp:18, attack:5 },
    pebblit: { name:'Pebblit', type:'Earth', icon:'⬟', color:'#ba9875', hp:22, attack:6 },
    dewfin: { name:'Dewfin', type:'Water', icon:'❧', color:'#72b3b0', hp:20, attack:5 },
    puffern: { name:'Puffern', type:'Air', icon:'✿', color:'#c4a4b8', hp:16, attack:4 }
  };
  const defaultState = () => ({ day:1, x:10, y:13, direction:'down', energy:100, coins:24, seeds:5, charms:3, starter:null, party:[], plots:Array.from({length:6},()=>({crop:null,planted:0,watered:false})), plantedAny:false, caughtAny:false });
  let state = defaultState();
  try { const s=JSON.parse(localStorage.getItem('mosslight-save')); if(s&&s.starter){state={...defaultState(),...s}; if(!Array.isArray(state.plots)||state.plots.length!==6)state.plots=defaultState().plots;} } catch(e){}
  let keys={}, lastMove=0, toastTimer, battle=null, soundOn=false;
  const plots=[{x:8,y:10},{x:9,y:10},{x:10,y:10},{x:8,y:11},{x:9,y:11},{x:10,y:11}];
  const tallGrass=[]; for(let y=4;y<=8;y++)for(let x=14;x<=20;x++) if(!((x===14&&y===4)||(x===20&&y===8)))tallGrass.push(`${x},${y}`);
  const solid=new Set();
  for(let y=2;y<=5;y++)for(let x=3;x<=7;x++)solid.add(`${x},${y}`);
  for(let y=3;y<=5;y++)for(let x=16;x<=18;x++)solid.add(`${x},${y}`); // pond
  const $=id=>document.getElementById(id);
  const save=()=>{try{localStorage.setItem('mosslight-save',JSON.stringify(state));}catch(e){} updateUI();};
  function toast(text){const el=$('toast');el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2100)}
  function updateUI(){
    $('dayNumber').textContent=state.day; $('seasonDay').textContent=state.day; $('footerYear').textContent=String(state.day).padStart(2,'0');
    const energy=Math.max(0,Math.min(100,Number(state.energy.toFixed(1)))); $('energyText').textContent=`${energy} / 100`; $('energyBar').style.width=`${energy}%`;
    $('seedCount').textContent=state.seeds; $('charmCount').textContent=state.charms; $('coinCount').textContent=state.coins;
    $('partyCount').textContent=`${String(state.party.length).padStart(2,'0')} / 06`;
    $('partyList').innerHTML=state.party.length?state.party.map((c,i)=>`<div class="buddy-row"><div class="buddy-avatar" style="color:${c.color}">${c.icon}</div><div class="buddy-info"><b>${c.name}${i===0?' · companion':''}</b><small>${c.type} spirit</small></div><div class="buddy-hp">${c.currentHp||c.hp} HP</div></div>`).join(''):'<div class="empty-buddy">Choose a companion to begin ✦</div>';
    const progress=(state.plantedAny?1:0)+(state.caughtAny?1:0); $('questBar').style.width=`${progress*50}%`; $('questText').textContent=`${progress} of 2 happy beginnings`;
    $('starterScreen').classList.toggle('hidden',!!state.starter);
  }
  function roundRect(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}}
  function hash(x,y){return (x*37+y*91+x*y*13)%17}
  function drawTile(x,y){
    const n=hash(x,y), px=x*TILE, py=y*TILE;
    let color=n<6?'#86ad79':n<12?'#8bb17c':'#84aa75';
    ctx.fillStyle=color;ctx.fillRect(px,py,TILE,TILE);
    // soft tile variation
    if(n===0){ctx.fillStyle='#9bbd86';ctx.fillRect(px+4,py+7,2,2);ctx.fillRect(px+23,py+24,2,2)}
    if(n===4){ctx.fillStyle='#729b6c';ctx.fillRect(px+10,py+20,2,4);ctx.fillRect(px+14,py+18,2,6)}
    // paths winding through yard
    const path=(x>=8&&x<=10&&y>=12)||(x>=8&&x<=10&&y===9)||(x>=8&&x<=9&&y===8)||(x>=5&&x<=10&&y>=6&&y<=7)||(x===10&&y>=7&&y<=9)||(x>=10&&x<=14&&y===8)||(x>=12&&x<=13&&y>=8&&y<=12)||(x>=3&&x<=8&&y===12);
    if(path){ctx.fillStyle='#cbbd91';ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle='#d5c9a1';ctx.fillRect(px+2,py+3,28,2);if(n%3===0){ctx.fillStyle='#b9aa81';ctx.fillRect(px+22,py+19,3,2)}}
    // shadowed meadow grass
    if(tallGrass.includes(`${x},${y}`)){ctx.fillStyle='#669666';ctx.fillRect(px,py,TILE,TILE);for(let i=0;i<5;i++){const gx=px+4+(i*11)%25,gy=py+13+(i*9)%13;ctx.fillStyle=i%2?'#8fbd76':'#a3c77a';ctx.beginPath();ctx.moveTo(gx-4,gy+9);ctx.lineTo(gx,gy-7-(i%3)*2);ctx.lineTo(gx+4,gy+9);ctx.fill()}ctx.fillStyle='#76a46e';ctx.fillRect(px+2,py+27,28,3)}
  }
  function flower(x,y,color){const px=x*TILE+16,py=y*TILE+17;ctx.fillStyle='#61885c';ctx.fillRect(px-1,py,2,11);ctx.fillStyle=color;for(let i=0;i<5;i++){let a=i*Math.PI*2/5;ctx.beginPath();ctx.arc(px+Math.cos(a)*4,py+Math.sin(a)*4,3,0,Math.PI*2);ctx.fill()}ctx.fillStyle='#f4d36d';ctx.fillRect(px-2,py-2,4,4)}
  function drawHouse(){const x=3*TILE,y=2*TILE;ctx.fillStyle='#536b4a';ctx.fillRect(x+4,y+29,166,105);ctx.fillStyle='#f0dfb8';ctx.fillRect(x+11,y+38,152,91);ctx.fillStyle='#b87859';ctx.beginPath();ctx.moveTo(x-3,y+42);ctx.lineTo(x+86,y-10);ctx.lineTo(x+177,y+42);ctx.closePath();ctx.fill();ctx.fillStyle='#d18c66';ctx.beginPath();ctx.moveTo(x+86,y-10);ctx.lineTo(x+177,y+42);ctx.lineTo(x+162,y+42);ctx.lineTo(x+84,y+1);ctx.closePath();ctx.fill();ctx.fillStyle='#6b5144';ctx.fillRect(x+66,y+71,33,58);ctx.fillStyle='#e7c888';ctx.fillRect(x+70,y+75,25,48);ctx.fillStyle='#8c7457';ctx.fillRect(x+88,y+100,3,3);ctx.fillStyle='#8bc1b4';ctx.fillRect(x+25,y+53,25,24);ctx.fillRect(x+117,y+53,25,24);ctx.fillStyle='#f6e8c6';ctx.fillRect(x+29,y+57,17,16);ctx.fillRect(x+121,y+57,17,16);ctx.fillStyle='#a5c6b7';ctx.fillRect(x+37,y+57,2,16);ctx.fillRect(x+29,y+64,17,2);ctx.fillRect(x+129,y+57,2,16);ctx.fillRect(x+121,y+64,17,2);ctx.fillStyle='#795b43';ctx.fillRect(x+75,y-3,23,20);ctx.fillStyle='#b87054';ctx.fillRect(x+72,y-4,29,5);ctx.fillStyle='#66845a';ctx.fillRect(x+4,y+130,167,5);}
  function drawPond(){const x=16*TILE,y=3*TILE;ctx.fillStyle='#5e8969';ctx.fillRect(x-2,y+2,100,100);ctx.fillStyle='#6da9a0';ctx.beginPath();ctx.ellipse(x+48,y+52,46,43,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#83c1b2';ctx.beginPath();ctx.ellipse(x+44,y+45,33,26,-.2,0,Math.PI*2);ctx.fill();ctx.fillStyle='#b3d6b7';ctx.fillRect(x+28,y+30,14,2);ctx.fillRect(x+45,y+47,12,2);ctx.fillStyle='#518a68';ctx.fillRect(x+9,y+19,9,3);ctx.fillRect(x+79,y+76,9,3);ctx.fillStyle='#9bbd74';ctx.fillRect(x+6,y+9,3,10);ctx.fillRect(x+86,y+78,3,10);}
  function drawGarden(){plots.forEach((p,i)=>{const a=state.plots[i],x=p.x*TILE,y=p.y*TILE;ctx.fillStyle='#755b43';ctx.fillRect(x+1,y+4,30,24);ctx.fillStyle='#926b49';ctx.fillRect(x+2,y+6,28,19);ctx.fillStyle='#684f3d';ctx.fillRect(x+2,y+6,28,3);ctx.fillRect(x+2,y+22,28,3);if(a.crop){ctx.fillStyle=a.watered?'#473f30':'#514533';ctx.fillRect(x+4,y+8,24,14);if(a.crop==='turnip'){ctx.fillStyle='#6b9b61';ctx.fillRect(x+13,y+10,3,6);ctx.fillRect(x+10,y+11,4,2);ctx.fillRect(x+15,y+9,4,3);ctx.fillStyle='#e9e4ca';ctx.fillRect(x+10,y+15,10,7);ctx.fillStyle='#c1b99a';ctx.fillRect(x+13,y+21,3,2)}else{ctx.fillStyle='#78a964';ctx.fillRect(x+13,y+11,5,10);ctx.fillRect(x+8,y+13,7,3);ctx.fillRect(x+16,y+14,7,3);ctx.fillStyle='#94bd70';ctx.fillRect(x+14,y+8,4,5)}if(a.watered){ctx.fillStyle='#7dbac0';ctx.fillRect(x+4,y+7,2,2);ctx.fillRect(x+26,y+19,2,2)}}else{ctx.fillStyle='#b18b5d';ctx.fillRect(x+8,y+11,4,2);ctx.fillRect(x+19,y+17,4,2)}})}
  function drawSign(){let x=9*TILE,y=12*TILE;ctx.fillStyle='#69503b';ctx.fillRect(x+14,y+12,5,20);ctx.fillStyle='#9c754c';ctx.fillRect(x+5,y+5,23,13);ctx.fillStyle='#d9c18c';ctx.fillRect(x+7,y+7,19,9);ctx.fillStyle='#71835e';ctx.font='9px monospace';ctx.fillText('?',x+14,y+15)}
  function drawTree(x,y){const px=x*TILE,py=y*TILE;ctx.fillStyle='#6c8053';ctx.fillRect(px+13,py+20,8,17);ctx.fillStyle='#527b53';ctx.fillRect(px+4,py+9,25,17);ctx.fillStyle='#68905d';ctx.fillRect(px+7,py+4,20,19);ctx.fillStyle='#7ca46b';ctx.fillRect(px+10,py+7,10,6);ctx.fillStyle='#a6be81';ctx.fillRect(px+9,py+3,5,3)}
  function drawCreature(x,y,c,scale=1){const px=x,py=y;ctx.save();ctx.translate(px,py);ctx.scale(scale,scale);ctx.fillStyle='#253d2b33';ctx.beginPath();ctx.ellipse(0,10,12,4,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=c.color;ctx.beginPath();ctx.ellipse(0,0,10,11,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(-7,-6);ctx.lineTo(-8,-15);ctx.lineTo(-1,-10);ctx.fill();ctx.beginPath();ctx.moveTo(6,-6);ctx.lineTo(9,-14);ctx.lineTo(2,-10);ctx.fill();ctx.fillStyle='#fff7e2';ctx.fillRect(-6,-3,4,5);ctx.fillRect(2,-3,4,5);ctx.fillStyle='#344333';ctx.fillRect(-4,-2,2,3);ctx.fillRect(3,-2,2,3);ctx.fillStyle='#f5f0d7';ctx.fillRect(-2,4,4,2);if(c.type==='Leaf'){ctx.fillStyle='#a5ca76';ctx.fillRect(-2,-13,4,5)}else if(c.type==='Ember'){ctx.fillStyle='#f2be68';ctx.fillRect(-2,-14,4,6)}else if(c.type==='Water'){ctx.fillStyle='#c1e3d6';ctx.fillRect(-2,-13,4,4)}ctx.restore()}
  function drawPlayer(){let px=state.x*TILE+16,py=state.y*TILE+22;ctx.fillStyle='#253d2d44';ctx.beginPath();ctx.ellipse(px,py+5,10,4,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#536a4a';ctx.fillRect(px-7,py-5,14,11);ctx.fillStyle='#e8b88b';ctx.fillRect(px-6,py-14,12,10);ctx.fillStyle='#6b4937';ctx.fillRect(px-7,py-16,14,5);ctx.fillRect(px-7,py-12,3,4);ctx.fillStyle='#f4e3bf';ctx.fillRect(px-7,py-5,14,4);ctx.fillStyle='#b9c68a';ctx.fillRect(px-8,py+5,5,5);ctx.fillRect(px+3,py+5,5,5);ctx.fillStyle='#273e33';if(state.direction==='down'){ctx.fillRect(px-3,py-10,2,2);ctx.fillRect(px+2,py-10,2,2)}else{ctx.fillRect(px+(state.direction==='left'?-4:2),py-10,2,2)}}
  function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);for(let y=0;y<H;y++)for(let x=0;x<W;x++)drawTile(x,y);drawHouse();drawPond();drawGarden();drawSign();[[1,8],[2,9],[22,3],[21,11],[2,14],[19,12],[12,3],[22,14]].forEach(t=>drawTree(...t));[[1,7,'#f1d582'],[2,11,'#e7a5a2'],[11,5,'#edd387'],[14,11,'#e9b5b4'],[21,9,'#efdc87'],[11,14,'#e2a8ae']].forEach(a=>flower(...a));
    // small mailbox and cottage marker
    ctx.fillStyle='#75553b';ctx.fillRect(7*TILE+22,7*TILE+6,4,23);ctx.fillStyle='#c8815e';ctx.fillRect(7*TILE+16,7*TILE+3,18,12);ctx.fillStyle='#f3dfae';ctx.fillRect(7*TILE+20,7*TILE+6,10,5);
    if(state.party.length){let buddy=creatures[state.party[0].key]||creatures.spriglet;drawCreature(state.x*TILE+16,state.y*TILE+27,buddy,.55)}drawPlayer();
    // directional marker
    ctx.fillStyle='#f7edc4';ctx.globalAlpha=.85;ctx.font='12px serif';ctx.fillText('✦',state.x*TILE+27,state.y*TILE+11);ctx.globalAlpha=1;
  }
  function nearestPlot(){let best=-1,dist=99;plots.forEach((p,i)=>{const d=Math.abs(p.x-state.x)+Math.abs(p.y-state.y);if(d<=1&&d<dist){best=i;dist=d}});return best}
  function interact(){if(battle)return;
    if(Math.abs(state.x-6)<=1&&state.y>=5&&state.y<=6){toast('Fernhollow Cottage — your cozy home is right here!');return}
    if(state.x===9&&state.y===12){toast('Auntie’s note: “Plant a moon seed in a garden bed.”');return}
    const pi=nearestPlot();if(pi>=0){const p=state.plots[pi];if(!p.crop){if(state.seeds<=0){toast('You’re out of moon seeds. Harvest crops to find more!');return}p.crop='turnip';p.planted=state.day;p.watered=false;state.seeds--;state.energy=Math.max(0,state.energy-2);state.plantedAny=true;toast('Moon seed planted! Water it and let a day pass.');save();return}
      if(state.day-p.planted>=2){state.coins+=9;state.seeds++;p.crop=null;p.watered=false;toast('A moon turnip, fresh from the earth! +9 coins and a seed.');save();return}
      if(!p.watered){p.watered=true;state.energy=Math.max(0,state.energy-1);toast('A little drink for your seedling. Come back after a couple of days!');save();return}
      toast(`Your seedling is growing happily. ${Math.max(1,2-(state.day-p.planted))} more day(s) to harvest.`);return;
    }
    if(state.x>=14&&state.x<=20&&state.y>=3&&state.y<=8){toast('The meadow rustles softly. Wander through the tall grass to meet a wild friend!');return}
    toast('Nothing to do here just yet. Explore the meadow or visit your garden.');
  }
  function canWalk(x,y){if(x<0||x>=W||y<0||y>=H||solid.has(`${x},${y}`))return false;return true}
  function move(dx,dy,dir){if(battle||!state.starter)return;const now=Date.now();if(now-lastMove<115)return;lastMove=now;state.direction=dir;const nx=state.x+dx,ny=state.y+dy;if(!canWalk(nx,ny))return;state.x=nx;state.y=ny;state.energy=Math.max(0,state.energy-0.15);if(tallGrass.includes(`${nx},${ny}`)&&Math.random()<.14)startBattle();save()}
  function startBattle(){const pool=['mossling','pebblit','dewfin','puffern'];const key=pool[Math.floor(Math.random()*pool.length)];const c=creatures[key];battle={key,enemyHp:c.hp,enemyMax:c.hp,mode:'active'};$('battleScreen').classList.remove('hidden');$('battleActions').classList.remove('hidden');$('battleContinue').classList.add('hidden');$('wildName').textContent=c.name;$('wildArt').textContent=c.icon;$('wildArt').style.color=c.color;$('battleMessage').textContent=`A wild ${c.name} emerged from the meadow!`;refreshBattle()}
  function refreshBattle(){if(!battle)return;const b=state.party[0]||{...creatures[state.starter],currentHp:creatures[state.starter].hp};const e=creatures[battle.key];$('buddyName').textContent=b.name;$('buddyArt').textContent=b.icon;$('buddyArt').style.color=b.color;$('buddyHp').style.width=`${Math.max(0,b.currentHp)/b.hp*100}%`;$('buddyHpText').textContent=`${Math.max(0,b.currentHp)} / ${b.hp} VIGOR`;$('wildHp').style.width=`${Math.max(0,battle.enemyHp)/battle.enemyMax*100}%`;$('wildHpText').textContent=`${Math.max(0,battle.enemyHp)} / ${battle.enemyMax} VIGOR`;$('orbCount').textContent=`${state.charms} dew charms`}
  function finishBattle(message){battle.mode='over';$('battleMessage').textContent=message;$('battleActions').classList.add('hidden');$('battleContinue').classList.remove('hidden');refreshBattle();save()}
  function enemyTurn(){if(!battle||battle.mode!=='active')return;const b=state.party[0];b.currentHp=Math.max(0,b.currentHp-(creatures[battle.key].attack+Math.floor(Math.random()*3)));if(b.currentHp===0){finishBattle(`${b.name} needs a little rest. Your wild friend waves goodbye.`)}else{$('battleMessage').textContent=`${creatures[battle.key].name} sends a soft little bump!`;refreshBattle();save()}}
  $('attackButton').addEventListener('click',()=>{if(!battle||battle.mode!=='active')return;const b=state.party[0];battle.enemyHp=Math.max(0,battle.enemyHp-(b.attack+Math.floor(Math.random()*4)));if(battle.enemyHp===0){state.coins+=5;finishBattle(`${creatures[battle.key].name} is impressed! +5 sun coins.`)}else{refreshBattle();$('battleMessage').textContent=`${b.name} gives a friendly ${b.type.toLowerCase()} sparkle!`;setTimeout(enemyTurn,650)}});
  $('captureButton').addEventListener('click',()=>{if(!battle||battle.mode!=='active')return;if(!state.charms){toast('No dew charms left. Try a gentle Spark!');return}state.charms--;const chance=.42+(1-battle.enemyHp/battle.enemyMax)*.4;if(Math.random()<chance){const c=creatures[battle.key];state.party.push({...c,key:battle.key,currentHp:c.hp});state.caughtAny=true;finishBattle(`${c.name} joined your little found family!`)}else{$('battleMessage').textContent='The dew charm wobbled... not quite yet!';refreshBattle();setTimeout(enemyTurn,650)}});
  $('fleeButton').addEventListener('click',()=>{if(!battle)return;finishBattle('You waved goodbye. There will be more friends to meet!')});
  $('battleContinue').addEventListener('click',()=>{$('battleScreen').classList.add('hidden');battle=null;save()});
  function sleep(){if(Math.abs(state.x-5)>2||state.y<4||state.y>7){toast('Head back to the cottage (the little house) to sleep.');return}state.day++;state.energy=100;state.party.forEach(c=>c.currentHp=c.hp);state.plots.forEach(p=>{if(p.crop)p.watered=true});toast(`Day ${state.day}! Your seedlings are a little taller.`);save()}
  function heal(){if(state.x<3||state.x>8||state.y<2||state.y>7){toast('Rest is free at your cottage. Find the little house!');return}state.party.forEach(c=>c.currentHp=c.hp);state.energy=100;toast('A peaceful rest. Everyone feels better!');save()}
  $('sleepButton').addEventListener('click',sleep);$('healButton').addEventListener('click',heal);$('touchAction').addEventListener('click',interact);$('soundButton').addEventListener('click',()=>{soundOn=!soundOn;$('soundButton').style.color=soundOn?'#b47f45':'';toast(soundOn?'Birdsong turned on in your imagination ♫':'Quiet mode ♫')});
  document.querySelectorAll('.starter-choice').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.starter,c=creatures[key];state.starter=key;state.party=[{...c,key,currentHp:c.hp}];state.x=10;state.y=13;save();toast(`${c.name} is ready to explore with you!`)}));
  document.querySelectorAll('[data-move]').forEach(button=>{const dir=button.dataset.move,coords={up:[0,-1,'up'],down:[0,1,'down'],left:[-1,0,'left'],right:[1,0,'right']}[dir];let timer;const start=e=>{e.preventDefault();move(...coords);timer=setInterval(()=>move(...coords),150)};const end=()=>clearInterval(timer);button.addEventListener('pointerdown',start);button.addEventListener('pointerup',end);button.addEventListener('pointerleave',end);button.addEventListener('pointercancel',end)});
  window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(k===' '||k==='enter'){interact();return}if(k==='1'){toast('Moon seeds selected — stand beside a garden bed and press Space.');return}if(k==='2'){toast('Watering can selected — press Space beside a seedling.');return}if(k==='3'){toast('Dew charms selected — meet a wild friend in the meadow!');return}keys[k]=true;const dir={w:[0,-1,'up'],arrowup:[0,-1,'up'],s:[0,1,'down'],arrowdown:[0,1,'down'],a:[-1,0,'left'],arrowleft:[-1,0,'left'],d:[1,0,'right'],arrowright:[1,0,'right']}[k];if(dir)move(...dir)});
  window.addEventListener('keyup',e=>{delete keys[e.key.toLowerCase()]});
  // Repeated movement while a key remains down (desktop).
  setInterval(()=>{if(!Object.keys(keys).length||battle)return;const k=Object.keys(keys).find(k=>['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k));if(!k)return;const dir={w:[0,-1,'up'],arrowup:[0,-1,'up'],s:[0,1,'down'],arrowdown:[0,1,'down'],a:[-1,0,'left'],arrowleft:[-1,0,'left'],d:[1,0,'right'],arrowright:[1,0,'right']}[k];move(...dir)},135);
  function frame(){draw();requestAnimationFrame(frame)}
  updateUI();frame();
})();
