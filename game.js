(function () {
  // --- タイトル → ゲーム画面の切り替え ---
  const titleScreen = document.getElementById('title-screen');
  const gameScreen  = document.getElementById('game-screen');

  document.getElementById('btn-go').addEventListener('click', () => {
    titleScreen.classList.add('fade-out');
    setTimeout(() => {
      titleScreen.style.display = 'none';
      gameScreen.classList.remove('hidden');
      // display が none → flex に切り替わった直後にクラスを付けて fade-in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          gameScreen.classList.add('visible');
        });
      });
    }, 600);
  });

  // --- ゲームロジック ---
  const canvas = document.getElementById('canvas');
  const ctx    = canvas.getContext('2d');

  const CELL        = 14;
  const COLS        = 60;
  const ROWS        = 44;
  const ALIVE_COLOR = '#a0d8ef';
  const DEAD_COLOR  = '#0d1b2a';
  const GRID_COLOR  = '#1a2a3a';

  canvas.width  = COLS * CELL;
  canvas.height = ROWS * CELL;

  let grid       = makeGrid();
  let running    = false;
  let generation = 0;
  let animId     = null;
  let lastTime   = 0;
  let fps        = 10;
  let drawing    = false;
  let drawValue  = 1;

  function makeGrid() {
    return Array.from({ length: ROWS }, () => new Uint8Array(COLS));
  }

  function nextGeneration() {
    const next = makeGrid();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const n = countNeighbors(r, c);
        const alive = grid[r][c];
        next[r][c] = alive ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0);
      }
    }
    grid = next;
    generation++;
  }

  function countNeighbors(r, c) {
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        count += grid[(r + dr + ROWS) % ROWS][(c + dc + COLS) % COLS];
      }
    }
    return count;
  }

  function draw() {
    ctx.fillStyle = DEAD_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth   = 0.5;
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(canvas.width, r * CELL); ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, canvas.height); ctx.stroke();
    }

    ctx.fillStyle = ALIVE_COLOR;
    let pop = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c]) {
          ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 1, CELL - 1);
          pop++;
        }
      }
    }

    document.getElementById('generation').textContent = generation;
    document.getElementById('population').textContent = pop;
  }

  function loop(timestamp) {
    if (!running) return;
    animId = requestAnimationFrame(loop);
    if (timestamp - lastTime < 1000 / fps) return;
    lastTime = timestamp;
    nextGeneration();
    draw();
  }

  function start() {
    if (running) return;
    running  = true;
    lastTime = performance.now();
    animId   = requestAnimationFrame(loop);
    updateStartBtn();
  }

  function stop() {
    running = false;
    if (animId) cancelAnimationFrame(animId);
    updateStartBtn();
  }

  function updateStartBtn() {
    const btn = document.getElementById('btn-start');
    btn.textContent = running ? '⏸ 停止' : '▶ 開始';
    btn.classList.toggle('running', running);
  }

  function cellFromEvent(e) {
    const rect  = canvas.getBoundingClientRect();
    const scaleX = COLS / rect.width;
    const scaleY = ROWS / rect.height;
    return {
      r: Math.floor((e.clientY - rect.top)  * scaleY),
      c: Math.floor((e.clientX - rect.left) * scaleX),
    };
  }

  const PRESETS = {
    glider:  [[0,1],[1,2],[2,0],[2,1],[2,2]],
    blinker: [[0,0],[0,1],[0,2]],
    pulsar: [
      [2,4],[2,5],[2,6],[2,10],[2,11],[2,12],
      [4,2],[4,7],[4,9],[4,14],[5,2],[5,7],[5,9],[5,14],[6,2],[6,7],[6,9],[6,14],
      [7,4],[7,5],[7,6],[7,10],[7,11],[7,12],
      [9,4],[9,5],[9,6],[9,10],[9,11],[9,12],
      [10,2],[10,7],[10,9],[10,14],[11,2],[11,7],[11,9],[11,14],[12,2],[12,7],[12,9],[12,14],
      [14,4],[14,5],[14,6],[14,10],[14,11],[14,12]
    ],
    gosper: [
      [5,1],[5,2],[6,1],[6,2],
      [5,11],[6,11],[7,11],[4,12],[8,12],[3,13],[9,13],[3,14],[9,14],
      [6,15],[4,16],[8,16],[5,17],[6,17],[7,17],[6,18],
      [3,21],[4,21],[5,21],[3,22],[4,22],[5,22],[2,23],[6,23],[1,25],[2,25],[6,25],[7,25],
      [3,35],[4,35],[3,36],[4,36]
    ]
  };

  function placePreset(name) {
    stop();
    grid = makeGrid();
    generation = 0;
    const cells = PRESETS[name];
    const minR  = Math.min(...cells.map(([r]) => r));
    const minC  = Math.min(...cells.map(([, c]) => c));
    const maxR  = Math.max(...cells.map(([r]) => r));
    const maxC  = Math.max(...cells.map(([, c]) => c));
    const offR  = Math.floor((ROWS - (maxR - minR)) / 2) - minR;
    const offC  = Math.floor((COLS - (maxC - minC)) / 2) - minC;
    for (const [r, c] of cells) {
      const nr = r + offR, nc = c + offC;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) grid[nr][nc] = 1;
    }
    draw();
  }

  // コントロール
  document.getElementById('btn-start').addEventListener('click', () => running ? stop() : start());
  document.getElementById('btn-step').addEventListener('click', () => { stop(); nextGeneration(); draw(); });
  document.getElementById('btn-random').addEventListener('click', () => {
    stop(); generation = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        grid[r][c] = Math.random() < 0.3 ? 1 : 0;
    draw();
  });
  document.getElementById('btn-clear').addEventListener('click', () => { stop(); grid = makeGrid(); generation = 0; draw(); });
  document.getElementById('speed').addEventListener('input', function () {
    fps = parseInt(this.value, 10);
    document.getElementById('speed-label').textContent = fps + ' fps';
  });
  document.querySelectorAll('.preset-btn').forEach(btn =>
    btn.addEventListener('click', () => placePreset(btn.dataset.preset))
  );

  // マウス描画
  canvas.addEventListener('mousedown', (e) => {
    drawing = true;
    const { r, c } = cellFromEvent(e);
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) { drawValue = grid[r][c] ? 0 : 1; grid[r][c] = drawValue; draw(); }
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    const { r, c } = cellFromEvent(e);
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) { grid[r][c] = drawValue; draw(); }
  });
  window.addEventListener('mouseup', () => { drawing = false; });

  // タッチ描画
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); drawing = true;
    const { r, c } = cellFromEvent(e.touches[0]);
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) { drawValue = grid[r][c] ? 0 : 1; grid[r][c] = drawValue; draw(); }
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault(); if (!drawing) return;
    const { r, c } = cellFromEvent(e.touches[0]);
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) { grid[r][c] = drawValue; draw(); }
  }, { passive: false });
  window.addEventListener('touchend', () => { drawing = false; });

  draw();
}());
