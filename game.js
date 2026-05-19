(function () {
  'use strict';

  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  const isConfigured = !SUPABASE_URL.includes('YOUR_PROJECT_ID');

  const CW     = 1120;
  const CH     = 930;
  const SQ_W   = 64;
  const SQ_H   = 48;
  const GOAL_W = 94;
  const GOAL_H = 70;

  const PLAYER_COLORS = ['#00e5ff','#ff2d78','#00ff88','#ffd740','#e040fb','#ff6d00'];

  const WAYPOINTS = [
    [ 80, 865],
    [215, 878], [365, 862], [515, 878], [665, 862], [820, 875], [970, 862],
    [1055, 790], [1060, 695], [1055, 600],
    [940, 535], [775, 518], [615, 530], [455, 518], [295, 530], [145, 518],
    [ 68, 450], [ 72, 358],
    [165, 290], [325, 272], [485, 285], [645, 272], [805, 285], [960, 272],
    [1052, 205], [1056, 122],
    [958, 58], [795, 44], [630, 56], [470, 44], [310, 56], [158, 46],
    [ 76,  80],
  ];

  let myId = sessionStorage.getItem('gol_pid');
  if (!myId) { myId = crypto.randomUUID(); sessionStorage.setItem('gol_pid', myId); }

  let myName             = '';
  let roomId             = '';
  let players            = [];
  let isHost             = false;
  let playerPositions    = {};
  let currentPlayerIndex = 0;
  let turnNumber         = 0;
  let isMyTurn           = false;
  let rolling            = false;
  let channel            = null;

  const squares = buildSquares();

  function buildSquares() {
    const segLens = [];
    let total = 0;
    for (let i = 1; i < WAYPOINTS.length; i++) {
      const dx = WAYPOINTS[i][0] - WAYPOINTS[i-1][0];
      const dy = WAYPOINTS[i][1] - WAYPOINTS[i-1][1];
      const len = Math.sqrt(dx*dx + dy*dy);
      segLens.push(len);
      total += len;
    }
    const spacing = total / 99;
    const sqs = [];
    for (let n = 0; n < 100; n++) {
      const target = n * spacing;
      let traveled = 0, seg = 0;
      while (seg < segLens.length - 1 && traveled + segLens[seg] < target) {
        traveled += segLens[seg++];
      }
      const t  = segLens[seg] > 0 ? Math.min((target - traveled) / segLens[seg], 1) : 0;
      const p0 = WAYPOINTS[seg];
      const p1 = WAYPOINTS[Math.min(seg + 1, WAYPOINTS.length - 1)];
      sqs.push({
        num: n + 1,
        x: p0[0] + (p1[0] - p0[0]) * t - SQ_W / 2,
        y: p0[1] + (p1[1] - p0[1]) * t - SQ_H / 2,
      });
    }
    return sqs;
  }

  const $ = id => document.getElementById(id);

  function fadeOut(el, cb) {
    el.classList.add('fade-out');
    setTimeout(() => { el.classList.add('hidden'); cb && cb(); }, 500);
  }
  function fadeIn(el) {
    el.classList.remove('hidden');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('visible')));
  }
  const SCREENS = ['title-screen','word-screen','lobby-screen','game-screen'];
  function showScreen(id) {
    SCREENS.forEach(sid => {
      const el = $(sid);
      if (sid === id) fadeIn(el);
      else if (!el.classList.contains('hidden')) fadeOut(el);
    });
  }

  $('btn-go').addEventListener('click', () => showScreen('word-screen'));

  const nameInput = $('name-input');
  const wordInput = $('word-input');
  const wordError = $('word-error');

  $('btn-create').addEventListener('click', enterRoom);
  nameInput.addEventListener('keydown', e => e.key === 'Enter' && wordInput.focus());
  wordInput.addEventListener('keydown', e => e.key === 'Enter' && enterRoom());

  async function enterRoom() {
    if (!isConfigured) {
      wordError.innerHTML = 'Supabaseが未設定です。<br>config.js を書き換えてください。';
      return;
    }
    const name = nameInput.value.trim();
    const word = wordInput.value.trim();
    if (!name) { wordError.textContent = '名前を入力してください'; nameInput.focus(); return; }
    if (!word) { wordError.textContent = 'あいことばを入力してください'; wordInput.focus(); return; }
    wordError.textContent = '';

    const btn = $('btn-create');
    btn.disabled = true; btn.textContent = '接続中...';
    myName = name;
    roomId = word.toLowerCase().replace(/\s+/g, '-');

    try {
      const { data: existing, error: fe } = await sb
        .from('rooms').select('id,host_id,status,created_at').eq('id', roomId).maybeSingle();
      if (fe) throw fe;

      let roomData = existing;
      if (roomData) {
        const ageMs = Date.now() - new Date(roomData.created_at).getTime();
        const isStale =
          roomData.status === 'closed' ||
          (roomData.host_id !== myId && roomData.status === 'waiting' && ageMs > 3 * 60 * 1000);

        if (isStale) {
          // DELETE を試み、RLSで失敗したら status='closed' にフォールバック
          const { error: delErr } = await sb.from('rooms').delete().eq('id', roomId);
          if (delErr) {
            console.warn('DELETE failed, falling back to closed:', delErr.message);
            await sb.from('rooms').update({ status: 'closed' }).eq('id', roomId);
          }
          roomData = null;
        }
      }

      if (!roomData) {
        const { error } = await sb.from('rooms')
          .insert({ id: roomId, host_id: myId, alive_cells: {} });
        if (error) throw error;
        isHost = true;
      } else {
        isHost = roomData.host_id === myId;
      }

      const { data: ep } = await sb.from('room_players').select('color').eq('room_id', roomId);
      const usedColors = (ep || []).map(p => p.color);
      const myColor    = PLAYER_COLORS.find(c => !usedColors.includes(c)) || PLAYER_COLORS[0];

      const { error: pe } = await sb.from('room_players').upsert(
        { room_id: roomId, player_id: myId, player_name: myName, color: myColor, is_host: isHost },
        { onConflict: 'room_id,player_id' }
      );
      if (pe) throw pe;

      if (isHost) window.addEventListener('beforeunload', dissolveRoom);

      await refreshPlayers();
      subscribeRoom();
      showScreen('lobby-screen');
    } catch (err) {
      console.error(err);
      const msg = err?.message || '';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError'))
        wordError.textContent = 'ネットワークエラー。SUPABASE_URLを確認してください。';
      else if (msg.includes('Invalid API key') || msg.includes('apikey'))
        wordError.textContent = 'APIキーが正しくありません。';
      else
        wordError.textContent = '接続エラー: ' + (msg || 'コンソールを確認してください。');
    } finally {
      btn.disabled = false; btn.textContent = 'ルームに入る';
    }
  }

  function dissolveRoom() {
    if (!isHost || !roomId) return;
    fetch(
      `${SUPABASE_URL}/rest/v1/rooms?id=eq.${encodeURIComponent(roomId)}`,
      {
        method:  'DELETE',
        headers: {
          'apikey':        SUPABASE_ANON,
          'Authorization': `Bearer ${SUPABASE_ANON}`,
          'Prefer':        'return=minimal',
        },
        keepalive: true,
      }
    );
  }

  async function refreshPlayers() {
    const { data } = await sb.from('room_players').select('*')
      .eq('room_id', roomId).order('joined_at');
    players = data || [];
    renderLobby();
  }
  function renderLobby() {
    $('lobby-room-name').textContent = 'ルーム: ' + roomId;
    $('player-list').innerHTML = players.map(p => `
      <li class="player-item">
        <span class="player-dot" style="background:${p.color};box-shadow:0 0 6px ${p.color}"></span>
        <span class="player-name">${p.player_name}${p.is_host ? ' 👑' : ''}</span>
      </li>`).join('');
    $('btn-lobby-start').style.display = isHost ? 'block' : 'none';
    $('lobby-hint').style.display      = isHost ? 'none'  : 'block';
  }
  $('btn-lobby-start').addEventListener('click', async () => {
    const initPos = {};
    players.forEach(p => { initPos[p.player_id] = 1; });
    await sb.from('rooms').update({ status: 'playing', alive_cells: initPos }).eq('id', roomId);
  });

  function subscribeRoom() {
    channel = sb.channel('room-' + roomId)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}`
      }, p => onRoomChange(p.new))
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}`
      }, () => { if (!isHost) showDissolutionOverlay(); })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}`
      }, () => refreshPlayers())
      .subscribe();
  }

  async function onRoomChange(room) {
    if (!room) return;
    if (room.status === 'playing') {
      const { data } = await sb.from('room_players').select('*')
        .eq('room_id', roomId).order('joined_at');
      players = data || [];
      if ($('game-screen').classList.contains('hidden')) {
        $('room-badge').textContent = 'ルーム: ' + roomId;
        applyRoomState(room);
        showScreen('game-screen');
      } else {
        applyRoomState(room);
      }
    }
  }

  function showDissolutionOverlay() {
    $('dissolution-overlay').classList.remove('hidden');
    setTimeout(() => {
      $('dissolution-overlay').classList.add('hidden');
      roomId = ''; players = []; isHost = false;
      playerPositions = {};
      nameInput.value = ''; wordInput.value = '';
      showScreen('title-screen');
    }, 3000);
  }

  const canvas = $('board-canvas');
  const ctx    = canvas.getContext('2d');
  canvas.width  = CW;
  canvas.height = CH;

  function applyRoomState(room) {
    playerPositions    = room.alive_cells || {};
    currentPlayerIndex = room.current_player_index || 0;
    turnNumber         = room.turn_number || 0;
    updateTurnUI();
    drawBoard();
  }

  function updateTurnUI() {
    if (!players.length) return;
    const idx = currentPlayerIndex % players.length;
    const cp  = players[idx];
    isMyTurn  = cp?.player_id === myId;
    const ind = $('turn-indicator');
    if (isMyTurn) {
      ind.textContent = 'あなたのターンです！';
      ind.style.color = '#00ff88';
    } else {
      ind.textContent = (cp?.player_name || '?') + ' のターン';
      ind.style.color = cp?.color || '#00e5ff';
    }
    const rollBtn = $('btn-roll');
    rollBtn.style.display = isMyTurn ? 'block' : 'none';
    rollBtn.disabled = false;
    rolling = false;
    $('turn-number').textContent = turnNumber;
    $('game-player-list').innerHTML = players.map((p, i) => {
      const pos = playerPositions[p.player_id] || 1;
      return `<li class="gpl-item ${i === idx ? 'gpl-active' : ''}">
        <span class="player-dot" style="background:${p.color};box-shadow:0 0 5px ${p.color}"></span>
        <span>${p.player_name}</span>
        <span style="color:${p.color};margin-left:4px">${pos}マス</span>
      </li>`;
    }).join('');
  }

  $('btn-roll').addEventListener('click', async () => {
    if (!isMyTurn || rolling) return;
    rolling = true;
    $('btn-roll').disabled = true;
    const roll = Math.floor(Math.random() * 6) + 1;
    await animateDice(roll);
    const curPos = playerPositions[myId] || 1;
    const newPos = Math.min(curPos + roll, 100);
    const newPositions = { ...playerPositions, [myId]: newPos };
    const nextIndex    = (currentPlayerIndex + 1) % players.length;
    await sb.from('rooms').update({
      alive_cells:           newPositions,
      current_player_index:  nextIndex,
      turn_number:           nextIndex === 0 ? turnNumber + 1 : turnNumber,
    }).eq('id', roomId);
  });

  const DICE_FACE = ['⚀','⚁','⚂','⚃','⚄','⚅'];
  async function animateDice(result) {
    const el = $('dice-result');
    for (let i = 0; i < 10; i++) {
      el.textContent = DICE_FACE[Math.floor(Math.random() * 6)];
      await sleep(60);
    }
    el.textContent = DICE_FACE[result - 1] + '　' + result + 'マス進む！';
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ── ボード描画 ──
  function drawBoard() {
    // ダークシティナイト背景
    ctx.fillStyle = '#040410';
    ctx.fillRect(0, 0, CW, CH);

    // シティグリッド
    ctx.save();
    ctx.strokeStyle = 'rgba(0,229,255,0.025)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= CW; x += 80) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke();
    }
    for (let y = 0; y <= CH; y += 80) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke();
    }
    ctx.restore();

    drawRoad();
    squares.forEach(drawSquare);
    drawTokens();
  }

  function drawRoad() {
    const roadW = SQ_H + 30;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // アスファルト層
    ctx.lineWidth = roadW + 18; ctx.strokeStyle = '#020208'; traceWay(); ctx.stroke();
    ctx.lineWidth = roadW + 6;  ctx.strokeStyle = '#07071a'; traceWay(); ctx.stroke();
    ctx.lineWidth = roadW;      ctx.strokeStyle = '#0c0c22'; traceWay(); ctx.stroke();
    // ネオンエッジグロー
    ctx.lineWidth = roadW + 2;  ctx.strokeStyle = 'rgba(0,229,255,0.06)'; traceWay(); ctx.stroke();
    // センターライン
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.setLineDash([16, 26]); traceWay(); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
  function traceWay() {
    ctx.beginPath();
    WAYPOINTS.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
  }

  function squareGrad(num, sx, sy, w, h) {
    const g = ctx.createLinearGradient(sx, sy, sx, sy + h);
    if      (num === 1)      { g.addColorStop(0,'#004d22'); g.addColorStop(1,'#001a0c'); }
    else if (num === 100)    { g.addColorStop(0,'#6a4d00'); g.addColorStop(1,'#2a1e00'); }
    else if (num % 10 === 0) { g.addColorStop(0,'#4a1800'); g.addColorStop(1,'#1e0800'); }
    else if (num % 5  === 0) { g.addColorStop(0,'#280050'); g.addColorStop(1,'#100020'); }
    else                     { g.addColorStop(0,'#090916'); g.addColorStop(1,'#04040e'); }
    return g;
  }
  function squareBorder(num) {
    if (num === 1)       return '#00ff88';
    if (num === 100)     return '#ffd740';
    if (num % 10 === 0) return '#ff6d00';
    if (num % 5  === 0) return '#e040fb';
    return '#1a1a38';
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
    ctx.arcTo(x+w,y,   x+w,y+r,  r); ctx.lineTo(x+w,y+h-r);
    ctx.arcTo(x+w,y+h, x+w-r,y+h,r); ctx.lineTo(x+r,y+h);
    ctx.arcTo(x,y+h,   x,y+h-r, r); ctx.lineTo(x,y+r);
    ctx.arcTo(x,y,     x+r,y,   r); ctx.closePath();
  }

  function drawSquare({ num, x, y }) {
    const isGoal = num===100, isStart = num===1;
    const w = isGoal ? GOAL_W : SQ_W, h = isGoal ? GOAL_H : SQ_H;
    const sx = x+(SQ_W-w)/2, sy = y+(SQ_H-h)/2;
    const border = squareBorder(num);
    const isSpecial = isGoal || isStart || num % 10 === 0;

    ctx.save();
    if (isSpecial) {
      ctx.shadowColor = border;
      ctx.shadowBlur  = isGoal ? 22 : isStart ? 16 : 10;
    }
    ctx.fillStyle = squareGrad(num,sx,sy,w,h);
    rr(sx,sy,w,h,5); ctx.fill();
    ctx.restore();

    ctx.strokeStyle = border;
    ctx.lineWidth   = isGoal || isStart ? 2 : 1;
    rr(sx,sy,w,h,5); ctx.stroke();

    // トップハイライト
    ctx.save(); ctx.globalAlpha=0.08; ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.roundRect(sx+1,sy+1,w-2,h*.3,[5,5,0,0]); ctx.fill(); ctx.restore();

    ctx.textAlign='center'; ctx.textBaseline='middle';
    const cx=sx+w/2, cy=sy+h/2;
    if (isGoal) {
      ctx.fillStyle='#ffd740'; ctx.font='bold 14px Segoe UI'; ctx.fillText('GOAL',cx,cy-12);
      ctx.font='22px serif'; ctx.fillText('🏆',cx,cy+10);
    } else if (isStart) {
      ctx.fillStyle='#00ff88'; ctx.font='bold 12px Segoe UI'; ctx.fillText('START',cx,cy);
    } else {
      const is10 = num % 10 === 0, is5 = num % 5 === 0;
      ctx.fillStyle = is10 ? '#ff9040' : is5 ? '#d070ff' : '#303878';
      ctx.font = is10 ? 'bold 12px Segoe UI' : '11px Segoe UI';
      ctx.fillText(num,cx,cy);
    }
  }

  function drawTokens() {
    const byPos = {};
    players.forEach(p => {
      const pos = playerPositions[p.player_id] || 1;
      (byPos[pos] = byPos[pos]||[]).push(p);
    });
    Object.entries(byPos).forEach(([posStr, group]) => {
      const idx = parseInt(posStr)-1;
      if (idx<0||idx>=squares.length) return;
      const {x,y} = squares[idx];
      const cx=x+SQ_W/2, cy=y+SQ_H/2;
      group.forEach((p,i) => {
        const off=tokenOffset(group.length,i), tx=cx+off.x, ty=cy+off.y, R=14;
        ctx.save();
        ctx.shadowColor=p.color; ctx.shadowBlur=18;
        ctx.beginPath(); ctx.arc(tx,ty,R,0,Math.PI*2);
        ctx.fillStyle=p.color; ctx.fill();
        ctx.restore();
        const tg=ctx.createRadialGradient(tx-R*.3,ty-R*.3,R*.05,tx,ty,R);
        tg.addColorStop(0,'rgba(255,255,255,0.5)'); tg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.arc(tx,ty,R,0,Math.PI*2); ctx.fillStyle=tg; ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.arc(tx,ty,R,0,Math.PI*2); ctx.stroke();
        ctx.fillStyle='#000'; ctx.font='bold 10px Segoe UI';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(p.player_name[0].toUpperCase(),tx,ty);
      });
    });
  }
  function tokenOffset(total,i) {
    if (total===1) return {x:0,y:0};
    const a=(i/total)*Math.PI*2-Math.PI/2;
    return {x:Math.cos(a)*13,y:Math.sin(a)*13};
  }

}());
