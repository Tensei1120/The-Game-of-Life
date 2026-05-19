(function () {
  'use strict';

  // ──────────────────────────────────────────
  // Supabase
  // ──────────────────────────────────────────
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

  const isConfigured = !SUPABASE_URL.includes('YOUR_PROJECT_ID');

  // ──────────────────────────────────────────
  // ゲーム定数
  // ──────────────────────────────────────────
  const COLS           = 60;
  const ROWS           = 44;
  const CELL           = 14;
  const CELLS_PER_TURN = 5;
  const SIM_GENS       = 10;
  const PLAYER_COLORS  = ['#a0d8ef','#f08080','#90ee90','#ffd700','#da70d6','#ff8c00'];
  const ALIVE_COLOR    = '#a0d8ef';
  const DEAD_COLOR     = '#0d1b2a';
  const GRID_COLOR     = '#1a2a3a';

  // ──────────────────────────────────────────
  // セッションID
  // ──────────────────────────────────────────
  let myId = sessionStorage.getItem('gol_pid');
  if (!myId) { myId = crypto.randomUUID(); sessionStorage.setItem('gol_pid', myId); }

  // ──────────────────────────────────────────
  // 状態
  // ──────────────────────────────────────────
  let myName  = '';
  let roomId  = '';
  let players = [];
  let isHost  = false;

  let aliveCells          = new Set();
  let currentTurnCells    = new Set();
  let cellsPlacedThisTurn = 0;
  let currentPlayerIndex  = 0;
  let turnNumber          = 0;
  let isMyTurn            = false;
  let simulating          = false;

  let channel = null;

  // ──────────────────────────────────────────
  // DOMヘルパー
  // ──────────────────────────────────────────
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

  // ──────────────────────────────────────────
  // タイトル → あいことば入力
  // ──────────────────────────────────────────
  $('btn-go').addEventListener('click', () => showScreen('word-screen'));

  // ──────────────────────────────────────────
  // あいことば入力 → 待機室
  // ──────────────────────────────────────────
  const nameInput = $('name-input');
  const wordInput = $('word-input');
  const wordError = $('word-error');

  $('btn-create').addEventListener('click', enterRoom);
  nameInput.addEventListener('keydown', e => e.key === 'Enter' && wordInput.focus());
  wordInput.addEventListener('keydown', e => e.key === 'Enter' && enterRoom());

  async function enterRoom() {
    // Supabase未設定の場合は明確なエラーを表示
    if (!isConfigured) {
      wordError.innerHTML =
        'Supabaseが未設定です。<br>' +
        'config.jsの SUPABASE_URL と SUPABASE_ANON を書き換えてください。';
      return;
    }

    const name = nameInput.value.trim();
    const word = wordInput.value.trim();
    if (!name) { wordError.textContent = '名前を入力してください'; nameInput.focus(); return; }
    if (!word) { wordError.textContent = 'あいことばを入力してください'; wordInput.focus(); return; }
    wordError.textContent = '';

    const btn = $('btn-create');
    btn.disabled    = true;
    btn.textContent = '接続中...';

    myName = name;
    roomId = word.toLowerCase().replace(/\s+/g, '-');

    try {
      const { data: existing, error: fetchErr } = await sb
        .from('rooms')
        .select('id, host_id')
        .eq('id', roomId)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      if (!existing) {
        const { error } = await sb.from('rooms').insert({
          id: roomId, host_id: myId, alive_cells: []
        });
        if (error) throw error;
        isHost = true;
      } else {
        isHost = existing.host_id === myId;
      }

      const { data: existingPlayers } = await sb
        .from('room_players')
        .select('color')
        .eq('room_id', roomId);
      const usedColors = (existingPlayers || []).map(p => p.color);
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
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        wordError.textContent = 'ネットワークエラーです。SUPABASE_URLが正しいか確認してください。';
      } else if (msg.includes('Invalid API key') || msg.includes('apikey')) {
        wordError.textContent = 'APIキーが正しくありません。SUPABASE_ANONを確認してください。';
      } else {
        wordError.textContent = '接続エラー: ' + (msg || '不明なエラー。コンソールを確認してください。');
      }
    } finally {
      btn.disabled    = false;
      btn.textContent = 'ルームに入る';
    }
  }

  // ──────────────────────────────────────────
  // 待機室
  // ──────────────────────────────────────────
  async function refreshPlayers() {
    const { data } = await sb
      .from('room_players')
      .select('*')
      .eq('room_id', roomId)
      .order('joined_at');
    players = data || [];
    renderLobby();
  }

  function renderLobby() {
    $('lobby-room-name').textContent = 'ルーム: ' + roomId;
    $('player-list').innerHTML = players.map(p => `
      <li class="player-item">
        <span class="player-dot" style="background:${p.color}"></span>
        <span class="player-name">${p.player_name}${p.is_host ? ' 👑' : ''}</span>
      </li>
    `).join('');
    $('btn-lobby-start').style.display = isHost ? 'block' : 'none';
    $('lobby-hint').style.display      = isHost ? 'none'  : 'block';
  }

  $('btn-lobby-start').addEventListener('click', async () => {
    await sb.from('rooms').update({ status: 'playing' }).eq('id', roomId);
  });

  // ──────────────────────────────────────────
  // Supabase Realtime
  // ──────────────────────────────────────────
  function subscribeRoom() {
    channel = sb.channel('room-' + roomId)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}`
      }, payload => onRoomChange(payload.new))
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}`
      }, () => refreshPlayers())
      .subscribe();
  }

  async function onRoomChange(room) {
    if (!room) return;
    if (room.status === 'playing') {
      const { data } = await sb
        .from('room_players')
        .select('*')
        .eq('room_id', roomId)
        .order('joined_at');
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

  // ──────────────────────────────────────────
  // Canvas
  // ──────────────────────────────────────────
  const canvas = $('canvas');
  const ctx    = canvas.getContext('2d');
  canvas.width  = COLS * CELL;
  canvas.height = ROWS * CELL;

  function applyRoomState(room) {
    aliveCells          = new Set((room.alive_cells || []).map(([r,c]) => `${r},${c}`));
    currentPlayerIndex  = room.current_player_index || 0;
    turnNumber          = room.turn_number || 0;
    currentTurnCells    = new Set();
    cellsPlacedThisTurn = 0;
    updateTurnUI();
    drawCanvas();
  }

  // ──────────────────────────────────────────
  // ターンUI
  // ──────────────────────────────────────────
  function updateTurnUI() {
    if (!players.length) return;
    const idx = currentPlayerIndex % players.length;
    const cp  = players[idx];
    isMyTurn  = cp && cp.player_id === myId;

    const ind = $('turn-indicator');
    if (isMyTurn) {
      ind.textContent = 'あなたのターンです！';
      ind.style.color = '#90ee90';
    } else {
      ind.textContent = (cp?.player_name || '?') + ' のターン';
      ind.style.color = cp?.color || '#a0d8ef';
    }

    $('cells-remaining').textContent = isMyTurn
      ? `残り ${CELLS_PER_TURN - cellsPlacedThisTurn} セル配置できます`
      : '';

    const doneBtn = $('btn-done');
    doneBtn.style.display = isMyTurn ? 'block' : 'none';
    doneBtn.disabled      = false;
    $('turn-number').textContent = turnNumber;

    $('game-player-list').innerHTML = players.map((p, i) => `
      <li class="gpl-item ${i === idx ? 'gpl-active' : ''}">
        <span class="player-dot" style="background:${p.color}"></span>
        <span>${p.player_name}</span>
      </li>
    `).join('');
  }

  // ──────────────────────────────────────────
  // ターン終了ボタン
  // ──────────────────────────────────────────
  $('btn-done').addEventListener('click', async () => {
    if (!isMyTurn || simulating) return;
    $('btn-done').disabled = true;

    const nextIndex    = (currentPlayerIndex + 1) % players.length;
    const isLastPlayer = nextIndex === 0;

    let newAlive = [...aliveCells].map(k => k.split(',').map(Number));

    if (isLastPlayer) {
      simulating = true;
      $('sim-overlay').classList.remove('hidden');
      await sleep(400);
      newAlive = runSimulation(newAlive, SIM_GENS);
      await sleep(300);
      $('sim-overlay').classList.add('hidden');
      simulating = false;
    }

    await sb.from('rooms').update({
      alive_cells:           newAlive,
      current_player_index:  nextIndex,
      turn_number:           isLastPlayer ? turnNumber + 1 : turnNumber,
    }).eq('id', roomId);
  });

  // ──────────────────────────────────────────
  // シミュレーション
  // ──────────────────────────────────────────
  function runSimulation(pairs, gens) {
    let cells = new Set(pairs.map(([r,c]) => `${r},${c}`));
    for (let g = 0; g < gens; g++) cells = stepCells(cells);
    return [...cells].map(k => k.split(',').map(Number));
  }

  function stepCells(cells) {
    const counts = new Map();
    for (const key of cells) {
      const [r, c] = key.split(',').map(Number);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nk = `${(r+dr+ROWS)%ROWS},${(c+dc+COLS)%COLS}`;
          counts.set(nk, (counts.get(nk) || 0) + 1);
        }
      }
    }
    const next = new Set();
    for (const [k, n] of counts)
      if (n === 3 || (n === 2 && cells.has(k))) next.add(k);
    return next;
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ──────────────────────────────────────────
  // Canvas描画
  // ──────────────────────────────────────────
  function drawCanvas() {
    ctx.fillStyle = DEAD_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth   = 0.5;
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r*CELL); ctx.lineTo(canvas.width, r*CELL); ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c*CELL, 0); ctx.lineTo(c*CELL, canvas.height); ctx.stroke();
    }

    ctx.fillStyle = ALIVE_COLOR;
    for (const key of aliveCells) {
      if (!currentTurnCells.has(key)) {
        const [r, c] = key.split(',').map(Number);
        ctx.fillRect(c*CELL+1, r*CELL+1, CELL-1, CELL-1);
      }
    }

    const idx     = currentPlayerIndex % Math.max(players.length, 1);
    const myColor = players[idx]?.color || ALIVE_COLOR;
    ctx.fillStyle = myColor;
    for (const key of currentTurnCells) {
      const [r, c] = key.split(',').map(Number);
      ctx.fillRect(c*CELL+1, r*CELL+1, CELL-1, CELL-1);
    }

    $('population').textContent = aliveCells.size;
  }

  // ──────────────────────────────────────────
  // セル配置
  // ──────────────────────────────────────────
  function cellFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      r: Math.floor((e.clientY - rect.top)  * ROWS / rect.height),
      c: Math.floor((e.clientX - rect.left) * COLS / rect.width),
    };
  }

  let drawing   = false;
  let drawValue = true;

  function onPointerDown(pos) {
    if (!isMyTurn || simulating) return;
    drawing   = true;
    drawValue = !aliveCells.has(`${pos.r},${pos.c}`);
    applyCell(pos);
  }

  function onPointerMove(pos) {
    if (!drawing || !isMyTurn || simulating) return;
    applyCell(pos);
  }

  function applyCell({ r, c }) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
    const key = `${r},${c}`;
    if (drawValue) {
      if (!aliveCells.has(key) && cellsPlacedThisTurn < CELLS_PER_TURN) {
        aliveCells.add(key);
        currentTurnCells.add(key);
        cellsPlacedThisTurn++;
        $('cells-remaining').textContent = `残り ${CELLS_PER_TURN - cellsPlacedThisTurn} セル配置できます`;
        drawCanvas();
      }
    } else {
      if (currentTurnCells.has(key)) {
        aliveCells.delete(key);
        currentTurnCells.delete(key);
        cellsPlacedThisTurn--;
        $('cells-remaining').textContent = `残り ${CELLS_PER_TURN - cellsPlacedThisTurn} セル配置できます`;
        drawCanvas();
      }
    }
  }

  canvas.addEventListener('mousedown', e => onPointerDown(cellFromEvent(e)));
  canvas.addEventListener('mousemove', e => onPointerMove(cellFromEvent(e)));
  window.addEventListener('mouseup',   () => { drawing = false; });

  canvas.addEventListener('touchstart', e => { e.preventDefault(); onPointerDown(cellFromEvent(e.touches[0])); }, { passive: false });
  canvas.addEventListener('touchmove',  e => { e.preventDefault(); onPointerMove(cellFromEvent(e.touches[0])); }, { passive: false });
  window.addEventListener('touchend',   () => { drawing = false; });

}());
