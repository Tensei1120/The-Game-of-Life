(function () {
  'use strict';

  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  const isConfigured = !SUPABASE_URL.includes('YOUR_PROJECT_ID');

  // ── ボード定数 ──
  const COLS   = 10;
  const ROWS   = 10;
  const SQ_W   = 94;    // マス幅
  const SQ_H   = 70;    // マス高さ
  const GAP_X  = 24;    // 横間隔
  const GAP_Y  = 40;    // 縦間隔
  const MX     = 38;    // 左右マージン
  const MY     = 38;    // 上下マージン
  const GOAL_W = 124;   // GOALマス幅
  const GOAL_H = 94;    // GOALマス高さ

  const CW = MX * 2 + COLS * (SQ_W + GAP_X) - GAP_X;
  const CH = MY * 2 + ROWS * (SQ_H + GAP_Y) - GAP_Y;

  const PLAYER_COLORS = ['#a0d8ef','#f08080','#90ee90','#ffd700','#da70d6','#ff8c00'];

  // ── セッションID ──
  let myId = sessionStorage.getItem('gol_pid');
  if (!myId) { myId = crypto.randomUUID(); sessionStorage.setItem('gol_pid', myId); }

  // ── 状態 ──
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

  // ── マス座標 ──
  const squares = buildSquares();

  function buildSquares() {
    const sqs = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const num     = row * COLS + col + 1;
        const gridCol = row % 2 === 0 ? col : (COLS - 1 - col);
        const x       = MX + gridCol * (SQ_W + GAP_X);
        const y       = CH - MY - SQ_H - row * (SQ_H + GAP_Y);
        sqs.push({ num, x, y });
      }
    }
    return sqs;
  }

  // ── DOM ──
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

  // ── あいことば入力 ──
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
        .from('rooms').select('id,host_id').eq('id', roomId).maybeSingle();
      if (fe) throw fe;

      if (!existing) {
        const { error } = await sb.from('rooms')
          .insert({ id: roomId, host_id: myId, alive_cells: {} });
        if (error) throw error;
        isHost = true;
      } else {
        isHost = existing.host_id === myId;
      }

      const { data: ep } = await sb.from('room_players').select('color').eq('room_id', roomId);
      const usedColors = (ep || []).map(p => p.color);
      const myColor    = PLAYER_COLORS.find(c => !usedColors.includes(c)) || PLAYER_COLORS[0];

      const { error: pe } = await sb.from('room_players').upsert(
        { room_id: roomId, player_id: myId, player_name: myName, color: myColor, is_host: isHost },
        { onConflict: 'room_id,player_id' }
      );
      if (pe) throw pe;

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

  // ── 待機室 ──
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
        <span class="player-dot" style="background:${p.color}"></span>
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

  // ── Realtime ──
  function subscribeRoom() {
    channel = sb.channel('room-' + roomId)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}`
      }, p => onRoomChange(p.new))
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

  // ── Canvas ──
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

  // ── ターンUI ──
  function updateTurnUI() {
    if (!players.length) return;
    const idx = currentPlayerIndex % players.length;
    const cp  = players[idx];
    isMyTurn  = cp?.player_id === myId;

    const ind = $('turn-indicator');
    if (isMyTurn) {
      ind.textContent = 'あなたのターンです！';
      ind.style.color = '#90ee90';
    } else {
      ind.textContent = (cp?.player_name || '?') + ' のターン';
      ind.style.color = cp?.color || '#a0d8ef';
    }

    const rollBtn = $('btn-roll');
    rollBtn.style.display = isMyTurn ? 'block' : 'none';
    rollBtn.disabled = false;
    rolling = false;
    $('turn-number').textContent = turnNumber;

    $('game-player-list').innerHTML = players.map((p, i) => {
      const pos = playerPositions[p.player_id] || 1;
      return `<li class="gpl-item ${i === idx ? 'gpl-active' : ''}">
        <span class="player-dot" style="background:${p.color}"></span>
        <span>${p.player_name}</span>
        <span style="color:${p.color};margin-left:4px">${pos}マス</span>
      </li>`;
    }).join('');
  }

  // ── サイコロ ──
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
    const grad = ctx.createLinearGradient(0, 0, 0, CH);
    grad.addColorStop(0, '#0a1e30');
    grad.addColorStop(1, '#060f1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CW, CH);

    drawRoad();
    squares.forEach(drawSquare);
    drawTokens();
  }

  function drawRoad() {
    const roadW = SQ_H + GAP_Y;

    // 路の境界線（暗い大きい線）
    ctx.save();
    ctx.lineWidth   = roadW + 14;
    ctx.strokeStyle = '#05111c';
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    tracePath();
    ctx.stroke();

    // 路面（少し明るい）
    ctx.lineWidth   = roadW;
    ctx.strokeStyle = '#0d2235';
    tracePath();
    ctx.stroke();

    // 中心線（弱いストライプ）
    ctx.lineWidth   = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.setLineDash([16, 20]);
    tracePath();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function tracePath() {
    ctx.beginPath();
    squares.forEach(({ x, y }, i) => {
      const cx = x + SQ_W / 2, cy = y + SQ_H / 2;
      i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
    });
  }

  // マスの場所ごとの見た目
  function squareFill(num) {
    if (num === 1)      return ['#0d4a20', '#1a7a38'];   // START 緑
    if (num === 100)   return ['#4a3800', '#7a5c00'];   // GOAL  金
    if (num % 10 === 0) return ['#3a2600', '#5e3e00'];  // オレンジ
    if (num % 5  === 0) return ['#122040', '#1e3868'];  // 青
    return ['#0e2236', '#162e48'];                       // 通常
  }
  function squareBorder(num) {
    if (num === 1)      return '#3ae070';
    if (num === 100)   return '#ffd700';
    if (num % 10 === 0) return '#d09040';
    if (num % 5  === 0) return '#4890d8';
    return '#1e4a6e';
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y,      x + w, y + r,      r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h,  x + w - r, y + h,  r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x,      y + h,  x,      y + h - r, r);
    ctx.lineTo(x,      y + r);
    ctx.arcTo(x,      y,      x + r,  y,         r);
    ctx.closePath();
  }

  function drawSquare({ num, x, y }) {
    const isGoal  = num === 100;
    const isStart = num === 1;
    const w  = isGoal ? GOAL_W : SQ_W;
    const h  = isGoal ? GOAL_H : SQ_H;
    const sx = x + (SQ_W - w) / 2;
    const sy = y + (SQ_H - h) / 2;
    const r  = 10;

    const [c1, c2] = squareFill(num);

    // グラデーション塗りつぶし
    const g = ctx.createLinearGradient(sx, sy, sx, sy + h);
    g.addColorStop(0, c2);
    g.addColorStop(1, c1);

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = g;
    rr(sx, sy, w, h, r);
    ctx.fill();
    ctx.restore();

    // 枠線
    ctx.strokeStyle = squareBorder(num);
    ctx.lineWidth   = isGoal || isStart ? 3 : 1.5;
    rr(sx, sy, w, h, r);
    ctx.stroke();

    // 上辺の光沢
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle   = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(sx + 2, sy + 2, w - 4, h * 0.4, [r, r, 0, 0]);
    ctx.fill();
    ctx.restore();

    // テキスト
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    const cx = sx + w / 2, cy = sy + h / 2;

    if (isGoal) {
      ctx.fillStyle = '#ffd700';
      ctx.font      = 'bold 16px Segoe UI';
      ctx.fillText('GOAL', cx, cy - 14);
      ctx.font      = '26px serif';
      ctx.fillText('🏆', cx, cy + 12);
    } else if (isStart) {
      ctx.fillStyle = '#60ff90';
      ctx.font      = 'bold 14px Segoe UI';
      ctx.fillText('START', cx, cy);
    } else {
      const isSpecial = num % 5 === 0;
      ctx.fillStyle = isSpecial ? '#a0d8ff' : '#6a90aa';
      ctx.font      = isSpecial ? 'bold 14px Segoe UI' : '13px Segoe UI';
      ctx.fillText(num, cx, cy);
    }
  }

  // ── トークン ──
  function drawTokens() {
    const byPos = {};
    players.forEach(p => {
      const pos = playerPositions[p.player_id] || 1;
      (byPos[pos] = byPos[pos] || []).push(p);
    });

    Object.entries(byPos).forEach(([posStr, group]) => {
      const sqIdx = parseInt(posStr) - 1;
      if (sqIdx < 0 || sqIdx >= squares.length) return;
      const { x, y } = squares[sqIdx];
      const cx = x + SQ_W / 2, cy = y + SQ_H / 2;

      group.forEach((p, i) => {
        const off = tokenOffset(group.length, i);
        const tx = cx + off.x, ty = cy + off.y;
        const R  = 14;

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur  = 8;
        ctx.beginPath();
        ctx.arc(tx, ty, R, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.restore();

        // トークンの光沢
        const tg = ctx.createRadialGradient(tx - R * 0.3, ty - R * 0.3, R * 0.1, tx, ty, R);
        tg.addColorStop(0, 'rgba(255,255,255,0.5)');
        tg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(tx, ty, R, 0, Math.PI * 2);
        ctx.fillStyle = tg;
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.arc(tx, ty, R, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle    = '#000';
        ctx.font         = 'bold 11px Segoe UI';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.player_name[0].toUpperCase(), tx, ty);
      });
    });
  }

  function tokenOffset(total, i) {
    if (total === 1) return { x: 0, y: 0 };
    const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
    return { x: Math.cos(angle) * 13, y: Math.sin(angle) * 13 };
  }

}());
