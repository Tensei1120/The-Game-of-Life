(function () {
  'use strict';

  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  const isConfigured = !SUPABASE_URL.includes('YOUR_PROJECT_ID');

  const CW=1120, CH=930;
  let SQ_ACROSS = 44;
  let SQ_ALONG  = 44;
  let ROAD_W    = 52;
  const MAX_PLAYERS = 9;
  const MAX_HAPPINESS = 20;
  const MAX_HEALTH    = 20;
  const FORCED_STOPS  = [20, 30, 50, 70, 90];
  const BRANCH_START  = 20, BRANCH_END = 30;
  const PLAYER_COLORS = [
    '#1565c0','#c62828','#2e7d32','#e65100',
    '#6a1b9a','#00838f','#f9a825','#ad1457','#37474f'
  ];

  const EVENTS = [
    { id:1,  minPos:1, maxPos:10, name:'この時間が、ずっと続くと思ってた。', item:'友達', happiness:2 },
    { id:2,  minPos:1, maxPos:10, name:'「はいはい、お母さんが全部悪いのね。お母さんは南極にでも行ってペンギンさん達と仲良く暮らしますから。（プレイヤー名）はお父さんと幸せに暮らして。」', happiness:-3 },
    { id:3,  minPos:1, maxPos:10, name:'昼休み鬼ごっこした！！', item:'友達', happiness:2, health:1 },
    { id:4,  minPos:1, maxPos:10, name:'おかわりじゃんけん5連勝中！！', happiness:1 },
    { id:5,  minPos:1, maxPos:10, name:'牛乳パック潰して先生に怒られた…。', happiness:-1 },
    { id:6,  minPos:1, maxPos:10, name:'「よそはよそ、うちはうち！そんなに（プレイヤー名）の家がいいなら、（プレイヤー名）の家の子になりなさい！」', happiness:-2 },
    { id:7,  minPos:1, maxPos:10, name:'おじいちゃんからお小遣いもらった！！！', money:1, happiness:3 },
    { id:8,  minPos:1, maxPos:10, name:'夏休みおばあちゃん家に行った！！', happiness:3 },
    { id:9,  minPos:1, maxPos:10, name:'ランドセルじゃんけん負けた…。', health:-1 },
    { id:10, minPos:1, maxPos:10, name:'バスケで突き指…。', happiness:-1, health:-2 },
    { id:11, minPos:1, maxPos:10, name:'「別にあいつのことなんて好きじゃねえし！」', item:'好きな人' },
    { id:12, minPos:1, maxPos:10, name:'ドッチボール大会で優勝した！！', item:'友達', happiness:3 },
    { id:13, minPos:1, maxPos:10, name:'スケボーで転んで骨折れた…。でもなんか包帯かっこいいかも！？', happiness:1, health:-4 },
  ];

  const ITEMS = {
    '親のスネ':   { desc:'毎ターン3万円獲得\n幸福度+1・健康度+1',                                          perTurn:{money:3,happiness:1,health:1},  transformAt:{pos:50,into:'親のセワ'} },
    '親のセワ':   { desc:'毎ターン5万円失う・健康度-2\n捨てられない',                                      perTurn:{money:-5,health:-2},            undiscardable:true,  disappearAt:90 },
    '教育ママ':   { desc:'20マス目まで捨てられない\n塾のテキスト・ピアノ・水泳教室を守る\n20マス目で大学ルート強制', undiscardableUntil:20, protects:['塾のテキスト','ピアノ','水泳教室'], forceRoute:{pos:20,route:'uni'} },
    '塾のテキスト':{ desc:'毎ターン幸福度-3\n20マス目で消滅',                                              perTurn:{happiness:-3},                  disappearAt:20 },
    'ピアノ':     { desc:'毎ターン幸福度+1\n捨てると50万円獲得',                                          perTurn:{happiness:1},                   onDiscard:{money:50} },
    '水泳教室':   { desc:'毎ターン健康度+1',                                                              perTurn:{health:1} },
    '貧困家庭':   { desc:'毎ターン1万円失う・健康度-1\n所持金20万円超で消滅\n20マス目で就職ルート強制',   perTurn:{money:-1,health:-1},            disappearIfMoneyAbove:20, forceRoute:{pos:20,route:'job'} },
    '昭和親父':   { desc:'20マス目まで捨てられない\nグローブを守る',                                      undiscardableUntil:20, protects:['グローブ'] },
    'グローブ':   { desc:'毎ターン健康度+1',                                                              perTurn:{health:1} },
  };

  function rollStartItems(){
    const r=Math.random();
    if(r<0.50) return ['親のスネ'];
    if(r<0.70) return [];
    if(r<0.80) return ['教育ママ','塾のテキスト','ピアノ','水泳教室'];
    if(r<0.90) return ['貧困家庭'];
    return ['昭和親父','グローブ'];
  }

  const WAYPOINTS = [
    [ 80,865],[215,878],[365,862],[515,878],[665,862],[820,875],[970,862],
    [1055,790],[1060,695],[1055,600],
    [940,535],[775,518],[615,530],[455,518],[295,530],[145,518],
    [68,450],[72,358],
    [165,290],[325,272],[485,285],[645,272],[805,285],[960,272],
    [1052,205],[1056,122],
    [958,58],[795,44],[630,56],[470,44],[310,56],[158,46],[76,80],
  ];

  let myId = sessionStorage.getItem('gol_pid');
  if (!myId) { myId = crypto.randomUUID(); sessionStorage.setItem('gol_pid', myId); }

  let myName='', roomId='', players=[], isHost=false, playerData={};
  let currentPlayerIndex=0, turnNumber=0, isMyTurn=false, rolling=false, channel=null;
  let pendingRoll = null, pendingCommit = null, prevPlayerData = {};

  function defaultStats(pos=0) {
    return { pos, money:0, happiness:MAX_HAPPINESS, health:MAX_HEALTH,
             items:Array(6).fill(null), job:null, route:null, finished:false };
  }
  function clampStats(st) {
    return { ...st,
      happiness: Math.max(0, Math.min(MAX_HAPPINESS, st.happiness)),
      health:    Math.max(0, Math.min(MAX_HEALTH,    st.health)),
    };
  }
  function getPos(d)   { return typeof d==='object'&&d!==null ? d.pos   : (d??0); }
  function getStats(d) { return typeof d==='object'&&d!==null ? d : defaultStats(d??0); }

  function calcLanding(currentPos, roll) {
    const dest = Math.min(currentPos + roll, 100);
    const stop = FORCED_STOPS.find(s => s > currentPos && s <= dest);
    return stop || dest;
  }

  function perp(angle) { return { nx: -Math.sin(angle), ny: Math.cos(angle) }; }
  function lerp(a, b, t) { return { x: a.x+(b.x-a.x)*t, y: a.y+(b.y-a.y)*t }; }

  // Rounded-corner quadrilateral path
  function tilePath(corners) {
    const r = Math.max(2, SQ_ACROSS * 0.16);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const c  = corners[i];
      const cp = corners[(i+3)%4];
      const cn = corners[(i+1)%4];
      const dpx = cp.x-c.x, dpy = cp.y-c.y;
      const dnx = cn.x-c.x, dny = cn.y-c.y;
      const lp = Math.sqrt(dpx*dpx+dpy*dpy)||1;
      const ln = Math.sqrt(dnx*dnx+dny*dny)||1;
      const rr = Math.min(r, lp*0.42, ln*0.42);
      const p1x = c.x+dpx/lp*rr, p1y = c.y+dpy/lp*rr;
      const p2x = c.x+dnx/ln*rr, p2y = c.y+dny/ln*rr;
      if (i===0) ctx.moveTo(p1x,p1y); else ctx.lineTo(p1x,p1y);
      ctx.quadraticCurveTo(c.x,c.y, p2x,p2y);
    }
    ctx.closePath();
  }

  const squares = buildSquares();

  function buildSquares() {
    const segLens = []; let total = 0;
    for (let i = 1; i < WAYPOINTS.length; i++) {
      const dx = WAYPOINTS[i][0]-WAYPOINTS[i-1][0], dy = WAYPOINTS[i][1]-WAYPOINTS[i-1][1];
      segLens.push(Math.sqrt(dx*dx+dy*dy)); total += segLens[segLens.length-1];
    }
    // 101 squares (0=START … 100=GOAL), 100 intervals
    SQ_ALONG  = total / 100;
    SQ_ACROSS = SQ_ALONG;
    ROAD_W    = SQ_ACROSS + 8;
    const spacing = SQ_ALONG;

    const pts = [];
    for (let n = 0; n <= 100; n++) {
      const target = n * spacing;
      let traveled = 0, seg = 0;
      while (seg < segLens.length-1 && traveled+segLens[seg] < target) traveled += segLens[seg++];
      const t = segLens[seg]>0 ? Math.min((target-traveled)/segLens[seg],1) : 0;
      const p0 = WAYPOINTS[seg], p1 = WAYPOINTS[Math.min(seg+1,WAYPOINTS.length-1)];
      pts.push({
        cx: p0[0]+(p1[0]-p0[0])*t,
        cy: p0[1]+(p1[1]-p0[1])*t,
        angle: Math.atan2(p1[1]-p0[1], p1[0]-p0[0])
      });
    }

    const bounds = [];
    { const p=perp(pts[0].angle); bounds.push({x:pts[0].cx,y:pts[0].cy,nx:p.nx,ny:p.ny}); }
    for (let i=1; i<=100; i++) {
      const mx=(pts[i-1].cx+pts[i].cx)/2, my=(pts[i-1].cy+pts[i].cy)/2;
      const angle=Math.atan2(pts[i].cy-pts[i-1].cy, pts[i].cx-pts[i-1].cx);
      const p=perp(angle);
      bounds.push({x:mx,y:my,nx:p.nx,ny:p.ny});
    }
    { const p=perp(pts[100].angle); bounds.push({x:pts[100].cx,y:pts[100].cy,nx:p.nx,ny:p.ny}); }

    const sqs = [];
    for (let n=0; n<=100; n++) {
      const num=n;
      const isStop=FORCED_STOPS.includes(num), isGoal=num===100;
      const half_h = isGoal?SQ_ACROSS*0.75 : isStop?SQ_ACROSS*0.68 : SQ_ACROSS/2;
      const L=bounds[n], R=bounds[n+1];
      sqs.push({
        num, cx:pts[n].cx, cy:pts[n].cy,
        corners:[
          {x:L.x+L.nx*half_h, y:L.y+L.ny*half_h},
          {x:R.x+R.nx*half_h, y:R.y+R.ny*half_h},
          {x:R.x-R.nx*half_h, y:R.y-R.ny*half_h},
          {x:L.x-L.nx*half_h, y:L.y-L.ny*half_h},
        ]
      });
    }
    return sqs;
  }

  const branchSquares = (function() {
    const sq20=squares[BRANCH_START], sq30=squares[BRANCH_END];
    const cx20=sq20.cx, cy20=sq20.cy, cx30=sq30.cx, cy30=sq30.cy;

    const job = squares.slice(BRANCH_START+1, BRANCH_END).map(sq=>({...sq,route:'job'}));

    // Road angles at the junction squares
    const sq19=squares[BRANCH_START-1], sq31=squares[BRANCH_END+1];
    const a20=Math.atan2(cy20-sq19.cy, cx20-sq19.cx);
    const a30=Math.atan2(sq31.cy-cy30, sq31.cx-cx30);

    // Perpendicular toward canvas center — gives clean S-curve exit/entry
    function perpToCenter(angle, px, py) {
      const cwx=Math.sin(angle), cwy=-Math.cos(angle);
      const dot=cwx*(CW/2-px)+cwy*(CH/2-py);
      return dot>=0 ? {px:cwx,py:cwy} : {px:-cwx,py:-cwy};
    }
    const p20=perpToCenter(a20,cx20,cy20);
    const p30raw=perpToCenter(a30,cx30,cy30);
    // cp2 must lie on the sq20 side of sq30 so the bezier doesn't overshoot
    const toSq20x=cx20-cx30, toSq20y=cy20-cy30;
    const p30=(p30raw.px*toSq20x+p30raw.py*toSq20y>=0)
      ? p30raw : {px:-p30raw.px, py:-p30raw.py};

    const chordLen=Math.sqrt((cx30-cx20)**2+(cy30-cy20)**2);
    const exitLen=chordLen*0.58;
    const cp1x=cx20+p20.px*exitLen, cp1y=cy20+p20.py*exitLen;
    const cp2x=cx30+p30.px*exitLen, cp2y=cy30+p30.py*exitLen;

    function bezierPt(t) {
      const u=1-t;
      return {
        x: u*u*u*cx20+3*u*u*t*cp1x+3*u*t*t*cp2x+t*t*t*cx30,
        y: u*u*u*cy20+3*u*u*t*cp1y+3*u*t*t*cp2y+t*t*t*cy30
      };
    }

    const SAMPLES=600;
    const arc=[{t:0,len:0}]; let arcTotal=0;
    for (let i=1;i<=SAMPLES;i++) {
      const p0=bezierPt((i-1)/SAMPLES), p1=bezierPt(i/SAMPLES);
      arcTotal+=Math.sqrt((p1.x-p0.x)**2+(p1.y-p0.y)**2);
      arc.push({t:i/SAMPLES,len:arcTotal});
    }
    function tAtLen(len) {
      let lo=0,hi=arc.length-1;
      while(lo<hi-1){const mid=(lo+hi)>>1;arc[mid].len<len?lo=mid:hi=mid;}
      const a=arc[lo],b=arc[hi];
      return b.len===a.len?a.t:a.t+(b.t-a.t)*(len-a.len)/(b.len-a.len);
    }

    const steps=BRANCH_END-BRANCH_START, uniSpacing=arcTotal/steps;
    const allPts=[{cx:cx20,cy:cy20}];
    for (let i=1;i<steps;i++) { const pt=bezierPt(tAtLen(i*uniSpacing)); allPts.push({cx:pt.x,cy:pt.y}); }
    allPts.push({cx:cx30,cy:cy30});

    const bounds=[];
    for (let i=0;i<=9;i++) {
      const mx=(allPts[i].cx+allPts[i+1].cx)/2, my=(allPts[i].cy+allPts[i+1].cy)/2;
      const angle=Math.atan2(allPts[i+1].cy-allPts[i].cy, allPts[i+1].cx-allPts[i].cx);
      const p=perp(angle);
      bounds.push({x:mx,y:my,nx:p.nx,ny:p.ny});
    }

    const half_h=SQ_ACROSS/2;
    const uni=[];
    for (let i=0;i<9;i++) {
      const L=bounds[i],R=bounds[i+1];
      uni.push({
        num:BRANCH_START+i+1, cx:allPts[i+1].cx, cy:allPts[i+1].cy,
        corners:[
          {x:L.x+L.nx*half_h,y:L.y+L.ny*half_h},
          {x:R.x+R.nx*half_h,y:R.y+R.ny*half_h},
          {x:R.x-R.nx*half_h,y:R.y-R.ny*half_h},
          {x:L.x-L.nx*half_h,y:L.y-L.ny*half_h},
        ],
        route:'uni'
      });
    }

    // Arc peak (t=0.5) and outward bow direction for label placement
    const peakX=0.125*cx20+0.375*cp1x+0.375*cp2x+0.125*cx30;
    const peakY=0.125*cy20+0.375*cp1y+0.375*cp2y+0.125*cy30;
    const abx=(p20.px+p30.px)/2, aby=(p20.py+p30.py)/2;
    const abl=Math.sqrt(abx*abx+aby*aby)||1;
    const bx=abx/abl, by=aby/abl;

    return {job,uni,cp1x,cp1y,cp2x,cp2y,cx20,cy20,cx30,cy30,bx,by,peakX,peakY};
  })();

  function getBranchSq(pos,route) {
    if(pos>BRANCH_START&&pos<BRANCH_END&&route)
      return (branchSquares[route]||[]).find(s=>s.num===pos)||null;
    return null;
  }

  const $=id=>document.getElementById(id);
  function fadeOut(el,cb){el.classList.add('fade-out');setTimeout(()=>{el.classList.add('hidden');cb&&cb();},500);}
  function fadeIn(el){el.classList.remove('hidden');requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('visible')));}
  const SCREENS=['title-screen','word-screen','lobby-screen','game-screen'];
  function showScreen(id){SCREENS.forEach(sid=>{const el=$(sid);if(sid===id)fadeIn(el);else if(!el.classList.contains('hidden'))fadeOut(el);});}

  $('btn-go').addEventListener('click',()=>showScreen('word-screen'));
  const nameInput=$('name-input'),wordInput=$('word-input'),wordError=$('word-error');
  $('btn-create').addEventListener('click',enterRoom);
  nameInput.addEventListener('keydown',e=>e.key==='Enter'&&wordInput.focus());
  wordInput.addEventListener('keydown',e=>e.key==='Enter'&&enterRoom());

  async function enterRoom() {
    if(!isConfigured){wordError.innerHTML='Supabaseが未設定です。<br>config.jsを書き換えてください。';return;}
    const name=nameInput.value.trim(),word=wordInput.value.trim();
    if(!name){wordError.textContent='名前を入力してください';nameInput.focus();return;}
    if(!word){wordError.textContent='あいことばを入力してください';wordInput.focus();return;}
    wordError.textContent='';
    const btn=$('btn-create'); btn.disabled=true; btn.textContent='接続中...';
    myName=name; roomId=word.toLowerCase().replace(/\s+/g,'-');
    try {
      const {data:existing,error:fe}=await sb.from('rooms').select('id,host_id,status,created_at').eq('id',roomId).maybeSingle();
      if(fe)throw fe;
      let roomData=existing;
      if(roomData){
        const ageMs=Date.now()-new Date(roomData.created_at).getTime();
        const isStale=roomData.status==='closed'||(roomData.host_id!==myId&&roomData.status==='waiting'&&ageMs>3*60*1000);
        if(isStale){
          const {error:delErr}=await sb.from('rooms').delete().eq('id',roomId);
          if(delErr){console.warn('DELETE failed:',delErr.message);await sb.from('rooms').update({status:'closed'}).eq('id',roomId);}
          roomData=null;
        }
      }
      if(!roomData){
        const {error}=await sb.from('rooms').insert({id:roomId,host_id:myId,alive_cells:{}});
        if(error)throw error; isHost=true;
      } else {isHost=roomData.host_id===myId;}
      const {data:ep}=await sb.from('room_players').select('player_id,color').eq('room_id',roomId);
      const existingPlayers=ep||[];
      const alreadyIn=existingPlayers.some(p=>p.player_id===myId);
      if(!alreadyIn&&existingPlayers.length>=MAX_PLAYERS){
        wordError.textContent=`このルームは満員です（最大${MAX_PLAYERS}人）`;
        return;
      }
      const usedColors=existingPlayers.map(p=>p.color);
      const myColor=PLAYER_COLORS.find(c=>!usedColors.includes(c))||PLAYER_COLORS[0];
      const {error:pe}=await sb.from('room_players').upsert(
        {room_id:roomId,player_id:myId,player_name:myName,color:myColor,is_host:isHost},
        {onConflict:'room_id,player_id'}
      );
      if(pe)throw pe;
      if(isHost)window.addEventListener('beforeunload',dissolveRoom);
      await refreshPlayers(); subscribeRoom(); showScreen('lobby-screen');
    } catch(err){
      console.error(err);
      const msg=err?.message||'';
      if(msg.includes('Failed to fetch')||msg.includes('NetworkError'))wordError.textContent='ネットワークエラー。';
      else if(msg.includes('Invalid API key')||msg.includes('apikey'))wordError.textContent='APIキーエラー。';
      else wordError.textContent='接続エラー: '+(msg||'コンソールを確認してください。');
    } finally{btn.disabled=false;btn.textContent='ルームに入る';}
  }

  function dissolveRoom(){
    if(!isHost||!roomId)return;
    fetch(`${SUPABASE_URL}/rest/v1/rooms?id=eq.${encodeURIComponent(roomId)}`,{
      method:'DELETE',
      headers:{'apikey':SUPABASE_ANON,'Authorization':`Bearer ${SUPABASE_ANON}`,'Prefer':'return=minimal'},
      keepalive:true,
    });
  }

  async function refreshPlayers(){
    const {data}=await sb.from('room_players').select('*').eq('room_id',roomId).order('joined_at');
    players=data||[]; renderLobby();
  }
  function renderLobby(){
    $('lobby-room-name').textContent='ルーム: '+roomId;
    $('player-list').innerHTML=players.map(p=>`
      <li class="player-item">
        <span class="player-dot" style="background:${p.color}"></span>
        <span class="player-name">${p.player_name}${p.is_host?' 👑':''}${p.player_id===myId?' (自分)':''}</span>
      </li>`).join('');
    const remaining=MAX_PLAYERS-players.length;
    $('lobby-capacity').textContent=`あと${remaining}人参加できます（最大${MAX_PLAYERS}人）`;
    $('btn-lobby-start').style.display=isHost?'block':'none';
    $('lobby-hint').style.display=isHost?'none':'block';
  }
  $('btn-lobby-start').addEventListener('click',async()=>{
    const initData={};
    players.forEach(p=>{
      const st=defaultStats(0);
      const startItems=rollStartItems();
      startItems.forEach((item,i)=>{ if(i<st.items.length) st.items[i]=item; });
      initData[p.player_id]=st;
    });
    await sb.from('rooms').update({status:'playing',alive_cells:initData}).eq('id',roomId);
  });

  function subscribeRoom(){
    channel=sb.channel('room-'+roomId)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'rooms',filter:`id=eq.${roomId}`},p=>onRoomChange(p.new))
      .on('postgres_changes',{event:'DELETE',schema:'public',table:'rooms',filter:`id=eq.${roomId}`},()=>{if(!isHost)showDissolutionOverlay();})
      .on('postgres_changes',{event:'*',schema:'public',table:'room_players',filter:`room_id=eq.${roomId}`},()=>refreshPlayers())
      .subscribe();
  }

  async function onRoomChange(room){
    if(!room)return;
    if(room.status==='playing'||room.status==='finished'){
      const {data}=await sb.from('room_players').select('*').eq('room_id',roomId).order('joined_at');
      players=data||[];
      if($('game-screen').classList.contains('hidden')){
        $('room-badge').textContent='ルーム: '+roomId;
        applyRoomState(room); showScreen('game-screen');
      } else {applyRoomState(room);}
      if(room.status==='finished') showResultScreen();
    }
  }

  function showDissolutionOverlay(){
    $('dissolution-overlay').classList.remove('hidden');
    setTimeout(()=>{
      $('dissolution-overlay').classList.add('hidden');
      roomId='';players=[];isHost=false;playerData={};
      nameInput.value='';wordInput.value='';
      showScreen('title-screen');
    },3000);
  }

  const canvas=$('board-canvas'),ctx=canvas.getContext('2d');
  canvas.width=CW; canvas.height=CH;

  function applyRoomState(room){
    prevPlayerData={...playerData};
    playerData=room.alive_cells||{};
    currentPlayerIndex=room.current_player_index||0;
    turnNumber=room.turn_number||0;
    updateTurnUI(); drawBoard();
    requestAnimationFrame(showStatDeltas);
  }

  function showStatDelta(el,value,unit){
    const s=document.createElement('span');
    s.className='stat-delta '+(value>0?'pos':'neg');
    s.textContent=(value>0?'＋':'－')+Math.abs(value)+(unit||'');
    const r=el.getBoundingClientRect();
    s.style.left=(r.right+4)+'px'; s.style.top=(r.top-2)+'px';
    document.body.appendChild(s);
    setTimeout(()=>s.remove(),1600);
  }
  function showStatDeltas(){
    players.forEach(p=>{
      const prev=getStats(prevPlayerData[p.player_id]);
      const curr=getStats(playerData[p.player_id]);
      const dm=curr.money-prev.money, dh=curr.happiness-prev.happiness, dhp=curr.health-prev.health;
      if(!dm&&!dh&&!dhp) return;
      const sel=s=>`[data-pid="${p.player_id}"][data-stat="${s}"]`;
      if(dm) { const el=document.querySelector(sel('money'));      if(el) showStatDelta(el,dm,'万円'); }
      if(dh) { const el=document.querySelector(sel('happiness'));  if(el) showStatDelta(el,dh,''); }
      if(dhp){ const el=document.querySelector(sel('health'));     if(el) showStatDelta(el,dhp,''); }
    });
  }

  function updateTurnUI(){
    if(!players.length)return;
    const idx=currentPlayerIndex%players.length, cp=players[idx];
    isMyTurn=cp?.player_id===myId;
    const ind=$('turn-indicator');
    if(isMyTurn){ind.textContent='あなたのターンです！';ind.style.color='#228844';}
    else{ind.textContent=(cp?.player_name||'?')+' のターン';ind.style.color=cp?.color||'#1565c0';}
    const myFinished=!!getStats(playerData[myId]).finished;
    const rb=$('btn-roll');
    rb.style.display=(isMyTurn&&!myFinished)?'block':'none';rb.disabled=false;rolling=false;
    $('turn-number').textContent=turnNumber;
    renderPlayerStatusCards(idx);
  }

  function renderPlayerStatusCards(activeIdx){
    $('player-status-area').innerHTML=players.map((p,i)=>{
      const st=getStats(playerData[p.player_id]);
      const routeLabel=st.route==='job'?' 💼就職':st.route==='uni'?' 🎓大学':'';
      const jobLabel=(st.job||'未定')+routeLabel;
      const isMine=p.player_id===myId;
      const itemsHtml=st.items.map(item=>
        item?`<div class="item-slot filled" data-item="${item}">${item}</div>`
            :`<div class="item-slot">∅</div>`
      ).join('');
      return `
        <div class="psc${i===activeIdx?' psc-active':''}${isMine?' psc-mine':''}">
          <div class="psc-header">
            <span class="psc-dot" style="background:${p.color}"></span>
            <span class="psc-name">${p.player_name}${p.is_host?' 👑':''}${isMine?' <span class="psc-self">自分</span>':''}</span>
            ${st.finished?'<span class="psc-goal">🏆ゴール</span>':'<span class="psc-job">💼 '+jobLabel+'</span>'}
          </div>
          <div class="psc-stats">
            <span class="psc-stat">💰 <span class="psc-stat-val" data-pid="${p.player_id}" data-stat="money">${st.money<0?'－'+Math.abs(st.money):st.money}万円</span></span>
            <span class="psc-stat">😊 <span class="psc-stat-val" data-pid="${p.player_id}" data-stat="happiness">${st.happiness}/${MAX_HAPPINESS}</span></span>
            <span class="psc-stat">❤️ <span class="psc-stat-val" data-pid="${p.player_id}" data-stat="health">${st.health}/${MAX_HEALTH}</span></span>
            <span class="psc-stat">📍 <span class="psc-stat-val">${st.pos}マス</span></span>
          </div>
          <div class="psc-items">${itemsHtml}</div>
        </div>`;
    }).join('');
  }

  $('btn-roll').addEventListener('click',async()=>{
    if(!isMyTurn||rolling)return;
    rolling=true; $('btn-roll').disabled=true;
    const roll=Math.floor(Math.random()*6)+1;
    await animateDice(roll);
    const st=getStats(playerData[myId]);
    const newPos=calcLanding(st.pos,roll);
    if(newPos===BRANCH_START&&!st.route){
      const forced=getForcedRoute(st);
      if(forced){
        if(FORCED_STOPS.includes(newPos)&&newPos!==st.pos+roll)showStopMessage(newPos);
        await saveRoll(st,newPos,forced);
        return;
      }
      pendingRoll={st,newPos};
      $('route-overlay').classList.remove('hidden');
      return;
    }
    if(FORCED_STOPS.includes(newPos)&&newPos!==st.pos+roll)showStopMessage(newPos);
    const newRoute=(st.route&&newPos>=BRANCH_END)?null:(st.route||null);
    await saveRoll(st,newPos,newRoute);
  });

  function getForcedRoute(st){
    if(st.items.includes('教育ママ')) return 'uni';
    if(st.items.includes('貧困家庭')) return 'job';
    return null;
  }
  function canDiscard(item,st){
    if(!item) return true;
    const def=ITEMS[item]; if(!def) return true;
    if(def.undiscardable) return false;
    if(def.undiscardableUntil!==undefined&&st.pos<def.undiscardableUntil) return false;
    for(const held of st.items){
      if(!held||held===item) continue;
      if(ITEMS[held]?.protects?.includes(item)) return false;
    }
    return true;
  }
  function applyItemTransformations(st){
    const items=[...st.items]; let changed=false;
    for(let i=0;i<items.length;i++){
      const item=items[i]; if(!item) continue;
      const def=ITEMS[item]; if(!def) continue;
      if(def.transformAt&&st.pos>=def.transformAt.pos){ items[i]=def.transformAt.into; changed=true; }
      else if(def.disappearAt!==undefined&&st.pos>=def.disappearAt){ items[i]=null; changed=true; }
      else if(def.disappearIfMoneyAbove!==undefined&&st.money>def.disappearIfMoneyAbove){ items[i]=null; changed=true; }
    }
    return changed?{...st,items}:st;
  }
  function applyPerTurnEffects(st){
    let money=st.money,happiness=st.happiness,health=st.health;
    for(const item of st.items){
      if(!item) continue;
      const pt=ITEMS[item]?.perTurn; if(!pt) continue;
      if(pt.money)     money     +=pt.money;
      if(pt.happiness) happiness +=pt.happiness;
      if(pt.health)    health    +=pt.health;
    }
    return{...st,money,happiness,health};
  }

  function isEventSquare(pos){
    return pos>0&&pos<100&&!FORCED_STOPS.includes(pos);
  }
  function pickEvent(pos,usedIds){
    const av=EVENTS.filter(e=>pos>=e.minPos&&pos<=e.maxPos&&!usedIds.includes(e.id));
    return av.length?av[Math.floor(Math.random()*av.length)]:null;
  }
  function substitutePlayerName(text,name){
    return text.replace(/（プレイヤー名）|\(プレイヤー名\)/g,name);
  }
  function effectsText(ev){
    const p=[];
    if(ev.item)      p.push(`アイテム「${ev.item}」を獲得！`);
    if(ev.money)     p.push(ev.money>0?`${ev.money}万円 獲得！`:`${Math.abs(ev.money)}万円 失った...`);
    if(ev.happiness) p.push(`幸福度 ${ev.happiness>0?'+':''}${ev.happiness}`);
    if(ev.health)    p.push(`健康度 ${ev.health>0?'+':''}${ev.health}`);
    return p.join('\n');
  }
  function applyEventToStats(st,ev){
    const next={...st};
    if(ev.money)     next.money=st.money+ev.money;
    if(ev.happiness) next.happiness=st.happiness+ev.happiness;
    if(ev.health)    next.health=st.health+ev.health;
    if(ev.item){
      const items=[...st.items];
      const slot=items.indexOf(null);
      if(slot>=0){items[slot]=ev.item;next.items=items;}
      else next._pendingItem=ev.item;
    }
    return next;
  }

  async function animateMove(fromSt, toPos, toRoute) {
    for (let pos = fromSt.pos + 1; pos <= toPos; pos++) {
      const midRoute = (pos > BRANCH_START && pos < BRANCH_END)
        ? (toRoute || fromSt.route || null) : null;
      playerData = {...playerData, [myId]: {...fromSt, pos, route: midRoute}};
      drawBoard();
      await sleep(120);
    }
  }

  async function saveRoll(st,newPos,route){
    const isGoal=newPos===100;
    if(isGoal){ $('dice-result').textContent+='　🏆 ゴール！'; }

    await animateMove(st, newPos, route);
    await arrivalAnimation(newPos, route);

    const newSt=clampStats({...st, pos:newPos,
      route:isGoal?null:(route||null),
      finished:isGoal||!!st.finished});
    playerData={...playerData,[myId]:newSt};
    drawBoard();

    if(!isGoal&&isEventSquare(newPos)){
      const usedIds=Array.isArray(playerData.__used_events)?playerData.__used_events:[];
      const ev=pickEvent(newPos,usedIds);
      if(ev){
        pendingCommit={newSt,newUsedIds:[...usedIds,ev.id],ev};
        await sleep(350);
        showEventOverlay(ev);
        return;
      }
    }
    await doCommitSave(newSt,Array.isArray(playerData.__used_events)?playerData.__used_events:[]);
  }

  function showEventOverlay(ev){
    $('event-name-text').textContent=substitutePlayerName(ev.name,myName);
    $('event-effect-text').textContent=effectsText(ev);
    $('event-overlay').classList.remove('hidden');
  }
  function showDiscardOverlay(currentItems,newItem){
    const st=getStats(playerData[myId]);
    $('discard-items').innerHTML=[...currentItems,newItem].map((item,i)=>{
      const locked=i<6&&!canDiscard(item,st);
      return `<button class="discard-btn${locked?' locked':''}" data-idx="${i}" ${locked?'disabled':''}>${item}${locked?' 🔒':''}</button>`;
    }).join('');
    $('discard-overlay').classList.remove('hidden');
  }

  async function doCommitSave(newSt,newUsedIds){
    newSt=applyItemTransformations(newSt);
    newSt=applyPerTurnEffects(newSt);
    newSt=clampStats(newSt);
    const newData={...playerData,[myId]:newSt};
    newData.__used_events=newUsedIds;
    const finishedCount=players.filter(p=>getStats(newData[p.player_id]).finished).length;
    if(players.length>1&&finishedCount>=players.length-1){
      await sb.from('rooms').update({
        alive_cells:newData, status:'finished',
        current_player_index:currentPlayerIndex, turn_number:turnNumber,
      }).eq('id',roomId);
      return;
    }
    let nextIndex=(currentPlayerIndex+1)%players.length;
    for(let i=0;i<players.length;i++){
      if(!getStats(newData[players[nextIndex].player_id]).finished) break;
      nextIndex=(nextIndex+1)%players.length;
    }
    const wrapped=nextIndex<=currentPlayerIndex;
    await sb.from('rooms').update({
      alive_cells:newData,
      current_player_index:nextIndex,
      turn_number:wrapped?turnNumber+1:turnNumber,
    }).eq('id',roomId);
  }

  $('btn-route-job').addEventListener('click',async()=>{
    $('route-overlay').classList.add('hidden');
    if(!pendingRoll)return;
    const {st,newPos}=pendingRoll; pendingRoll=null;
    await saveRoll(st,newPos,'job');
  });
  $('btn-route-uni').addEventListener('click',async()=>{
    $('route-overlay').classList.add('hidden');
    if(!pendingRoll)return;
    const {st,newPos}=pendingRoll; pendingRoll=null;
    await saveRoll(st,newPos,'uni');
  });

  $('btn-event-ok').addEventListener('click',async()=>{
    $('event-overlay').classList.add('hidden');
    const {newSt,newUsedIds,ev}=pendingCommit;
    let st=applyEventToStats(newSt,ev);
    if(st._pendingItem){
      const pendingItem=st._pendingItem; delete st._pendingItem;
      pendingCommit={newSt:st,newUsedIds,pendingItem};
      showDiscardOverlay(st.items,pendingItem);
      return;
    }
    await doCommitSave(st,newUsedIds);
  });

  $('discard-items').addEventListener('click',async e=>{
    const btn=e.target.closest('.discard-btn:not(.locked)');
    if(!btn)return;
    $('discard-overlay').classList.add('hidden');
    const idx=parseInt(btn.dataset.idx);
    const {newSt,newUsedIds,pendingItem}=pendingCommit;
    let st={...newSt,items:[...newSt.items]};
    if(idx<6){
      const discarded=st.items[idx];
      const onDiscard=ITEMS[discarded]?.onDiscard;
      if(onDiscard?.money) st.money=(st.money||0)+onDiscard.money;
      st.items[idx]=pendingItem;
    }
    await doCommitSave(st,newUsedIds);
  });

  function showStopMessage(pos){
    $('dice-result').textContent+=`　★ ${pos}マスで強制ストップ！`;
  }

  // ── アイテムカード（長押し） ──
  const ITEM_BG = {
    '親のスネ':    'linear-gradient(150deg,#f5d97a 0%,#f0c040 100%)',
    '親のセワ':    'linear-gradient(150deg,#9a8eb0 0%,#6b5f80 100%)',
    '教育ママ':    'linear-gradient(150deg,#6aabee 0%,#3a7ecc 100%)',
    '塾のテキスト':'linear-gradient(150deg,#e8d8b0 0%,#c8b080 100%)',
    'ピアノ':      'linear-gradient(150deg,#4a4a6a 0%,#1e1e38 100%)',
    '水泳教室':    'linear-gradient(150deg,#60d4ee 0%,#1a9ec0 100%)',
    '貧困家庭':    'linear-gradient(150deg,#a0aa98 0%,#6a7462 100%)',
    '昭和親父':    'linear-gradient(150deg,#e8a860 0%,#b86e28 100%)',
    'グローブ':    'linear-gradient(150deg,#7ed87e 0%,#3aaa3a 100%)',
  };
  let ttTimer=null;
  function showItemCard(item){
    const def=ITEMS[item]; if(!def) return;
    $('item-card-name').textContent=item;
    $('item-card-desc').textContent=def.desc;
    const wrap=document.querySelector('.item-card-img-wrap');
    if(wrap) wrap.style.background=ITEM_BG[item]||'linear-gradient(150deg,#c6d9f6 0%,#deeeff 100%)';
    const img=$('item-card-img');
    img.classList.add('hidden');
    img.onload=()=>img.classList.remove('hidden');
    img.onerror=()=>img.classList.add('hidden');
    img.src=`items/${encodeURIComponent(item)}.png`;
    $('item-card-overlay').classList.remove('hidden');
  }
  function hideItemCard(){ $('item-card-overlay').classList.add('hidden'); clearTimeout(ttTimer); }
  function bindItemCard(area){
    area.addEventListener('mousedown',e=>{
      const s=e.target.closest('.item-slot.filled[data-item]'); if(!s)return;
      ttTimer=setTimeout(()=>showItemCard(s.dataset.item),400);
    });
    area.addEventListener('mouseup',()=>clearTimeout(ttTimer));
    area.addEventListener('mouseleave',()=>clearTimeout(ttTimer));
    area.addEventListener('touchstart',e=>{
      const s=e.target.closest('.item-slot.filled[data-item]'); if(!s)return;
      ttTimer=setTimeout(()=>showItemCard(s.dataset.item),400);
    },{passive:true});
    area.addEventListener('touchend',()=>clearTimeout(ttTimer));
    area.addEventListener('touchcancel',()=>clearTimeout(ttTimer));
  }
  $('item-card-overlay').addEventListener('click',hideItemCard);
  bindItemCard($('player-status-area'));

  const DICE_FACE=['⚀','⚁','⚂','⚃','⚄','⚅'];
  async function animateDice(result){
    const el=$('dice-result');
    const disp=$('dice-display');
    const face=$('dice-face-big');
    const stepsEl=$('dice-steps-big');
    el.textContent=''; stepsEl.textContent='';
    disp.classList.remove('hidden','landed'); disp.classList.add('rolling');
    const delays=[35,40,50,60,75,95,120,125];
    for(const d of delays){
      const f=DICE_FACE[Math.floor(Math.random()*6)];
      el.textContent=f; face.textContent=f; await sleep(d);
    }
    face.textContent=DICE_FACE[result-1];
    stepsEl.textContent=result+'マス進む！';
    el.textContent=DICE_FACE[result-1]+'　'+result+'マス進む！';
    disp.classList.remove('rolling'); disp.classList.add('landed');
    await sleep(850);
    disp.classList.add('hidden'); disp.classList.remove('landed');
  }

  async function arrivalAnimation(pos, route){
    const sq=getBranchSq(pos,route)||squares[pos];
    if(!sq)return;
    const p=players.find(pl=>pl.player_id===myId);
    if(!p)return;
    for(const scale of [1.65,1.0,1.35,1.0,1.15,1.0]){
      drawBoard();
      if(scale>1.0) drawPulseToken(sq.cx,sq.cy,p,scale);
      await sleep(90);
    }
  }
  function drawPulseToken(tx,ty,p,scale){
    const R=16*scale;
    ctx.save();
    ctx.globalAlpha=0.55; ctx.beginPath(); ctx.arc(tx,ty,R+10,0,Math.PI*2);
    ctx.strokeStyle=p.color; ctx.lineWidth=4;
    ctx.shadowColor=p.color; ctx.shadowBlur=22; ctx.stroke();
    ctx.globalAlpha=1; ctx.shadowBlur=12; ctx.shadowOffsetY=5;
    ctx.beginPath(); ctx.arc(tx,ty,R,0,Math.PI*2);
    ctx.fillStyle=p.color; ctx.fill(); ctx.restore();
    const tg=ctx.createRadialGradient(tx-R*.3,ty-R*.3,R*.05,tx,ty,R);
    tg.addColorStop(0,'rgba(255,255,255,0.62)'); tg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(tx,ty,R,0,Math.PI*2); ctx.fillStyle=tg; ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.92)'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.arc(tx,ty,R,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle='#fff'; ctx.font=`bold ${Math.round(11*scale)}px Segoe UI`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(p.player_name[0].toUpperCase(),tx,ty);
  }

  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  // ── ボード描画 ──
  function drawBoard(){
    drawSky(); drawMountains();
    drawUniBranchRoad();
    drawRoad();
    squares.forEach(sq=>{
      if(sq.num>BRANCH_START&&sq.num<BRANCH_END)return;
      drawSquare(sq);
    });
    branchSquares.job.forEach(sq=>drawBranchSquare(sq));
    branchSquares.uni.forEach(sq=>drawBranchSquare(sq));
    drawBranchLabels();
    drawTokens();
  }

  function drawUniBranchRoad(){
    const {cp1x,cp1y,cp2x,cp2y,cx20,cy20,cx30,cy30}=branchSquares;
    ctx.save(); ctx.lineJoin='round'; ctx.lineCap='round';
    function bezier(){
      ctx.beginPath(); ctx.moveTo(cx20,cy20);
      ctx.bezierCurveTo(cp1x,cp1y,cp2x,cp2y,cx30,cy30);
    }
    ctx.lineWidth=ROAD_W+14; ctx.strokeStyle='rgba(100,70,30,0.32)'; bezier(); ctx.stroke();
    ctx.lineWidth=ROAD_W+4;  ctx.strokeStyle='#c8a060';              bezier(); ctx.stroke();
    ctx.lineWidth=ROAD_W;    ctx.strokeStyle='#ddb870';              bezier(); ctx.stroke();
    ctx.lineWidth=ROAD_W-8;  ctx.strokeStyle='rgba(255,240,190,0.4)'; bezier(); ctx.stroke();
    ctx.lineWidth=2; ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.setLineDash([12,16]);
    bezier(); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }

  function drawBranchLabels(){
    const j0=branchSquares.job[4];
    if(!j0)return;
    const {peakX,peakY,bx,by}=branchSquares;
    ctx.save();
    ctx.font='bold 11px Segoe UI'; ctx.textAlign='center'; ctx.textBaseline='middle';

    // Job label: above middle job square
    const jx=j0.cx, jy=j0.cy-SQ_ACROSS*0.95;
    ctx.fillStyle='rgba(255,255,255,0.88)';
    ctx.beginPath(); ctx.roundRect(jx-46,jy-10,92,20,6); ctx.fill();
    ctx.fillStyle='#b05010'; ctx.fillText('💼 就職ルート',jx,jy);

    // Uni label: at bezier arc peak, offset outward
    const ux=peakX+bx*SQ_ACROSS*1.1, uy=peakY+by*SQ_ACROSS*1.1;
    ctx.fillStyle='rgba(230,235,255,0.92)';
    ctx.beginPath(); ctx.roundRect(ux-46,uy-10,92,20,6); ctx.fill();
    ctx.fillStyle='#1030b0'; ctx.fillText('🎓 大学ルート',ux,uy);
    ctx.restore();
  }

  function tileGrad(num,corners,isJob,isUni){
    const tx=(corners[0].x+corners[1].x)/2, ty=(corners[0].y+corners[1].y)/2;
    const bx=(corners[2].x+corners[3].x)/2, by=(corners[2].y+corners[3].y)/2;
    const g=ctx.createLinearGradient(tx,ty,bx,by);
    if(isJob)                         {g.addColorStop(0,'#fff3d8');g.addColorStop(1,'#f0c870');}
    else if(isUni)                    {g.addColorStop(0,'#e4eaff');g.addColorStop(1,'#a0b8f8');}
    else if(num===0)                  {g.addColorStop(0,'#c8f0c0');g.addColorStop(1,'#90d080');}
    else if(num===100)                {g.addColorStop(0,'#fff080');g.addColorStop(1,'#f0c020');}
    else if(FORCED_STOPS.includes(num)){g.addColorStop(0,'#ffe0e0');g.addColorStop(1,'#f08888');}
    else if(num%10===0)               {g.addColorStop(0,'#ffe0c0');g.addColorStop(1,'#f0a060');}
    else                              {g.addColorStop(0,'#fffdf5');g.addColorStop(1,'#f0e8d4');}
    return g;
  }
  function tileBorder(num){
    if(num===0)return'#2a8a40'; if(num===100)return'#c89000';
    if(FORCED_STOPS.includes(num))return'#c02020';
    if(num%10===0)return'#d06020'; return'#b89860';
  }

  function drawSquare({num,cx,cy,corners}){
    const isGoal=num===100,isStart=num===0,isStop=FORCED_STOPS.includes(num);
    const h=SQ_ACROSS;
    const fs =Math.max(8, Math.round(h*0.28));
    const fsB=Math.max(9, Math.round(h*0.30));
    const fsE=Math.max(12,Math.round(h*0.38));
    const dy =h*0.20;

    ctx.save();
    ctx.shadowColor='rgba(0,0,0,0.15)'; ctx.shadowBlur=5; ctx.shadowOffsetY=2;
    ctx.fillStyle=tileGrad(num,corners,false,false);
    tilePath(corners); ctx.fill();
    ctx.restore();

    ctx.strokeStyle=tileBorder(num);
    ctx.lineWidth=isGoal||isStart||isStop?2:1.2;
    tilePath(corners); ctx.stroke();

    // Gloss highlight (top 35%)
    ctx.save(); ctx.globalAlpha=0.28; ctx.fillStyle='rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(corners[0].x,corners[0].y);
    ctx.lineTo(corners[1].x,corners[1].y);
    ctx.lineTo(lerp(corners[1],corners[2],0.35).x,lerp(corners[1],corners[2],0.35).y);
    ctx.lineTo(lerp(corners[0],corners[3],0.35).x,lerp(corners[0],corners[3],0.35).y);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    ctx.textAlign='center'; ctx.textBaseline='middle';
    if(isGoal){
      ctx.fillStyle='#8a6000';
      ctx.font=`bold ${fsB}px Segoe UI`; ctx.fillText('GOAL',cx,cy-dy);
      ctx.font=`${fsE}px serif`;          ctx.fillText('🏆',cx,cy+dy);
    } else if(isStart){
      ctx.fillStyle='#1a6030';
      ctx.font=`bold ${fsB}px Segoe UI`; ctx.fillText('START',cx,cy);
    } else if(isStop){
      ctx.fillStyle='#a00000';
      ctx.font=`bold ${fsB}px Segoe UI`;
      ctx.fillText('★STOP',cx,cy-dy*0.7);
      ctx.fillText(num,cx,cy+dy*0.7);
    } else {
      ctx.fillStyle=num%10===0?'#c05010':'#7a6040';
      ctx.font=num%10===0?`bold ${fsB}px Segoe UI`:`${fs}px Segoe UI`;
      ctx.fillText(num,cx,cy);
    }
  }

  function drawBranchSquare({num,cx,cy,corners,route}){
    const isJob=route==='job';
    const fs=Math.max(8,Math.round(SQ_ACROSS*0.28));

    ctx.save();
    ctx.shadowColor='rgba(0,0,0,0.15)'; ctx.shadowBlur=5; ctx.shadowOffsetY=2;
    ctx.fillStyle=tileGrad(num,corners,isJob,!isJob);
    tilePath(corners); ctx.fill();
    ctx.restore();

    ctx.strokeStyle=isJob?'#c06810':'#2840b8';
    ctx.lineWidth=1.2;
    tilePath(corners); ctx.stroke();

    ctx.fillStyle=isJob?'#904010':'#1830a0';
    ctx.font=`${fs}px Segoe UI`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(num,cx,cy);
  }

  function drawSky(){
    const sky=ctx.createLinearGradient(0,0,0,CH);
    sky.addColorStop(0,'#2a72c8'); sky.addColorStop(0.35,'#5aaae0');
    sky.addColorStop(0.65,'#87ceeb'); sky.addColorStop(0.82,'#c8eedd'); sky.addColorStop(1,'#a8d870');
    ctx.fillStyle=sky; ctx.fillRect(0,0,CW,CH);
    drawCloud(160,60,1.0);drawCloud(420,40,0.8);drawCloud(700,70,1.2);
    drawCloud(960,45,0.9);drawCloud(280,110,0.65);drawCloud(820,100,0.75);
  }
  function drawCloud(cx,cy,sc){
    ctx.save(); ctx.fillStyle='rgba(255,255,255,0.82)';
    ctx.shadowColor='rgba(180,220,255,0.4)'; ctx.shadowBlur=12;
    [[0,0,32],[28,6,22],[-22,6,20],[10,-16,26],[-8,-10,18]].forEach(([dx,dy,r])=>{
      ctx.beginPath();ctx.arc(cx+dx*sc,cy+dy*sc,r*sc,0,Math.PI*2);ctx.fill();
    });
    ctx.restore();
  }
  function drawMountainLayer(peaks,fillColor,snowLine){
    ctx.save(); ctx.beginPath(); ctx.moveTo(0,CH);
    ctx.lineTo(peaks[0][0],peaks[0][1]);
    for(let i=1;i<peaks.length;i++){
      const mx=(peaks[i-1][0]+peaks[i][0])/2,my=(peaks[i-1][1]+peaks[i][1])/2;
      ctx.quadraticCurveTo(peaks[i-1][0],peaks[i-1][1],mx,my);
    }
    ctx.lineTo(peaks[peaks.length-1][0],peaks[peaks.length-1][1]);
    ctx.lineTo(CW,CH); ctx.closePath(); ctx.fillStyle=fillColor; ctx.fill();
    if(snowLine){
      ctx.beginPath();
      peaks.forEach(([px,py])=>{if(py<snowLine){const s=40;ctx.moveTo(px-s,py+30);ctx.lineTo(px,py-4);ctx.lineTo(px+s,py+30);}});
      ctx.fillStyle='rgba(255,255,255,0.75)'; ctx.fill();
    }
    ctx.restore();
  }
  function drawMountains(){
    drawMountainLayer([[0,380],[120,280],[260,340],[400,260],[540,310],[680,255],[820,295],[960,260],[1120,310]],'#b8cce8');
    drawMountainLayer([[0,450],[100,370],[240,420],[380,355],[530,400],[680,348],[830,385],[980,355],[1120,400]],'#90aacc',375);
    drawMountainLayer([[0,520],[80,455],[200,495],[350,440],[500,475],[650,432],[800,462],[950,440],[1120,480]],'#6888b0',450);
    drawMountainLayer([[0,630],[90,575],[210,605],[360,568],[510,590],[660,562],[810,582],[960,566],[1120,600]],'#3a7030');
    drawMountainLayer([[0,760],[140,730],[300,748],[480,725],[640,740],[800,722],[960,738],[1120,750]],'#5a9040');
  }
  function drawRoad(){
    ctx.save(); ctx.lineJoin='round'; ctx.lineCap='round';
    ctx.lineWidth=ROAD_W+14; ctx.strokeStyle='rgba(100,70,30,0.32)'; traceWay(); ctx.stroke();
    ctx.lineWidth=ROAD_W+4;  ctx.strokeStyle='#c8a060';              traceWay(); ctx.stroke();
    ctx.lineWidth=ROAD_W;    ctx.strokeStyle='#ddb870';              traceWay(); ctx.stroke();
    ctx.lineWidth=ROAD_W-8;  ctx.strokeStyle='rgba(255,240,190,0.4)'; traceWay(); ctx.stroke();
    ctx.lineWidth=2; ctx.strokeStyle='rgba(255,255,255,0.55)';
    ctx.setLineDash([12,16]); traceWay(); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
  function traceWay(){ctx.beginPath();WAYPOINTS.forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y));}

  function drawTokens(){
    const byKey={};
    players.forEach(p=>{
      const st=getStats(playerData[p.player_id]);
      const bsq=getBranchSq(st.pos,st.route);
      const sq=bsq||squares[st.pos];
      if(!sq)return;
      const key=`${st.pos}-${st.route||'main'}`;
      (byKey[key]=byKey[key]||[]).push({p,sq});
    });
    Object.values(byKey).forEach(group=>{
      const {sq}=group[0];
      const cx=sq.cx, cy=sq.cy;
      group.forEach(({p},i)=>{
        const off=tokenOffset(group.length,i),tx=cx+off.x,ty=cy+off.y,R=16;
        ctx.save();ctx.shadowColor='rgba(0,0,0,0.4)';ctx.shadowBlur=8;ctx.shadowOffsetY=3;
        ctx.beginPath();ctx.arc(tx,ty,R,0,Math.PI*2);ctx.fillStyle=p.color;ctx.fill();ctx.restore();
        const tg=ctx.createRadialGradient(tx-R*.3,ty-R*.3,R*.05,tx,ty,R);
        tg.addColorStop(0,'rgba(255,255,255,0.6)');tg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.beginPath();ctx.arc(tx,ty,R,0,Math.PI*2);ctx.fillStyle=tg;ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,0.85)';ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(tx,ty,R,0,Math.PI*2);ctx.stroke();
        ctx.fillStyle='#fff';ctx.font='bold 11px Segoe UI';
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(p.player_name[0].toUpperCase(),tx,ty);
      });
    });
  }
  function tokenOffset(total,i){
    if(total===1)return{x:0,y:0};
    const a=(i/total)*Math.PI*2-Math.PI/2;
    return{x:Math.cos(a)*16,y:Math.sin(a)*16};
  }

  function showResultScreen(){
    // 順位：ゴール済み → pos降順
    const ranked=[...players].sort((a,b)=>{
      const sa=getStats(playerData[a.player_id]);
      const sb2=getStats(playerData[b.player_id]);
      if(sa.finished!==sb2.finished) return sa.finished?-1:1;
      return sb2.pos-sa.pos;
    });
    const medals=['🥇','🥈','🥉'];
    $('result-list').innerHTML=ranked.map((p,i)=>{
      const st=getStats(playerData[p.player_id]);
      return `<div class="result-row">
        <span class="result-rank">${medals[i]||`${i+1}位`}</span>
        <span class="result-dot" style="background:${p.color}"></span>
        <span class="result-name">${p.player_name}${p.player_id===myId?' <span class="psc-self">自分</span>':''}</span>
        <span class="result-pos">${st.finished?'ゴール':st.pos+'マス'}</span>
      </div>`;
    }).join('');
    $('result-screen').classList.remove('hidden');
    $('result-screen').classList.add('visible');
  }

  $('btn-result-title').addEventListener('click',()=>{
    roomId='';players=[];isHost=false;playerData={};
    nameInput.value='';wordInput.value='';
    $('result-screen').classList.add('hidden');
    showScreen('title-screen');
  });

}());

// スマホ用ピンチズーム＋ドラッグ
(function(){
  if(window.matchMedia('(min-width:700px)').matches)return;
  const canv=document.getElementById('board-canvas');
  const wrap=canv.parentElement;

  let s=1, ox=0, oy=0;

  function clamp(){
    const ww=wrap.offsetWidth, wh=wrap.offsetHeight;
    const sw=canv.offsetWidth*s, sh=canv.offsetHeight*s;
    ox = sw<=ww ? (ww-sw)/2 : Math.min(0,Math.max(ww-sw,ox));
    oy = sh<=wh ? (wh-sh)/2 : Math.min(0,Math.max(wh-sh,oy));
  }
  function apply(){
    clamp();
    canv.style.transform=`translate(${ox}px,${oy}px) scale(${s})`;
  }
  function ptDist(a,b){
    const dx=a.clientX-b.clientX,dy=a.clientY-b.clientY;
    return Math.sqrt(dx*dx+dy*dy);
  }

  let pinching=false,prevDist=0;
  let dragging=false,dragX=0,dragY=0,dragOX=0,dragOY=0;
  let lastTap=0;

  wrap.addEventListener('touchstart',e=>{
    if(e.touches.length===2){
      pinching=true; dragging=false;
      prevDist=ptDist(e.touches[0],e.touches[1]);
      e.preventDefault();
    } else if(e.touches.length===1){
      const now=Date.now();
      if(now-lastTap<300){ s=1;ox=0;oy=0;apply(); }
      lastTap=now;
      if(s>1.02){
        dragging=true;
        dragX=e.touches[0].clientX; dragY=e.touches[0].clientY;
        dragOX=ox; dragOY=oy;
        e.preventDefault();
      }
    }
  },{passive:false});

  wrap.addEventListener('touchmove',e=>{
    if(pinching&&e.touches.length===2){
      const d=ptDist(e.touches[0],e.touches[1]);
      const ns=Math.max(1,Math.min(4,s*d/prevDist));
      const rect=wrap.getBoundingClientRect();
      const mx=(e.touches[0].clientX+e.touches[1].clientX)/2-rect.left;
      const my=(e.touches[0].clientY+e.touches[1].clientY)/2-rect.top;
      ox=mx-(mx-ox)*ns/s;
      oy=my-(my-oy)*ns/s;
      s=ns; prevDist=d;
      apply(); e.preventDefault();
    } else if(dragging&&e.touches.length===1){
      ox=dragOX+e.touches[0].clientX-dragX;
      oy=dragOY+e.touches[0].clientY-dragY;
      apply(); e.preventDefault();
    }
  },{passive:false});

  wrap.addEventListener('touchend',e=>{
    if(e.touches.length<2)pinching=false;
    if(e.touches.length===0)dragging=false;
  });
})();
