(function () {
  'use strict';

  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  const isConfigured = !SUPABASE_URL.includes('YOUR_PROJECT_ID');

  const CW=1120, CH=930;
  const SQ_ACROSS = 52;
  let SQ_ALONG = 44;  // average, set in buildSquares
  let ROAD_W = 74;
  const MAX_PLAYERS = 9;
  const MAX_HAPPINESS = 20;
  const MAX_HEALTH = 20;
  const FORCED_STOPS = [20, 40, 60, 80];
  const BRANCH_START = 20, BRANCH_END = 30;
  const PLAYER_COLORS = [
    '#1565c0','#c62828','#2e7d32','#e65100',
    '#6a1b9a','#00838f','#f9a825','#ad1457','#37474f'
  ];

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
  let pendingRoll = null;

  function defaultStats(pos=1) {
    return { pos, money:0, happiness:MAX_HAPPINESS, health:MAX_HEALTH, items:Array(6).fill(null), job:null, route:null };
  }
  function clampStats(st) {
    return { ...st,
      happiness: Math.max(0, Math.min(MAX_HAPPINESS, st.happiness)),
      health:    Math.max(0, Math.min(MAX_HEALTH,    st.health)),
    };
  }
  function getPos(d)   { return typeof d==='object'&&d!==null ? d.pos   : (d||1); }
  function getStats(d) { return typeof d==='object'&&d!==null ? d : defaultStats(d||1); }

  function calcLanding(currentPos, roll) {
    const dest = Math.min(currentPos + roll, 100);
    const stop = FORCED_STOPS.find(s => s > currentPos && s <= dest);
    return stop || dest;
  }

  const squares = buildSquares();

  function buildSquares() {
    // セグメント長と総距離を計算
    const segLens = []; let total = 0;
    for (let i = 1; i < WAYPOINTS.length; i++) {
      const dx = WAYPOINTS[i][0]-WAYPOINTS[i-1][0], dy = WAYPOINTS[i][1]-WAYPOINTS[i-1][1];
      const len = Math.sqrt(dx*dx + dy*dy);
      segLens.push(len); total += len;
    }
    ROAD_W = SQ_ACROSS + 22;
    SQ_ALONG = total / 99; // 平均スペーシング（分岐マス用）

    const spacing = total / 99;

    // 第1パス: 各マスの中心座標と角度を計算
    const pts = [];
    for (let n = 0; n < 100; n++) {
      const target = n * spacing;
      let traveled = 0, seg = 0;
      while (seg < segLens.length-1 && traveled + segLens[seg] < target) traveled += segLens[seg++];
      const t = segLens[seg] > 0 ? Math.min((target - traveled) / segLens[seg], 1) : 0;
      const p0 = WAYPOINTS[seg], p1 = WAYPOINTS[Math.min(seg+1, WAYPOINTS.length-1)];
      pts.push({
        cx: p0[0] + (p1[0]-p0[0]) * t,
        cy: p0[1] + (p1[1]-p0[1]) * t,
        angle: Math.atan2(p1[1]-p0[1], p1[0]-p0[0])
      });
    }

    // 第2パス: 隣接中心点の中間を境界として各マスの幅を計算
    function dist(a, b) { return Math.sqrt((a.cx-b.cx)**2 + (a.cy-b.cy)**2); }
    const sqs = [];
    for (let n = 0; n < 100; n++) {
      const leftDist  = n === 0  ? 0 : dist(pts[n-1], pts[n]) / 2;
      const rightDist = n === 99 ? 0 : dist(pts[n], pts[n+1]) / 2;
      sqs.push({ num: n+1, cx: pts[n].cx, cy: pts[n].cy, angle: pts[n].angle, w: leftDist + rightDist });
    }
    return sqs;
  }

  // 分岐マス生成
  const branchSquares = (function() {
    const sq20 = squares[BRANCH_START - 1];
    const sq30 = squares[BRANCH_END - 1];
    const cx20 = sq20.cx, cy20 = sq20.cy;
    const cx30 = sq30.cx, cy30 = sq30.cy;

    // 就職ルート: メインロードのマス21〜29（中間点境界の幅をそのまま使用）
    const job = squares.slice(BRANCH_START, BRANCH_END - 1).map(sq => ({ ...sq, route: 'job' }));

    // 大学ルート: 左側へカーブする二次ベジェ（弧長パラメータ化）
    const cpx = (cx20 + cx30) / 2 - Math.abs(cy20 - cy30) * 1.4;
    const cpy = (cy20 + cy30) / 2 + (cy20 - cy30) * 0.1;

    function bezierPt(t) {
      return {
        x: (1-t)*(1-t)*cx20 + 2*(1-t)*t*cpx + t*t*cx30,
        y: (1-t)*(1-t)*cy20 + 2*(1-t)*t*cpy + t*t*cy30
      };
    }

    // 弧長テーブル構築
    const SAMPLES = 600;
    const arcSamples = [{ t: 0, len: 0 }];
    let arcTotal = 0;
    for (let i = 1; i <= SAMPLES; i++) {
      const t0 = (i-1) / SAMPLES, t1 = i / SAMPLES;
      const p0 = bezierPt(t0), p1 = bezierPt(t1);
      arcTotal += Math.sqrt((p1.x-p0.x)**2 + (p1.y-p0.y)**2);
      arcSamples.push({ t: t1, len: arcTotal });
    }
    function tAtLen(targetLen) {
      let lo = 0, hi = arcSamples.length - 1;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (arcSamples[mid].len < targetLen) lo = mid; else hi = mid;
      }
      const a = arcSamples[lo], b = arcSamples[hi];
      if (b.len === a.len) return a.t;
      return a.t + (b.t - a.t) * (targetLen - a.len) / (b.len - a.len);
    }

    const steps = BRANCH_END - BRANCH_START;
    const uniSpacing = arcTotal / steps;

    // 大学ルートの全点列（sq20 + 中間9点 + sq30）を構築
    const allUniPts = [{ cx: cx20, cy: cy20 }];
    for (let i = 1; i < steps; i++) {
      const t  = tAtLen(i * uniSpacing);
      const pt = bezierPt(t);
      const t2 = Math.min(t + 0.002, 1);
      const pt2 = bezierPt(t2);
      allUniPts.push({ cx: pt.x, cy: pt.y, angle: Math.atan2(pt2.y-pt.y, pt2.x-pt.x) });
    }
    allUniPts.push({ cx: cx30, cy: cy30 });

    // 中間点境界で幅を計算
    function dist(a, b) { return Math.sqrt((a.cx-b.cx)**2 + (a.cy-b.cy)**2); }
    const uni = [];
    for (let i = 1; i < steps; i++) {
      const pt = allUniPts[i];
      const leftDist  = dist(allUniPts[i-1], pt) / 2;
      const rightDist = dist(pt, allUniPts[i+1]) / 2;
      uni.push({
        num: BRANCH_START + i,
        cx: pt.cx, cy: pt.cy,
        angle: pt.angle,
        w: leftDist + rightDist,
        route: 'uni'
      });
    }

    return { job, uni, cpx, cpy, cx20, cy20, cx30, cy30 };
  })();

  function getBranchSq(pos, route) {
    if (pos > BRANCH_START && pos < BRANCH_END && route) {
      return (branchSquares[route] || []).find(s => s.num === pos) || null;
    }
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
    if (!isConfigured){wordError.innerHTML='Supabaseが未設定です。<br>config.jsを書き換えてください。';return;}
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
      if(!alreadyIn && existingPlayers.length>=MAX_PLAYERS){
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
    players.forEach(p=>{initData[p.player_id]=defaultStats(1);});
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
    if(room.status==='playing'){
      const {data}=await sb.from('room_players').select('*').eq('room_id',roomId).order('joined_at');
      players=data||[];
      if($('game-screen').classList.contains('hidden')){
        $('room-badge').textContent='ルーム: '+roomId;
        applyRoomState(room); showScreen('game-screen');
      } else {applyRoomState(room);}
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
    playerData=room.alive_cells||{};
    currentPlayerIndex=room.current_player_index||0;
    turnNumber=room.turn_number||0;
    updateTurnUI(); drawBoard();
  }

  function updateTurnUI(){
    if(!players.length)return;
    const idx=currentPlayerIndex%players.length, cp=players[idx];
    isMyTurn=cp?.player_id===myId;
    const ind=$('turn-indicator');
    if(isMyTurn){ind.textContent='あなたのターンです！';ind.style.color='#228844';}
    else{ind.textContent=(cp?.player_name||'?')+' のターン';ind.style.color=cp?.color||'#1565c0';}
    const rb=$('btn-roll');
    rb.style.display=isMyTurn?'block':'none';rb.disabled=false;rolling=false;
    $('turn-number').textContent=turnNumber;
    renderPlayerStatusCards(idx);
  }

  function renderPlayerStatusCards(activeIdx){
    $('player-status-area').innerHTML=players.map((p,i)=>{
      const st=getStats(playerData[p.player_id]);
      const routeLabel = st.route==='job'?' 💼就職':st.route==='uni'?' 🎓大学':'';
      const jobLabel=(st.job||'未定')+routeLabel;
      const isMine=p.player_id===myId;
      const itemsHtml=st.items.map(item=>
        item ? `<div class="item-slot filled" title="${item}">${item}</div>`
             : `<div class="item-slot">∅</div>`
      ).join('');
      return `
        <div class="psc${i===activeIdx?' psc-active':''}${isMine?' psc-mine':''}">
          <div class="psc-header">
            <span class="psc-dot" style="background:${p.color}"></span>
            <span class="psc-name">${p.player_name}${p.is_host?' 👑':''}${isMine?' <span class="psc-self">自分</span>':''}</span>
            <span class="psc-job">💼 ${jobLabel}</span>
          </div>
          <div class="psc-stats">
            <span class="psc-stat">💰 <span class="psc-stat-val">${st.money}万円</span></span>
            <span class="psc-stat">😊 <span class="psc-stat-val">${st.happiness}/${MAX_HAPPINESS}</span></span>
            <span class="psc-stat">❤️ <span class="psc-stat-val">${st.health}/${MAX_HEALTH}</span></span>
            <span class="psc-stat">📍 <span class="psc-stat-val">${st.pos}マス</span></span>
          </div>
          <div class="psc-items">${itemsHtml}</div>
        </div>`;
    }).join('');
  }

  $('btn-roll').addEventListener('click', async () => {
    if (!isMyTurn || rolling) return;
    rolling = true;
    $('btn-roll').disabled = true;
    const roll = Math.floor(Math.random() * 6) + 1;
    await animateDice(roll);
    const st = getStats(playerData[myId]);
    const newPos = calcLanding(st.pos, roll);

    if (newPos === BRANCH_START && !st.route) {
      pendingRoll = { st, newPos };
      $('route-overlay').classList.remove('hidden');
      return;
    }

    if (FORCED_STOPS.includes(newPos) && newPos !== st.pos + roll) showStopMessage(newPos);
    const newRoute = (st.route && newPos >= BRANCH_END) ? null : (st.route || null);
    await saveRoll(st, newPos, newRoute);
  });

  async function saveRoll(st, newPos, route) {
    const newData = { ...playerData, [myId]: clampStats({ ...st, pos: newPos, route: route || null }) };
    const nextIndex = (currentPlayerIndex + 1) % players.length;
    await sb.from('rooms').update({
      alive_cells: newData,
      current_player_index: nextIndex,
      turn_number: nextIndex === 0 ? turnNumber + 1 : turnNumber,
    }).eq('id', roomId);
  }

  $('btn-route-job').addEventListener('click', async () => {
    $('route-overlay').classList.add('hidden');
    if (!pendingRoll) return;
    const { st, newPos } = pendingRoll; pendingRoll = null;
    await saveRoll(st, newPos, 'job');
  });

  $('btn-route-uni').addEventListener('click', async () => {
    $('route-overlay').classList.add('hidden');
    if (!pendingRoll) return;
    const { st, newPos } = pendingRoll; pendingRoll = null;
    await saveRoll(st, newPos, 'uni');
  });

  function showStopMessage(pos){
    $('dice-result').textContent += `　★ ${pos}マスで強制ストップ！`;
  }

  const DICE_FACE=['⚀','⚁','⚂','⚃','⚄','⚅'];
  async function animateDice(result){
    const el=$('dice-result');
    for(let i=0;i<10;i++){el.textContent=DICE_FACE[Math.floor(Math.random()*6)];await sleep(60);}
    el.textContent=DICE_FACE[result-1]+'　'+result+'マス進む！';
  }
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  // ── ボード描画 ──
  function drawBoard(){
    drawSky(); drawMountains();
    drawUniBranchRoad();
    drawRoad();
    drawBranchLabels();
    squares.forEach(sq => {
      if (sq.num > BRANCH_START && sq.num < BRANCH_END) return;
      drawSquare(sq);
    });
    branchSquares.job.forEach(sq => drawBranchSquare(sq));
    branchSquares.uni.forEach(sq => drawBranchSquare(sq));
    drawTokens();
  }

  function drawUniBranchRoad(){
    const {cpx, cpy, cx20, cy20, cx30, cy30} = branchSquares;
    ctx.save(); ctx.lineJoin='round'; ctx.lineCap='round';
    function bezier(){
      ctx.beginPath(); ctx.moveTo(cx20, cy20);
      ctx.quadraticCurveTo(cpx, cpy, cx30, cy30);
    }
    ctx.lineWidth=ROAD_W+14; ctx.strokeStyle='rgba(100,70,30,0.35)'; bezier(); ctx.stroke();
    ctx.lineWidth=ROAD_W+4;  ctx.strokeStyle='#c8a060';              bezier(); ctx.stroke();
    ctx.lineWidth=ROAD_W;    ctx.strokeStyle='#ddb870';              bezier(); ctx.stroke();
    ctx.lineWidth=ROAD_W-14; ctx.strokeStyle='rgba(255,235,180,0.35)'; bezier(); ctx.stroke();
    ctx.lineWidth=2; ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.setLineDash([18,22]);
    bezier(); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }

  function drawBranchLabels(){
    const j0 = branchSquares.job[4];
    const u0 = branchSquares.uni[4];
    if (!j0 || !u0) return;
    ctx.save();
    ctx.font='bold 12px Segoe UI'; ctx.textAlign='center'; ctx.textBaseline='middle';
    const jx = j0.cx, jy = j0.cy - 24;
    ctx.fillStyle='rgba(255,255,255,0.88)'; ctx.beginPath(); ctx.roundRect(jx-46,jy-10,92,20,6); ctx.fill();
    ctx.fillStyle='#b05010'; ctx.fillText('💼 就職ルート', jx, jy);
    const ux = u0.cx, uy = u0.cy - 24;
    ctx.fillStyle='rgba(255,255,255,0.88)'; ctx.beginPath(); ctx.roundRect(ux-46,uy-10,92,20,6); ctx.fill();
    ctx.fillStyle='#1030b0'; ctx.fillText('🎓 大学ルート', ux, uy);
    ctx.restore();
  }

  function drawBranchSquare({num, cx, cy, angle, w, route}){
    const h = SQ_ACROSS;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(angle);
    ctx.shadowColor='rgba(0,0,0,0.18)'; ctx.shadowBlur=6; ctx.shadowOffsetY=2;
    const g = ctx.createLinearGradient(0, -h/2, 0, h/2);
    if (route==='job') { g.addColorStop(0,'#fff3d8'); g.addColorStop(1,'#f0c870'); }
    else               { g.addColorStop(0,'#e4eaff'); g.addColorStop(1,'#a0b8f8'); }
    ctx.fillStyle = g;
    rr(-w/2, -h/2, w, h, 5); ctx.fill();
    ctx.shadowColor='transparent'; ctx.shadowBlur=0; ctx.shadowOffsetY=0;
    ctx.strokeStyle = route==='job' ? '#c06810' : '#2840b8';
    ctx.lineWidth = 1.5;
    rr(-w/2, -h/2, w, h, 5); ctx.stroke();
    ctx.rotate(-angle);
    ctx.fillStyle = route==='job' ? '#904010' : '#1830a0';
    ctx.font='11px Segoe UI'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(num, 0, 0);
    ctx.restore();
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
      peaks.forEach(([px,py])=>{ if(py<snowLine){const s=40;ctx.moveTo(px-s,py+30);ctx.lineTo(px,py-4);ctx.lineTo(px+s,py+30);} });
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
    ctx.lineWidth=ROAD_W+14; ctx.strokeStyle='rgba(100,70,30,0.35)'; traceWay(); ctx.stroke();
    ctx.lineWidth=ROAD_W+4;  ctx.strokeStyle='#c8a060';              traceWay(); ctx.stroke();
    ctx.lineWidth=ROAD_W;    ctx.strokeStyle='#ddb870';              traceWay(); ctx.stroke();
    ctx.lineWidth=ROAD_W-14; ctx.strokeStyle='rgba(255,235,180,0.35)'; traceWay(); ctx.stroke();
    ctx.lineWidth=2; ctx.strokeStyle='rgba(255,255,255,0.55)';
    ctx.setLineDash([18,22]); traceWay(); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
  function traceWay(){ctx.beginPath();WAYPOINTS.forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y));}

  function squareGrad(num, h){
    const g = ctx.createLinearGradient(0, -h/2, 0, h/2);
    if(num===1)                        {g.addColorStop(0,'#c8f0c0');g.addColorStop(1,'#90d080');}
    else if(num===100)                 {g.addColorStop(0,'#fff080');g.addColorStop(1,'#f0c020');}
    else if(FORCED_STOPS.includes(num)){g.addColorStop(0,'#ffe0e0');g.addColorStop(1,'#f08888');}
    else if(num%10===0)                {g.addColorStop(0,'#ffe0c0');g.addColorStop(1,'#f0a060');}
    else if(num%5===0)                 {g.addColorStop(0,'#d0eaff');g.addColorStop(1,'#90c8f0');}
    else                               {g.addColorStop(0,'#fffdf5');g.addColorStop(1,'#f0e8d4');}
    return g;
  }
  function squareBorder(num){
    if(num===1)return'#2a8a40'; if(num===100)return'#c89000';
    if(FORCED_STOPS.includes(num))return'#c02020';
    if(num%10===0)return'#d06020'; if(num%5===0)return'#3a80c0'; return'#b89860';
  }
  function rr(x,y,w,h,r){
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);
    ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);
    ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);
    ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);
    ctx.arcTo(x,y,x+r,y,r);ctx.closePath();
  }

  function drawSquare({num, cx, cy, angle, w}){
    const isGoal = num===100, isStart = num===1, isStop = FORCED_STOPS.includes(num);
    // 高さのみ特殊マスで変化、幅はパス区間幅そのまま（隣接のため）
    const sqW = isGoal ? w * 1.0 : w;
    const h = isGoal ? SQ_ACROSS * 1.5 : isStop ? SQ_ACROSS * 1.35 : SQ_ACROSS;

    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(angle);
    ctx.shadowColor='rgba(0,0,0,0.18)'; ctx.shadowBlur=6; ctx.shadowOffsetY=2;
    ctx.fillStyle = squareGrad(num, h);
    rr(-sqW/2, -h/2, sqW, h, 5); ctx.fill();

    ctx.shadowColor='transparent'; ctx.shadowBlur=0; ctx.shadowOffsetY=0;
    ctx.strokeStyle = squareBorder(num);
    ctx.lineWidth = isGoal||isStart||isStop ? 2.5 : 1.5;
    rr(-sqW/2, -h/2, sqW, h, 5); ctx.stroke();

    ctx.save();
    ctx.globalAlpha=0.35; ctx.fillStyle='rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.roundRect(-sqW/2+2, -h/2+2, sqW-4, h*0.35, [5,5,0,0]); ctx.fill();
    ctx.restore();

    ctx.rotate(-angle);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    if(isGoal){
      ctx.fillStyle='#8a6000'; ctx.font='bold 13px Segoe UI'; ctx.fillText('GOAL', 0, -9);
      ctx.font='18px serif'; ctx.fillText('🏆', 0, 9);
    } else if(isStart){
      ctx.fillStyle='#1a6030'; ctx.font='bold 11px Segoe UI'; ctx.fillText('START', 0, 0);
    } else if(isStop){
      ctx.fillStyle='#a00000'; ctx.font='bold 10px Segoe UI'; ctx.fillText('★STOP', 0, -6);
      ctx.font='bold 10px Segoe UI'; ctx.fillText(num, 0, 7);
    } else {
      ctx.fillStyle = num%10===0?'#c05010': num%5===0?'#1a60a0': '#7a6040';
      ctx.font = num%10===0?'bold 12px Segoe UI': '11px Segoe UI';
      ctx.fillText(num, 0, 0);
    }
    ctx.restore();
  }

  function drawTokens(){
    const byKey={};
    players.forEach(p=>{
      const st=getStats(playerData[p.player_id]);
      const bsq=getBranchSq(st.pos, st.route);
      const sq=bsq || squares[st.pos-1];
      if(!sq)return;
      const key=`${st.pos}-${st.route||'main'}`;
      (byKey[key]=byKey[key]||[]).push({p,sq});
    });
    Object.values(byKey).forEach(group=>{
      const {sq}=group[0];
      const cx=sq.cx, cy=sq.cy;
      group.forEach(({p},i)=>{
        const off=tokenOffset(group.length,i),tx=cx+off.x,ty=cy+off.y,R=14;
        ctx.save();ctx.shadowColor='rgba(0,0,0,0.4)';ctx.shadowBlur=8;ctx.shadowOffsetY=3;
        ctx.beginPath();ctx.arc(tx,ty,R,0,Math.PI*2);ctx.fillStyle=p.color;ctx.fill();ctx.restore();
        const tg=ctx.createRadialGradient(tx-R*.3,ty-R*.3,R*.05,tx,ty,R);
        tg.addColorStop(0,'rgba(255,255,255,0.6)');tg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.beginPath();ctx.arc(tx,ty,R,0,Math.PI*2);ctx.fillStyle=tg;ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,0.85)';ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(tx,ty,R,0,Math.PI*2);ctx.stroke();
        ctx.fillStyle='#fff';ctx.font='bold 10px Segoe UI';
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(p.player_name[0].toUpperCase(),tx,ty);
      });
    });
  }
  function tokenOffset(total,i){
    if(total===1)return{x:0,y:0};
    const a=(i/total)*Math.PI*2-Math.PI/2;
    return{x:Math.cos(a)*13,y:Math.sin(a)*13};
  }

}());
