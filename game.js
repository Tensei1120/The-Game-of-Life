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
  const HOSP_TOTAL = 12;
  // ∩型（上に凸）: 入院マス(左下) → 上アーチ → 退院マス(右下)、二本の腕の間は小さな隙間
  const HOSP_WAYPOINTS = [
    [480,820],[350,640],[200,450],[150,280],[200,155],[560,100],[920,155],[970,280],[920,450],[770,640],[640,820]
  ];
  const BRANCH_START  = 20, BRANCH_END = 30;
  const PLAYER_COLORS = [
    '#1565c0','#c62828','#2e7d32','#e65100',
    '#6a1b9a','#00838f','#f9a825','#ad1457','#37474f'
  ];

  const EVENTS = [
    // ── 全員共通 ──
    { id:1,  minPos:1, maxPos:10, name:'この時間が、ずっと続くと思ってた。', item:'友達', happiness:2 },
    { id:2,  minPos:1, maxPos:10, name:'「はいはい、お母さんが全部悪いのね。お母さんは南極にでも行ってペンギンさん達と仲良く暮らしますから。（プレイヤー名）はお父さんと幸せに暮らして。」', happiness:-3 },
    { id:3,  minPos:1, maxPos:10, name:'昼休み鬼ごっこした！！', item:'友達', happiness:2, health:1 },
    { id:4,  minPos:1, maxPos:10, name:'おかわりじゃんけん5連勝中！！', happiness:1 },
    { id:5,  minPos:1, maxPos:10, name:'牛乳パック潰して先生に怒られた…。', happiness:-1 },
    { id:7,  minPos:1, maxPos:10, name:'おじいちゃんからお小遣いもらった！！！', money:1, happiness:3 },
    { id:8,  minPos:1, maxPos:10, name:'夏休みおばあちゃん家に行った！！', happiness:3 },
    { id:9,  minPos:1, maxPos:10, name:'ランドセルじゃんけん負けた…。', health:-1 },
    { id:10, minPos:1, maxPos:10, name:'バスケで突き指…。', happiness:-1, health:-2 },
    { id:12, minPos:1, maxPos:10, name:'ドッチボール大会で優勝した！！', item:'友達', happiness:3 },
    { id:13, minPos:1, maxPos:10, name:'スケボーで転んで骨折れた…。でもなんか包帯かっこいいかも！？', happiness:1, health:-4 },
    // ── 好きな人 限定 ──
    { id:14, minPos:1, maxPos:10, requireItem:'好きな人', name:'別にあいつのことなんて好きじゃねえし！', happiness:-3, removeItem:'好きな人' },
    // ── 親のスネ 限定 ──
    { id:15, minPos:1, maxPos:10, requireItem:'親のスネ', name:'少年野球チームに入団！', item:'グローブ' },
    { id:16, minPos:1, maxPos:10, requireItem:'親のスネ', name:'塾に入れられた…', item:'塾のテキスト' },
    { id:17, minPos:1, maxPos:10, requireItem:'親のスネ', name:'ピアノ教室に入った', item:'ピアノ' },
    { id:18, minPos:1, maxPos:10, requireItem:'親のスネ', name:'家族旅行で埼玉にいった。微妙だった。', happiness:1 },
    { id:19, minPos:1, maxPos:10, requireItem:'親のスネ', name:'家族旅行で沖縄にいった！', happiness:4 },
    // ── 教育ママ 限定 ──
    { id:20, minPos:1, maxPos:10, requireItem:'教育ママ', name:'９０点取ったのにママに怒られた…', happiness:-4 },
    { id:21, minPos:1, maxPos:10, requireItem:'教育ママ', name:'ママにお泊りはダメって言われた…', happiness:-2 },
    { id:22, minPos:1, maxPos:10, requireItem:'教育ママ', name:'子役事務所に入れられた！', setJob:'俳優' },
    // ── 貧困家庭 限定 ──
    { id:23, minPos:1, maxPos:10, requireItem:'貧困家庭', name:'久しぶりの外食！それでも俺はチキンライスでいいや。', happiness:5, health:1 },
    { id:24, minPos:1, maxPos:10, requireItem:'貧困家庭', name:'泣き腫らした目で、一般家庭を睨んだ。', happiness:-3, item:'根性' },
    { id:50, minPos:1, maxPos:10, name:'あの頃みたいな友達は、もうできない。', item:'友達' },
    { id:51, minPos:1, maxPos:10, special:true, name:'「（プレイヤー名）菌だ！」と言われ、逃げ回られる。', happiness:-2, nameItem:'菌' },
    { id:55, minPos:1, maxPos:10, special:true, name:'クリボーに当たって死んだ！', eliminate:true },
    { id:56, minPos:1, maxPos:10, special:true, name:'未来からモラえもんがやってきた！', item:'モラえもん' },
    // ── 親のスネ 限定 ──
    { id:52, minPos:1, maxPos:10, requireItem:'親のスネ', name:'自転車を買ってもらった！', item:'自転車' },
    // ── 職業「俳優」限定 ──
    { id:53, minPos:1, maxPos:10, requireJob:'俳優', name:'「もろもろむりむりダンス」が大流行。国民的子役になる。', jobBonusDelta:{salary:20,health:-2} },
    // ── 昭和親父 限定 ──
    { id:25, minPos:1, maxPos:10, requireItem:'昭和親父', name:'地獄のトレーニングを受ける。', item:'大選手養成ギプス' },
    { id:26, minPos:1, maxPos:10, requireItem:'昭和親父', name:'「地区大会で優勝したくらいで調子に乗るな！あんなろくでもない集団に１点でも取られたことを恥と思え馬鹿者！」', happiness:-3 },

    // ═══════════ 11〜20マス ═══════════
    // ── 全員共通 ──
    { id:27, minPos:11, maxPos:19, name:'男子校の下駄箱の匂いは、常軌を逸している。', item:'男子校の呪い', health:-3 },
    { id:28, minPos:11, maxPos:19, name:'ここ2か月、部活のオフがない。', happiness:-5, health:-5, item:'根性' },
    { id:29, minPos:11, maxPos:19, name:'徹夜で課題を終わらせた。', happiness:1, health:-4 },
    { id:30, minPos:11, maxPos:19, name:'雨の日の女子校は靴下が干してある。', item:'女子校ブランド' },
    { id:31, minPos:11, maxPos:19, name:'この時母さんに言った一言を未だに後悔している。', happiness:-3 },
    { id:32, minPos:11, maxPos:19, name:'ツッパることが男のたった一つの勲章だって、この胸に信じて生きてきた。', item:'悪い友達' },
    { id:34, minPos:11, maxPos:19, name:'模試でE判定…', happiness:-6 },
    { id:35, minPos:11, maxPos:19, name:'模試でA判定！', happiness:3 },
    { id:37, minPos:11, maxPos:19, name:'「この世界は腐ってる。ならこんな世界、俺がぶっ壊してやる！…裏社会のやつらは俺をこう呼ぶ…"堕天使"と。世界を牛耳る悪の組…', item:'黒歴史ノート' },
    { id:38, minPos:11, maxPos:19, name:'後ろの席のやつと仲良くなった！', item:'友達' },
    { id:39, minPos:11, maxPos:19, name:'「おい貧乏人２号、100万やるから俺の舎弟になれ」', money:100, item:'金持ち友達' },
    // ── 条件あり（持っていないとき） ──
    { id:33, minPos:11, maxPos:19, requireNotItem:'好きな人', name:'文化祭で一目惚れした。', item:'好きな人' },
    { id:36, minPos:11, maxPos:19, requireNotItem:'塾のテキスト', name:'あたし、やっぱり慶應にいきたい。', item:'塾のテキスト' },
    // ── 好きな人 限定 ──
    { id:40, minPos:11, maxPos:19, requireItem:'好きな人', requireNotItem:'男子校の呪い', name:'好きな人と付き合った！', happiness:10, upgradeItem:{from:'好きな人',to:'恋人'} },
    // ── 昭和親父 限定 ──
    { id:41, minPos:11, maxPos:19, requireItems:['昭和親父','大選手養成ギプス'], name:'度を越えたトレーニングをさせられた。', upgradeItem:{from:'大選手養成ギプス',to:'ジーザス・ギプス'} },
    { id:42, minPos:11, maxPos:19, requireItem:'昭和親父', name:'「甲子園に出たくらいで調子に乗るな馬鹿者！優勝せんかったらお前は一年間飯抜きだ！」', happiness:-5 },
    // ── 教育ママ 限定 ──
    { id:43, minPos:11, maxPos:19, requireItem:'教育ママ', name:'中学受験してなかったら、今頃皆と笑いあえていたのかな。', happiness:-3 },
    { id:44, minPos:11, maxPos:19, requireItem:'教育ママ', name:'朝4時に母の呼び覚ます声を聞き、机に向かう毎日。', happiness:-2, health:-4 },
    // ── 貧困家庭 限定 ──
    { id:45, minPos:11, maxPos:19, requireItem:'貧困家庭', name:'週８でバイトしている。', money:8, health:-4 },
    // ── 親のスネ 限定 ──
    { id:46, minPos:11, maxPos:19, requireItem:'親のスネ', name:'お小遣いが増えた！', itemBonusDelta:{'親のスネ':{money:1}}, happiness:1 },
    { id:47, minPos:11, maxPos:19, requireItem:'親のスネ', name:'「家族旅行もこれで最後かしらね…」と言う母の瞳に寂しさが映る。', happiness:2 },
    { id:48, minPos:11, maxPos:19, requireItem:'親のスネ', name:'バイトした！！', money:2 },
    { id:49, minPos:11, maxPos:19, requireItems:['親のスネ','友達'], name:'ディ〇ニーリゾートに宿泊した！', money:-10, happiness:3 },
  ];

  const ITEMS = {
    '親のスネ':         { desc:'毎ターン3万円獲得\n幸福度+1・健康度+1',                                          perTurn:{money:3,happiness:1,health:1},  transformAt:{pos:50,into:'親のセワ'} },
    '親のセワ':         { desc:'毎ターン5万円失う・健康度-2\n捨てられない',                                      perTurn:{money:-5,health:-2},            undiscardable:true,  disappearAt:90 },
    '教育ママ':         { desc:'20マス目まで捨てられない\n塾のテキスト・ピアノ・水泳教室を守る\n20マス目で大学ルート強制', undiscardableUntil:20, protects:['塾のテキスト','ピアノ','水泳教室'], forceRoute:{pos:20,route:'uni'} },
    '塾のテキスト':     { desc:'毎ターン幸福度-3\n20マス目で消滅',                                              perTurn:{happiness:-3},                  disappearAt:20 },
    'ピアノ':           { desc:'毎ターン幸福度+1\n捨てると50万円獲得',                                          perTurn:{happiness:1},                   onDiscard:{money:50} },
    '水泳教室':         { desc:'毎ターン健康度+1',                                                              perTurn:{health:1} },
    '貧困家庭':         { desc:'毎ターン1万円失う・健康度-1\n所持金20万円超で消滅\n20マス目で就職ルート強制',   perTurn:{money:-1,health:-1},            disappearIfMoneyAbove:20, forceRoute:{pos:20,route:'job'} },
    '昭和親父':         { desc:'20マス目まで捨てられない\nグローブを守る',                                      undiscardableUntil:20, protects:['グローブ'] },
    'グローブ':         { desc:'毎ターン健康度+1',                                                              perTurn:{health:1} },
    '友達':             { desc:'毎ターン幸福度+3',                                                              perTurn:{happiness:3} },
    '好きな人':         { desc:'恋人イベント開放' },
    'イーロン・マスクメロン': { desc:'毎ターン50万円獲得\n捨てると200万円獲得',                               perTurn:{money:50},                      onDiscard:{money:200} },
    '大選手養成ギプス': { desc:'毎ターン幸福度-1・健康度-3',                                                    perTurn:{happiness:-1,health:-3} },
    '根性':             { desc:'健康度-5まで入院回避\n入院代が二倍になる' },
    '男子校の呪い':     { desc:'「恋人」イベントが発生しない' },
    '女子校ブランド':   { desc:'毎ターン+2万円', perTurn:{money:2} },
    '悪い友達':         { desc:'毎ターン+5万円', perTurn:{money:5} },
    '黒歴史ノート':     { desc:'毎ターン幸福度-5', perTurn:{happiness:-5} },
    '恋人':             { desc:'毎ターン幸福度+6', perTurn:{happiness:6} },
    '金持ち友達':       { desc:'毎ターン+5万円', perTurn:{money:5} },
    'ジーザス・ギプス': { desc:'毎ターン幸福度-1・健康度-4', perTurn:{happiness:-1,health:-4} },
    'モラえもん':       { desc:'（効果未定）' },
    '自転車':           { desc:'移動時サイコロ+1\n捨てると3万円獲得', diceBonus:1, onDiscard:{money:3} },
  };

  const JOBS = {
    '俳優': { salary:0, happiness:2, health:1, desc:'給料0万/ターン\n幸福度+2・健康度+1' },
  };

  const UNIVERSITIES = [
    { name:'Fラン大学生', prob:0.20, tuition:40 },
    { name:'専門学校生',  prob:0.30, tuition:40 },
    { name:'普通大学生',  prob:0.30, tuition:40 },
    { name:'高学歴学生',  prob:0.15, tuition:50 },
    { name:'医学部生',    prob:0.05, tuition:100 },
  ];
  function rollUniversity(){
    let r=Math.random();
    for(const u of UNIVERSITIES){ r-=u.prob; if(r<=0) return u; }
    return UNIVERSITIES[UNIVERSITIES.length-1];
  }

  function isBacteriaItem(name){ return typeof name==='string'&&name.endsWith('菌'); }

  function rollStartItems(){
    const r=Math.random();
    if(r<0.50) return ['親のスネ'];
    if(r<0.69) return [];                         // 19%（元20%から1%削減）
    if(r<0.70) return ['イーロン・マスクメロン']; // 1%
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

  let showHospitalMap = false;

  let myId = sessionStorage.getItem('gol_pid');
  if (!myId) { myId = crypto.randomUUID(); sessionStorage.setItem('gol_pid', myId); }

  let myName='', roomId='', players=[], isHost=false, playerData={};
  let currentPlayerIndex=0, turnNumber=0, isMyTurn=false, rolling=false, channel=null;
  let pendingRoll = null, pendingCommit = null, prevPlayerData = {};
  const processedImgCache = {};
  let itemAcquisitionQueue = [], itemAcquisitionActive = false, gameStartShown = false;
  let lastActionInfo = null, observerAnimCancel = false, observerAnimating = false;
  let broadcastHandledPid = null, pendingObserverEvent = null, observerRealtimeData = null;
  let observerHospitalAnimPos = {};

  function defaultStats(pos=0) {
    return { pos, money:0, happiness:MAX_HAPPINESS, health:MAX_HEALTH,
             items:Array(6).fill(null), job:null, route:null, finished:false,
             hospitalized:false, hospitalPos:0, hospitalTurns:0, prevMapPos:0,
             itemBonuses:{}, jobBonuses:{}, eliminated:false, uni:null, ronin:false };
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

  function buildHospitalSquares() {
    const segLens = []; let total = 0;
    for (let i = 1; i < HOSP_WAYPOINTS.length; i++) {
      const dx = HOSP_WAYPOINTS[i][0]-HOSP_WAYPOINTS[i-1][0], dy = HOSP_WAYPOINTS[i][1]-HOSP_WAYPOINTS[i-1][1];
      segLens.push(Math.sqrt(dx*dx+dy*dy)); total += segLens[segLens.length-1];
    }
    const spacing = total / HOSP_TOTAL;

    function ptAt(d) {
      d = Math.max(0, Math.min(total, d));
      let traveled = 0, seg = 0;
      while (seg < segLens.length-1 && traveled+segLens[seg] < d) traveled += segLens[seg++];
      const t = segLens[seg]>0 ? (d-traveled)/segLens[seg] : 0;
      const p0 = HOSP_WAYPOINTS[seg], p1 = HOSP_WAYPOINTS[Math.min(seg+1,HOSP_WAYPOINTS.length-1)];
      return {
        cx: p0[0]+(p1[0]-p0[0])*t, cy: p0[1]+(p1[1]-p0[1])*t,
        angle: Math.atan2(p1[1]-p0[1], p1[0]-p0[0])
      };
    }

    const sqs = [];
    const ha = spacing / 2 - 3;
    for (let n = 0; n <= HOSP_TOTAL; n++) {
      const cDist = n * spacing;
      const center = ptAt(cDist);
      const back  = ptAt(cDist - ha);
      const front = ptAt(cDist + ha);
      const hw = n===HOSP_TOTAL ? SQ_ACROSS*0.75/2 : SQ_ACROSS/2;
      const bP = perp(back.angle), fP = perp(front.angle);
      sqs.push({
        num: n, cx: (back.cx+front.cx)/2, cy: (back.cy+front.cy)/2,
        corners: [
          { x: back.cx  + bP.nx*hw, y: back.cy  + bP.ny*hw },
          { x: front.cx + fP.nx*hw, y: front.cy + fP.ny*hw },
          { x: front.cx - fP.nx*hw, y: front.cy - fP.ny*hw },
          { x: back.cx  - bP.nx*hw, y: back.cy  - bP.ny*hw },
        ]
      });
    }
    return { sqs, sqAlong: spacing, sqAcross: SQ_ACROSS };
  }

  const hospitalSquares = buildHospitalSquares();

  // Hospital background image
  let hospBgImg = null;
  (function(){ const img=new Image(); img.onload=()=>hospBgImg=img; img.src='items/IMG_3704.jpg'; })();

  // TEMPORARY: health=0 test button
  (function(){
    const testBtn = document.createElement('button');
    testBtn.textContent = '🏥 健康度0テスト';
    testBtn.style.cssText = 'position:fixed;bottom:80px;right:16px;z-index:999;padding:8px 14px;background:#e74c3c;color:#fff;border:none;border-radius:8px;font-size:.85rem;font-weight:700;cursor:pointer;';
    testBtn.onclick = async () => {
      if(!isMyTurn||rolling) return;
      rolling=true; $('btn-roll').disabled=true;
      const st=getStats(playerData[myId]);
      await doCommitSave({...st,health:-999},Array.isArray(playerData.__used_events)?playerData.__used_events:[]);
      rolling=false; $('btn-roll').disabled=false;
    };
    document.body.appendChild(testBtn);
  })();

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
      .on('broadcast',{event:'turn_action'},   ({payload})=>onObserverBroadcast(payload))
      .on('broadcast',{event:'turn_event'},    ({payload})=>onObserverEventBroadcast(payload))
      .on('broadcast',{event:'hospital_action'},({payload})=>onObserverHospitalBroadcast(payload))
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
      if(room.status==='playing'&&!gameStartShown){
        gameStartShown=true;
        setTimeout(showGameStart,500);
      }
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
    const newRoomData=room.alive_cells||{};
    const action=newRoomData.__last_action;
    currentPlayerIndex=room.current_player_index||0;
    turnNumber=room.turn_number||0;

    // doCommitSave がローカル状態を既に更新済みなので Realtime は無視する
    if(action&&action.pid===myId) return;

    if(observerAnimating){
      playerData=newRoomData;
      observerRealtimeData=newRoomData;
      updateTurnUI();
      return;
    }

    prevPlayerData={...playerData};
    playerData=newRoomData;
    updateTurnUI();

    if(action&&action.pid!==myId){
      // broadcast が先に届いてアニメ済みなら再アニメしない
      if(action.pid===broadcastHandledPid){
        broadcastHandledPid=null;
        drawBoard();
        requestAnimationFrame(showStatDeltas);
        return;
      }
      broadcastHandledPid=null;
      // broadcast が届かなかった場合の DB フォールバック
      const fromSt=getStats(prevPlayerData[action.pid]);
      const toSt=getStats(newRoomData[action.pid]);
      if(fromSt.pos!==toSt.pos){
        observerAnimCancel=true;
        setTimeout(()=>{
          observerAnimCancel=false;
          runObserverAnimation(
            action.pid, action.roll||1, fromSt, toSt.pos, action.route||null,
            action.eventName||null, action.eventEffect||null, action.eventRequireItem||null
          );
        },80);
        return;
      }
    }
    drawBoard();
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
    const activeSt = getStats(playerData[players[idx]?.player_id]);
    showHospitalMap = !!activeSt?.hospitalized;
    const ind=$('turn-indicator');
    if(isMyTurn){ind.textContent='あなたのターンです！';ind.style.color='#228844';}
    else{ind.textContent=(cp?.player_name||'?')+' のターン';ind.style.color=cp?.color||'#1565c0';}
    const mySt=getStats(playerData[myId]);
    const myFinished=!!mySt.finished||!!mySt.eliminated;
    const rb=$('btn-roll');
    rb.style.display=(isMyTurn&&!myFinished)?'block':'none';rb.disabled=false;rolling=false;
    $('turn-number').textContent=turnNumber;
    renderPlayerStatusCards(idx);
    requestAnimationFrame(processSlotImages);
    drawBoard();
  }

  function processSlotImages(){
    document.querySelectorAll('.item-slot-img[data-item-img]').forEach(img=>{
      const item=img.dataset.itemImg; if(!item) return;
      if(processedImgCache[item]){ img.src=processedImgCache[item]; return; }
      const loader=new Image();
      loader.onload=()=>{
        try{
          const processed=removeWhiteBg(loader);
          processedImgCache[item]=processed;
          document.querySelectorAll(`.item-slot-img[data-item-img="${item}"]`).forEach(el=>{ el.src=processed; });
        }catch(e){}
      };
      loader.onerror=()=>{ if(!loader.src.endsWith('.jpg')) loader.src=`items/${item}.jpg`; };
      loader.src=getItemImg(item);
    });
  }

  function renderPlayerStatusCards(activeIdx){
    $('player-status-area').innerHTML=players.map((p,i)=>{
      const st=getStats(playerData[p.player_id]);
      const uniIcon=st.uni?'🎓 ':st.route==='uni'?'🎓 ':'💼 ';
      const jobLabel=st.uni?st.uni
        :st.route==='uni'?'大学ルート'+(st.ronin?' (浪人中)':'')
        :(st.job||'未定')+(st.route==='job'?' 就職':'');
      const isMine=p.player_id===myId;
      const bg=item=>ITEM_BG[item]||(isBacteriaItem(item)?'linear-gradient(150deg,#7dba6e 0%,#2e7d32 100%)':'linear-gradient(135deg,#c6d9f6,#deeeff)');
      const itemsHtml=st.items.map(item=>
        item?`<div class="item-slot filled" data-item="${item}" style="background:${bg(item)}">
                <img class="item-slot-img" src="" data-item-img="${item}" alt="${item}">
              </div>`
            :`<div class="item-slot">∅</div>`
      ).join('');
      return `
        <div class="psc${i===activeIdx?' psc-active':''}${isMine?' psc-mine':''}">
          <div class="psc-header">
            <span class="psc-dot" style="background:${p.color}"></span>
            <span class="psc-name">${p.player_name}${p.is_host?' 👑':''}${isMine?' <span class="psc-self">自分</span>':''}</span>
            ${st.finished?'<span class="psc-goal">🏆ゴール</span>':'<span class="psc-job">'+uniIcon+jobLabel+'</span>'}
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
    const st=getStats(playerData[myId]);

    // 浪人中：大学再抽選（サイコロは振らない）
    if(st.ronin){
      const u=rollUniversity();
      const usedIds=Array.isArray(playerData.__used_events)?playerData.__used_events:[];
      pendingCommit={newSt:{...st},newUsedIds:usedIds,_isUniAssign:true,_uniResult:u};
      showUniAssignOverlay(u);
      rolling=false;
      return;
    }

    const diceBonus=st.items.reduce((s,i)=>s+(ITEMS[i]?.diceBonus||0),0);
    const roll=Math.floor(Math.random()*6)+1+diceBonus;
    if(st.hospitalized){
      await saveHospitalRoll(st, roll);
      rolling=false; $('btn-roll').disabled=false;
      return;
    }
    await animateDice(roll);
    const newPos=calcLanding(st.pos,roll);
    if(newPos===BRANCH_START&&!st.route){
      const forced=getForcedRoute(st);
      if(forced){
        if(FORCED_STOPS.includes(newPos)&&newPos!==st.pos+roll)showStopMessage(newPos);
        await saveRoll(st,newPos,forced,roll);
        return;
      }
      pendingRoll={st,newPos,roll};
      $('route-overlay').classList.remove('hidden');
      return;
    }
    if(FORCED_STOPS.includes(newPos)&&newPos!==st.pos+roll)showStopMessage(newPos);
    const newRoute=(st.route&&newPos>=BRANCH_END)?null:(st.route||null);
    await saveRoll(st,newPos,newRoute,roll);
  });

  function getForcedRoute(st){
    if(st.items.includes('教育ママ')) return 'uni';
    if(st.items.includes('貧困家庭')) return 'job';
    return null;
  }
  function canDiscard(item,st){
    if(!item) return true;
    if(isBacteriaItem(item)) return false;
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
    for(let i=0;i<st.items.length;i++){
      const item=st.items[i]; if(!item) continue;
      const pt=ITEMS[item]?.perTurn||(isBacteriaItem(item)?{health:-3,happiness:-1}:null);
      if(pt){
        if(pt.money)     money     +=pt.money;
        if(pt.happiness) happiness +=pt.happiness;
        if(pt.health)    health    +=pt.health;
      }
      const bonus=st.itemBonuses?.[item];
      if(bonus){
        if(bonus.money)     money     +=bonus.money;
        if(bonus.happiness) happiness +=bonus.happiness;
        if(bonus.health)    health    +=bonus.health;
      }
    }
    if(st.job && JOBS[st.job]){
      const jb=JOBS[st.job], bonus=st.jobBonuses||{};
      money     += (jb.salary    ||0)+(bonus.salary    ||0);
      happiness += (jb.happiness ||0)+(bonus.happiness ||0);
      health    += (jb.health    ||0)+(bonus.health    ||0);
    }
    return{...st,money,happiness,health};
  }

  function isEventSquare(pos){
    return pos>0&&pos<100&&!FORCED_STOPS.includes(pos);
  }
  function pickEvent(pos,usedIds,items=[],job=null){
    const hasItems=items.some(i=>i);
    const av=EVENTS.filter(e=>{
      if(pos<e.minPos||pos>e.maxPos||usedIds.includes(e.id)) return false;
      if(e.requireItem&&!items.includes(e.requireItem)) return false;
      if(e.requireItems&&!e.requireItems.every(i=>items.includes(i))) return false;
      if(e.requireNotItem&&items.includes(e.requireNotItem)) return false;
      if(e.requireJob&&e.requireJob!==job) return false;
      return true;
    });
    const special = av.filter(e=>e.special);
    const jobEvs  = av.filter(e=>!e.special&&e.requireJob);
    const itemEvs = av.filter(e=>!e.special&&!e.requireJob&&(e.requireItem||e.requireItems));
    const general = av.filter(e=>!e.special&&!e.requireJob&&!e.requireItem&&!e.requireItems);

    // 確率テーブル（空バケットは除外して正規化）
    let buckets;
    if(job && hasItems)     buckets=[{p:general,w:30},{p:itemEvs,w:30},{p:jobEvs,w:30},{p:special,w:10}];
    else if(job)            buckets=[{p:general,w:45},{p:jobEvs,w:45},{p:special,w:10}];
    else if(hasItems)       buckets=[{p:general,w:50},{p:itemEvs,w:40},{p:special,w:10}];
    else                    buckets=[{p:general,w:90},{p:special,w:10}];

    const active=buckets.filter(b=>b.p.length>0);
    if(!active.length) return null;
    const total=active.reduce((s,b)=>s+b.w,0);
    let r=Math.random()*total;
    for(const b of active){ r-=b.w; if(r<=0) return b.p[Math.floor(Math.random()*b.p.length)]; }
    const last=active[active.length-1];
    return last.p[Math.floor(Math.random()*last.p.length)];
  }
  function substitutePlayerName(text,name){
    return text.replace(/（プレイヤー名）|\(プレイヤー名\)/g,name);
  }
  function effectsText(ev){
    const p=[];
    if(ev.eliminate)   p.push('脱落…観戦者になる。');
    if(ev.upgradeItem) p.push(`「${ev.upgradeItem.from}」が「${ev.upgradeItem.to}」に進化！`);
    if(ev.item)        p.push(`アイテム「${ev.item}」を獲得！`);
    if(ev.removeItem)  p.push(`アイテム「${ev.removeItem}」を失った…`);
    if(ev.setJob)      p.push(`職業「${ev.setJob}」になる！`);
    if(ev.money)       p.push(ev.money>0?`${ev.money}万円 獲得！`:`${Math.abs(ev.money)}万円 失った...`);
    if(ev.happiness)   p.push(`幸福度 ${ev.happiness>0?'+':''}${ev.happiness}`);
    if(ev.health)      p.push(`健康度 ${ev.health>0?'+':''}${ev.health}`);
    if(ev.nameItem) p.push(`アイテム「○○${ev.nameItem}」を獲得！`);
    if(ev.itemBonusDelta){
      for(const [itm,d] of Object.entries(ev.itemBonusDelta)){
        if(d.money)     p.push(`「${itm}」毎ターン+${d.money}万円 永続増加！`);
        if(d.happiness) p.push(`「${itm}」毎ターン幸福度${d.happiness>0?'+':''}${d.happiness} 永続増加！`);
        if(d.health)    p.push(`「${itm}」毎ターン健康度${d.health>0?'+':''}${d.health} 永続増加！`);
      }
    }
    if(ev.jobBonusDelta){
      const job=ev.requireJob||'職業';
      const d=ev.jobBonusDelta;
      if(d.salary   !==undefined) p.push(`「${job}」給料${d.salary>0?'+':''}${d.salary}万円/ターン 永続変化！`);
      if(d.happiness!==undefined) p.push(`「${job}」幸福度${d.happiness>0?'+':''}${d.happiness}/ターン 永続変化！`);
      if(d.health   !==undefined) p.push(`「${job}」健康度${d.health>0?'+':''}${d.health}/ターン 永続変化！`);
    }
    return p.join('\n');
  }
  function applyEventToStats(st,ev){
    const next={...st};
    if(ev.eliminate)   next.eliminated=true;
    if(ev.money)     next.money=st.money+ev.money;
    if(ev.happiness) next.happiness=st.happiness+ev.happiness;
    if(ev.health)    next.health=st.health+ev.health;
    if(ev.setJob)    next.job=ev.setJob;
    if(ev.removeItem){
      const items=[...st.items];
      const idx=items.indexOf(ev.removeItem);
      if(idx>=0){ items[idx]=null; next.items=items; }
    }
    if(ev.itemBonusDelta){
      const bonuses={...(st.itemBonuses||{})};
      for(const [itm,d] of Object.entries(ev.itemBonusDelta)){
        const cur=bonuses[itm]||{};
        bonuses[itm]={
          money:    (cur.money    ||0)+(d.money    ||0),
          happiness:(cur.happiness||0)+(d.happiness||0),
          health:   (cur.health   ||0)+(d.health   ||0),
        };
      }
      next.itemBonuses=bonuses;
    }
    if(ev.jobBonusDelta){
      const bonuses={salary:0,happiness:0,health:0,...(st.jobBonuses||{})};
      const d=ev.jobBonusDelta;
      if(d.salary   !==undefined) bonuses.salary    +=d.salary;
      if(d.happiness!==undefined) bonuses.happiness +=d.happiness;
      if(d.health   !==undefined) bonuses.health    +=d.health;
      next.jobBonuses=bonuses;
    }
    if(ev.nameItem){
      const itemName=myName+ev.nameItem;
      const items=[...(next.items||st.items)];
      const slot=items.indexOf(null);
      if(slot>=0){
        items[slot]=itemName; next.items=items;
        next.__new_item_slots=[...(st.__new_item_slots||[]),slot];
      } else next._pendingItem=itemName;
    }
    if(ev.item){
      const items=[...(next.items||st.items)];
      const slot=items.indexOf(null);
      if(slot>=0){
        items[slot]=ev.item; next.items=items;
        next.__new_item_slots=[...(st.__new_item_slots||[]),slot];
      } else next._pendingItem=ev.item;
    }
    if(ev.upgradeItem){
      const items=[...(next.items||st.items)];
      const idx=items.indexOf(ev.upgradeItem.from);
      if(idx>=0){ items[idx]=ev.upgradeItem.to; next.items=items; }
    }
    return next;
  }

  async function saveHospitalRoll(st, roll){
    const newHospPos = Math.min(st.hospitalPos + roll, HOSP_TOTAL);
    lastActionInfo = {pid:myId, route:null, roll, eventName:null, eventEffect:null, eventRequireItem:null};
    channel.send({type:'broadcast',event:'hospital_action',payload:{
      pid:myId, roll, fromHospPos:st.hospitalPos, toHospPos:newHospPos
    }}).catch(()=>{});

    await animateDice(roll, myName);
    await animateHospitalMove(st, newHospPos);
    await sleep(300);

    const newTurns = (st.hospitalTurns||0)+1;
    let newSt = {...st, hospitalPos: newHospPos, hospitalTurns: newTurns};
    playerData = {...playerData, [myId]: newSt};
    drawBoard();

    if(newHospPos >= HOSP_TOTAL){
      const costMult = (newSt.items||[]).includes('根性') ? 2 : 1;
      const cost = newTurns * 20 * costMult;
      const dischargedSt = {...newSt,
        money: newSt.money - cost,
        hospitalized: false, hospitalPos: 0, hospitalTurns: 0,
        pos: newSt.prevMapPos,
      };
      pendingCommit = {newSt: dischargedSt, newUsedIds: Array.isArray(playerData.__used_events)?playerData.__used_events:[], ev: null, _isDischarge: true, _dischargeCost: cost};
      await sleep(350);
      showDischargeEvent(cost);
      return;
    }

    await doCommitSave(newSt, Array.isArray(playerData.__used_events)?playerData.__used_events:[]);
  }

  function showDischargeEvent(cost){
    setEventItemThumb(null);
    $('event-name-text').textContent = 'ついに退院の日が来た！';
    $('event-effect-text').textContent = `${cost}万円払う`;
    $('event-overlay').classList.remove('hidden');
  }

  function showHospitalizationNotification(){
    return new Promise(resolve=>{
      setEventItemThumb(null);
      $('event-name-text').textContent = '身体が限界を迎えた。';
      $('event-effect-text').textContent = '入院マップへ強制移動';
      $('event-overlay').dataset.hospNotif = '1';
      $('event-overlay').classList.remove('hidden');
      window._hospNotifResolve = resolve;
    });
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

  function infectSt(st, bacteriaName){
    if((st.items||[]).includes(bacteriaName)) return st;
    const items=[...(st.items||[])];
    const slot=items.indexOf(null);
    if(slot>=0){ items[slot]=bacteriaName; return {...st,items}; }
    return st;
  }

  function checkInfections(fromPos, toPos, movingSt){
    const myBacteria=(movingSt.items||[]).filter(i=>i&&isBacteriaItem(i));
    let updatedSelf=movingSt;
    const infectedOthers={};
    for(let pos=fromPos+1;pos<=toPos;pos++){
      for(const p of players){
        if(p.player_id===myId) continue;
        const otherSt=getStats(playerData[p.player_id]);
        if(otherSt.finished||otherSt.eliminated||otherSt.hospitalized) continue;
        if(otherSt.pos!==pos) continue;
        // spread my bacteria to other player
        let cur=infectedOthers[p.player_id]||otherSt;
        for(const b of myBacteria) cur=infectSt(cur,b);
        infectedOthers[p.player_id]=cur;
        // spread other player's bacteria to me
        const theirBacteria=(otherSt.items||[]).filter(i=>i&&isBacteriaItem(i));
        for(const b of theirBacteria) updatedSelf=infectSt(updatedSelf,b);
      }
    }
    return {updatedSelf,infectedOthers};
  }

  function isPandemic(){
    if(!players||players.length<2) return false;
    const active=players.filter(p=>{
      const st=getStats(playerData[p.player_id]);
      return !st.finished&&!st.eliminated;
    });
    if(!active.length) return false;
    return active.every(p=>(getStats(playerData[p.player_id]).items||[]).some(i=>i&&isBacteriaItem(i)));
  }

  async function saveRoll(st,newPos,route,roll=1){
    lastActionInfo={pid:myId,route:route||null,roll,eventName:null,eventEffect:null,eventRequireItem:null};
    // observer に即時通知（DB 更新より大幅に速い）
    channel.send({type:'broadcast',event:'turn_action',payload:{
      pid:myId, roll, fromPos:st.pos, toPos:newPos, route:route||null
    }}).catch(()=>{});

    const isGoal=newPos===100;
    if(isGoal){ $('dice-result').textContent+='　🏆 ゴール！'; }

    await animateMove(st, newPos, route);
    await arrivalAnimation(newPos, route);

    let newSt=clampStats({...st, pos:newPos,
      route:isGoal?null:(route||null),
      finished:isGoal||!!st.finished});

    // 感染チェック：移動経路上で他プレイヤーと接触した場合に菌を伝播
    const {updatedSelf,infectedOthers}=checkInfections(st.pos,newPos,newSt);
    newSt=updatedSelf;
    for(const [pid,infSt] of Object.entries(infectedOthers)){
      playerData={...playerData,[pid]:infSt};
    }

    playerData={...playerData,[myId]:newSt};
    drawBoard();

    // 大学ルート到着：振り分け
    if(newPos===BRANCH_START&&route==='uni'){
      const u=rollUniversity();
      const usedIds=Array.isArray(playerData.__used_events)?playerData.__used_events:[];
      pendingCommit={newSt,newUsedIds:usedIds,_isUniAssign:true,_uniResult:u};
      await sleep(350);
      showUniAssignOverlay(u);
      return;
    }

    if(!isGoal&&isEventSquare(newPos)){
      const usedIds=Array.isArray(playerData.__used_events)?playerData.__used_events:[];
      const ev=pickEvent(newPos,usedIds,newSt.items,newSt.job);
      if(ev){
        // イベント内容を observer に broadcast
        pendingCommit={newSt,newUsedIds:[...usedIds,ev.id],ev};
        await sleep(350);
        showEventOverlay(ev);
        return;
      }
    }
    await doCommitSave(newSt,Array.isArray(playerData.__used_events)?playerData.__used_events:[]);
  }

  function showUniAssignOverlay(u){
    $('uni-assign-name').textContent=u.name;
    $('uni-assign-cost').textContent=`入学金 ${u.tuition}万円`;
    $('uni-assign-overlay').classList.remove('hidden');
  }

  function setEventItemThumb(item){
    const wrap=$('event-item-thumb-wrap');
    const src=getItemImg(item);
    if(item&&src){
      $('event-item-thumb').src=src;
      wrap.classList.remove('hidden');
    } else {
      wrap.classList.add('hidden');
    }
  }
  async function showEventOverlay(ev){
    setEventItemThumb(ev.upgradeItem?.to||ev.item||(ev.nameItem?myName+ev.nameItem:null)||ev.requireItem||null);
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
    let wasJustHospitalized = false;
    const hospThreshold = (newSt.items||[]).includes('根性') ? -5 : 0;
    if(newSt.health<=hospThreshold && !newSt.hospitalized && !newSt.finished){
      wasJustHospitalized = true;
      newSt = {...newSt, hospitalized:true, hospitalPos:0, hospitalTurns:0, prevMapPos:newSt.pos};
    }
    const newData={...playerData,[myId]:newSt};
    newData.__used_events=newUsedIds;
    if(lastActionInfo){newData.__last_action={...lastActionInfo};lastActionInfo=null;}
    const isInactive=p=>{ const s=getStats(newData[p.player_id]); return s.finished||s.eliminated; };
    const inactiveCount=players.filter(isInactive).length;
    if(players.length>1&&inactiveCount>=players.length-1){
      await sb.from('rooms').update({
        alive_cells:newData, status:'finished',
        current_player_index:currentPlayerIndex, turn_number:turnNumber,
      }).eq('id',roomId);
      return;
    }
    let nextIndex=(currentPlayerIndex+1)%players.length;
    for(let i=0;i<players.length;i++){
      if(!isInactive(players[nextIndex])) break;
      nextIndex=(nextIndex+1)%players.length;
    }
    const nextTurn=nextIndex<=currentPlayerIndex?turnNumber+1:turnNumber;
    await sb.from('rooms').update({
      alive_cells:newData,
      current_player_index:nextIndex,
      turn_number:nextTurn,
    }).eq('id',roomId);
    // Realtime 到着を待たずにローカル状態を即時更新
    prevPlayerData={...playerData};
    playerData=newData;
    currentPlayerIndex=nextIndex;
    turnNumber=nextTurn;
    drawBoard();
    updateTurnUI();
    requestAnimationFrame(showStatDeltas);
    if(wasJustHospitalized) await showHospitalizationNotification();
  }

  $('btn-uni-enroll').addEventListener('click',async()=>{
    $('uni-assign-overlay').classList.add('hidden');
    const {newSt,newUsedIds,_uniResult:u}=pendingCommit;
    const finalSt=clampStats({...newSt,uni:u.name,ronin:false,money:newSt.money-u.tuition});
    await doCommitSave(finalSt,newUsedIds);
  });
  $('btn-uni-ronin').addEventListener('click',async()=>{
    $('uni-assign-overlay').classList.add('hidden');
    const {newSt,newUsedIds}=pendingCommit;
    const finalSt=clampStats({...newSt,ronin:true,money:newSt.money-30,happiness:newSt.happiness-4});
    await doCommitSave(finalSt,newUsedIds);
  });

  $('btn-route-job').addEventListener('click',async()=>{
    $('route-overlay').classList.add('hidden');
    if(!pendingRoll)return;
    const {st,newPos,roll}=pendingRoll; pendingRoll=null;
    await saveRoll(st,newPos,'job',roll);
  });
  $('btn-route-uni').addEventListener('click',async()=>{
    $('route-overlay').classList.add('hidden');
    if(!pendingRoll)return;
    const {st,newPos,roll}=pendingRoll; pendingRoll=null;
    await saveRoll(st,newPos,'uni',roll);
  });

  $('btn-event-ok').addEventListener('click',async()=>{
    $('event-overlay').classList.add('hidden');
    setEventItemThumb(null);
    // Hospitalization notification (post-commit, just dismiss)
    if($('event-overlay').dataset.hospNotif==='1'){
      delete $('event-overlay').dataset.hospNotif;
      if(window._hospNotifResolve){ window._hospNotifResolve(); window._hospNotifResolve=null; }
      return;
    }
    if($('event-overlay').classList.contains('observer')){
      $('event-overlay').classList.remove('observer');
      requestAnimationFrame(showStatDeltas);
      return;
    }
    // Discharge event
    if(pendingCommit?._isDischarge){
      const {newSt,newUsedIds} = pendingCommit;
      await doCommitSave(newSt, newUsedIds);
      return;
    }
    const {newSt,newUsedIds,ev}=pendingCommit;
    if(lastActionInfo&&ev){
      lastActionInfo.eventName=substitutePlayerName(ev.name,myName);
      lastActionInfo.eventEffect=effectsText(ev);
      lastActionInfo.eventRequireItem=ev.requireItem||null;
    }
    // イベント内容を observer に即時通知
    channel.send({type:'broadcast',event:'turn_event',payload:{
      pid:myId,
      eventName:substitutePlayerName(ev.name,myName),
      eventEffect:effectsText(ev),
      requireItem:ev.requireItem||null
    }}).catch(()=>{});
    let st=applyEventToStats(newSt,ev);
    if(st._pendingItem){
      const pendingItem=st._pendingItem; delete st._pendingItem;
      pendingCommit={newSt:st,newUsedIds,pendingItem};
      showDiscardOverlay(st.items,pendingItem);
      return;
    }
    if(ev.item) queueItemAcquisition([ev.item]);
    if(ev.nameItem) queueItemAcquisition([myName+ev.nameItem]);
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
      st.__new_item_slots=[...(newSt.__new_item_slots||[]),idx];
      queueItemAcquisition([pendingItem]);
    }
    await doCommitSave(st,newUsedIds);
  });

  function showStopMessage(pos){
    $('dice-result').textContent+=`　★ ${pos}マスで強制ストップ！`;
  }

  // ── アイテムカード（長押し） ──
  const ITEM_BG = {
    '親のスネ':             'linear-gradient(150deg,#f5d97a 0%,#f0c040 100%)',
    '親のセワ':             'linear-gradient(150deg,#9a8eb0 0%,#6b5f80 100%)',
    '教育ママ':             'linear-gradient(150deg,#6aabee 0%,#3a7ecc 100%)',
    '塾のテキスト':         'linear-gradient(150deg,#e8d8b0 0%,#c8b080 100%)',
    'ピアノ':               'linear-gradient(150deg,#4a4a6a 0%,#1e1e38 100%)',
    '水泳教室':             'linear-gradient(150deg,#60d4ee 0%,#1a9ec0 100%)',
    '貧困家庭':             'linear-gradient(150deg,#a0aa98 0%,#6a7462 100%)',
    '昭和親父':             'linear-gradient(150deg,#e8a860 0%,#b86e28 100%)',
    'グローブ':             'linear-gradient(150deg,#7ed87e 0%,#3aaa3a 100%)',
    '友達':                 'linear-gradient(150deg,#ffe97a 0%,#8dd87e 100%)',
    '好きな人':             'linear-gradient(150deg,#ffb6c1 0%,#e75480 100%)',
    'イーロン・マスクメロン':'linear-gradient(150deg,#b8f0a0 0%,#4caf50 100%)',
    '大選手養成ギプス':     'linear-gradient(150deg,#c0c8d8 0%,#607090 100%)',
    '根性':                 'linear-gradient(150deg,#ff8c42 0%,#c04000 100%)',
  };
  // 全アイテムの画像パス（拡張子が .png のものは明示的に記載）
  const ITEM_IMG = {
    '親のスネ':               'items/親のスネ.png',
    '昭和親父':               'items/昭和親父.png',
    '友達':                   'items/友達.png',
    '教育ママ':               'items/教育ママ.jpg',
    '塾のテキスト':           'items/塾のテキスト.jpg',
    'ピアノ':                 'items/ピアノ.jpg',
    '水泳教室':               'items/水泳教室.jpg',
    '貧困家庭':               'items/貧困家庭.jpg',
    'グローブ':               'items/グローブ.jpg',
    '好きな人':               'items/IMG_3700.jpg',
    'イーロン・マスクメロン': 'items/IMG_3682.jpg',
    '大選手養成ギプス':       'items/IMG_3685.jpg',
    '根性':                   'items/IMG_3702.jpg',
    '親のセワ':               'items/IMG_3683.jpg',
    'ジーザス・ギプス':       'items/IMG_3689.jpg',
    '悪い友達':               'items/IMG_3711.jpg',
    '恋人':                   'items/IMG_3712.jpg',
    '自転車':                 'items/IMG_3713.jpg',
    '男子校の呪い':           'items/IMG_3728.jpg',
    '女子校ブランド':         'items/IMG_3729.jpg',
    '黒歴史ノート':           'items/IMG_3730.jpg',
    '金持ち友達':             'items/IMG_3731.jpg',
  };
  function getItemImg(item){
    if(!item) return null;
    if(ITEM_IMG[item]) return ITEM_IMG[item];
    if(isBacteriaItem(item)) return 'items/IMG_3688.jpg';
    return `items/${item}.png`;
  }
  // エッジから連結した白ピクセルのみ除去（内部の白は保持）
  function removeWhiteBg(srcImg){
    const cv=document.createElement('canvas');
    cv.width=srcImg.naturalWidth; cv.height=srcImg.naturalHeight;
    const c=cv.getContext('2d');
    c.drawImage(srcImg,0,0);
    const imgData=c.getImageData(0,0,cv.width,cv.height);
    const d=imgData.data;
    const w=cv.width, h=cv.height;
    function isWhiteish(i){ return d[i+3]>200&&Math.min(d[i],d[i+1],d[i+2])>210&&(Math.max(d[i],d[i+1],d[i+2])-Math.min(d[i],d[i+1],d[i+2]))<50; }
    const visited=new Uint8Array(w*h);
    const queue=[];
    function seed(px){ if(px<0||px>=w*h||visited[px])return; visited[px]=1; if(isWhiteish(px*4))queue.push(px); }
    for(let x=0;x<w;x++){ seed(x); seed((h-1)*w+x); }
    for(let y=1;y<h-1;y++){ seed(y*w); seed(y*w+w-1); }
    let qi=0;
    while(qi<queue.length){
      const px=queue[qi++];
      const i=px*4;
      const bright=Math.min(d[i],d[i+1],d[i+2]);
      d[i+3]=Math.round(Math.max(0,(255-bright)*255/45));
      const x=px%w,y=Math.floor(px/w);
      if(x>0)   seed(px-1);
      if(x<w-1) seed(px+1);
      if(y>0)   seed(px-w);
      if(y<h-1) seed(px+w);
    }
    c.putImageData(imgData,0,0);
    return cv.toDataURL('image/png');
  }

  let ttTimer=null;
  function queueItemAcquisition(items){
    itemAcquisitionQueue.push(...items.filter(Boolean));
    if(!itemAcquisitionActive) showNextAcquisition();
  }
  function showNextAcquisition(){
    if(!itemAcquisitionQueue.length){ itemAcquisitionActive=false; return; }
    itemAcquisitionActive=true;
    showItemCard(itemAcquisitionQueue.shift(),true);
  }

  function showItemCard(item,acquired=false){
    const def=ITEMS[item];
    if(!def&&!acquired&&!isBacteriaItem(item)) return;
    $('item-card-name').textContent=item;
    $('item-card-desc').textContent=def?.desc||(isBacteriaItem(item)?'毎ターン健康度-3・幸福度-1\n捨てられない':'');
    $('item-card-banner-name').textContent=item;
    const wrap=document.querySelector('.item-card-img-wrap');
    if(wrap) wrap.style.background=ITEM_BG[item]||(isBacteriaItem(item)?'linear-gradient(150deg,#7dba6e 0%,#2e7d32 100%)':'linear-gradient(150deg,#c6d9f6 0%,#deeeff 100%)');
    const img=$('item-card-img');
    img.classList.add('hidden');
    const loader=new Image();
    loader.onload=()=>{
      try{ img.src=removeWhiteBg(loader); }catch(e){ img.src=loader.src; }
      img.classList.remove('hidden');
    };
    loader.onerror=()=>{ if(!loader.src.endsWith('.jpg')) loader.src=`items/${item}.jpg`; };
    loader.src=getItemImg(item);
    const overlay=$('item-card-overlay');
    acquired ? overlay.classList.add('acquire') : overlay.classList.remove('acquire');
    overlay.classList.remove('hidden');
  }
  function hideItemCard(){ $('item-card-overlay').classList.remove('acquire'); $('item-card-overlay').classList.add('hidden'); clearTimeout(ttTimer); }
  function bindItemCard(area){
    area.addEventListener('mousedown',e=>{
      const s=e.target.closest('.item-slot.filled[data-item]'); if(!s)return;
      ttTimer=setTimeout(()=>showItemCard(s.dataset.item),400);
    });
    area.addEventListener('mouseup',()=>clearTimeout(ttTimer));
    area.addEventListener('mouseleave',()=>clearTimeout(ttTimer));
    area.addEventListener('touchstart',e=>{
      const s=e.target.closest('.item-slot.filled[data-item]'); if(!s)return;
      e.preventDefault();
      ttTimer=setTimeout(()=>showItemCard(s.dataset.item),400);
    },{passive:false});
    area.addEventListener('touchend',()=>clearTimeout(ttTimer));
    area.addEventListener('touchcancel',()=>clearTimeout(ttTimer));
  }
  $('item-card-overlay').addEventListener('click',e=>{
    if($('item-card-overlay').classList.contains('acquire')) return;
    if(e.target===$('item-card-overlay')) hideItemCard();
  });
  $('btn-item-card-ok').addEventListener('click',()=>{
    $('item-card-overlay').classList.add('hidden');
    $('item-card-overlay').classList.remove('acquire');
    showNextAcquisition();
  });
  bindItemCard($('player-status-area'));

  const DICE_FACE=['⚀','⚁','⚂','⚃','⚄','⚅'];
  async function animateDice(result, playerName=''){
    const el=$('dice-result');
    const disp=$('dice-display');
    const face=$('dice-face-big');
    const stepsEl=$('dice-steps-big');
    $('dice-player-label').textContent=playerName?playerName+' のサイコロ':'';
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

  async function arrivalAnimation(pos, route, pid=myId){
    const sq=getBranchSq(pos,route)||squares[pos];
    if(!sq)return;
    const p=players.find(pl=>pl.player_id===pid);
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
    if(showHospitalMap){ drawHospitalMap(); return; }
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
    if(isPandemic()) drawPandemicOverlay();
  }

  function drawPandemicOverlay(){
    ctx.save();
    ctx.fillStyle='rgba(160,0,0,0.12)';
    ctx.fillRect(0,0,CW,CH);
    ctx.font='bold 68px Segoe UI';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.shadowColor='rgba(255,0,0,0.7)';
    ctx.shadowBlur=28;
    ctx.fillStyle='rgba(204,16,16,0.9)';
    ctx.fillText('🦠 パンデミック', CW/2, 58);
    ctx.restore();
  }

  function tileGradHosp(n, corners){
    const tx=(corners[0].x+corners[1].x)/2, ty=(corners[0].y+corners[1].y)/2;
    const bx=(corners[2].x+corners[3].x)/2, by=(corners[2].y+corners[3].y)/2;
    const g=ctx.createLinearGradient(tx,ty,bx,by);
    if(n===0)            {g.addColorStop(0,'#e0eaff');g.addColorStop(1,'#8bb8f8');}
    else if(n===HOSP_TOTAL){g.addColorStop(0,'#c8f0c0');g.addColorStop(1,'#90d080');}
    else                 {g.addColorStop(0,'#fffdf5');g.addColorStop(1,'#f0e8d4');}
    return g;
  }
  function tileBorderHosp(n){
    if(n===0) return '#2040b0';
    if(n===HOSP_TOTAL) return '#2a8a40';
    return '#b89860';
  }
  function drawHospSq(sq){
    const n=sq.num;
    const h=SQ_ACROSS;
    const fs =Math.max(8, Math.round(h*0.28));
    const fsB=Math.max(9, Math.round(h*0.30));
    const dy =h*0.20;
    const isSpecial=n===0||n===HOSP_TOTAL;

    ctx.save();
    ctx.shadowColor='rgba(0,0,0,0.15)'; ctx.shadowBlur=5; ctx.shadowOffsetY=2;
    ctx.fillStyle=tileGradHosp(n,sq.corners);
    tilePath(sq.corners); ctx.fill();
    ctx.restore();

    ctx.strokeStyle=tileBorderHosp(n);
    ctx.lineWidth=isSpecial?2:1.2;
    tilePath(sq.corners); ctx.stroke();

    ctx.save(); ctx.globalAlpha=0.28; ctx.fillStyle='rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(sq.corners[0].x,sq.corners[0].y);
    ctx.lineTo(sq.corners[1].x,sq.corners[1].y);
    ctx.lineTo(lerp(sq.corners[1],sq.corners[2],0.35).x,lerp(sq.corners[1],sq.corners[2],0.35).y);
    ctx.lineTo(lerp(sq.corners[0],sq.corners[3],0.35).x,lerp(sq.corners[0],sq.corners[3],0.35).y);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    ctx.textAlign='center'; ctx.textBaseline='middle';
    if(n===0){
      ctx.fillStyle='#1a3a90';
      ctx.font=`bold ${fsB}px Segoe UI`; ctx.fillText('入院',sq.cx,sq.cy);
    } else if(n===HOSP_TOTAL){
      ctx.fillStyle='#1a6030';
      ctx.font=`bold ${fsB}px Segoe UI`; ctx.fillText('退院',sq.cx,sq.cy);
    } else {
      ctx.fillStyle='#7a6040';
      ctx.font=`${fs}px Segoe UI`; ctx.fillText(n,sq.cx,sq.cy);
    }
  }
  function drawHospitalMap(){
    // Background image
    if(hospBgImg){
      ctx.drawImage(hospBgImg, 0, 0, CW, CH);
    } else {
      ctx.fillStyle='#f0f4f8'; ctx.fillRect(0,0,CW,CH);
    }

    // Road — trace through back-edge midpoints then final front-edge midpoint
    // This makes the road follow exactly the tiles' along-axis
    function traceHosp(){
      ctx.beginPath();
      hospitalSquares.sqs.forEach((sq,i)=>{
        // back-edge midpoint = midpoint of corners[0] and corners[3]
        const bx=(sq.corners[0].x+sq.corners[3].x)/2, by=(sq.corners[0].y+sq.corners[3].y)/2;
        i===0 ? ctx.moveTo(bx,by) : ctx.lineTo(bx,by);
        // for last square also add front-edge midpoint
        if(i===HOSP_TOTAL){
          const fx=(sq.corners[1].x+sq.corners[2].x)/2, fy=(sq.corners[1].y+sq.corners[2].y)/2;
          ctx.lineTo(fx,fy);
        }
      });
    }
    ctx.save(); ctx.lineJoin='round'; ctx.lineCap='round';
    ctx.lineWidth=ROAD_W+14; ctx.strokeStyle='rgba(100,70,30,0.32)'; traceHosp(); ctx.stroke();
    ctx.lineWidth=ROAD_W+4;  ctx.strokeStyle='#c8a060';              traceHosp(); ctx.stroke();
    ctx.lineWidth=ROAD_W;    ctx.strokeStyle='#ddb870';              traceHosp(); ctx.stroke();
    ctx.lineWidth=ROAD_W-8;  ctx.strokeStyle='rgba(255,240,190,0.4)'; traceHosp(); ctx.stroke();
    ctx.lineWidth=2; ctx.strokeStyle='rgba(255,255,255,0.55)';
    ctx.setLineDash([12,16]); traceHosp(); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();

    // Squares
    for(let n=0; n<=HOSP_TOTAL; n++) drawHospSq(hospitalSquares.sqs[n]);

    // Title
    ctx.save();
    ctx.fillStyle='rgba(255,255,255,0.88)';
    ctx.beginPath(); ctx.roundRect(78,50,188,42,10); ctx.fill();
    ctx.fillStyle='#1a3a90'; ctx.font='bold 22px Segoe UI';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('🏥 入院マップ', 172, 71);
    ctx.restore();

    // Player tokens (same style as drawTokens)
    players.forEach(p=>{
      const st=getStats(playerData[p.player_id]);
      if(!st.hospitalized) return;
      const animPos = observerHospitalAnimPos[p.player_id];
      const sq=hospitalSquares.sqs[animPos !== undefined ? animPos : st.hospitalPos];
      if(!sq) return;
      const tx=sq.cx, ty=sq.cy, R=16;
      ctx.save(); ctx.shadowColor='rgba(0,0,0,0.4)'; ctx.shadowBlur=8; ctx.shadowOffsetY=3;
      ctx.beginPath(); ctx.arc(tx,ty,R,0,Math.PI*2); ctx.fillStyle=p.color; ctx.fill(); ctx.restore();
      const tg=ctx.createRadialGradient(tx-R*.3,ty-R*.3,R*.05,tx,ty,R);
      tg.addColorStop(0,'rgba(255,255,255,0.62)'); tg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.arc(tx,ty,R,0,Math.PI*2); ctx.fillStyle=tg; ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,0.92)'; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.arc(tx,ty,R,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle='#fff'; ctx.font='bold 11px Segoe UI';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(p.player_name[0].toUpperCase(),tx,ty);
    });
  }

  async function animateHospitalMove(fromSt, toPos){
    for(let pos = fromSt.hospitalPos+1; pos <= toPos; pos++){
      playerData = {...playerData, [myId]: {...playerData[myId], hospitalPos: pos}};
      drawBoard();
      await sleep(120);
    }
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
      if(st.hospitalized||st.eliminated) return;
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

  function onObserverBroadcast(payload){
    if(payload.pid===myId) return;
    broadcastHandledPid=payload.pid;
    prevPlayerData={...playerData};
    observerAnimCancel=true;
    const fromSt={...getStats(playerData[payload.pid]),pos:payload.fromPos,route:payload.fromRoute||null};
    setTimeout(()=>{
      observerAnimCancel=false;
      runObserverAnimation(payload.pid,payload.roll||1,fromSt,payload.toPos,payload.route||null);
    },30);
  }

  function onObserverHospitalBroadcast(payload){
    if(payload.pid===myId) return;
    const p=players.find(pl=>pl.player_id===payload.pid);
    broadcastHandledPid=payload.pid;
    showHospitalMap=true;
    observerHospitalAnimPos[payload.pid] = payload.fromHospPos;
    drawBoard();
    animateDice(payload.roll, p?.player_name||'').then(()=>{
      (async()=>{
        for(let pos=payload.fromHospPos+1; pos<=payload.toHospPos; pos++){
          observerHospitalAnimPos[payload.pid] = pos;
          drawBoard();
          await sleep(120);
        }
        delete observerHospitalAnimPos[payload.pid];
        updateTurnUI();
      })();
    });
  }
  function onObserverEventBroadcast(payload){
    if(payload.pid===myId) return;
    pendingObserverEvent={pid:payload.pid,eventName:payload.eventName,eventEffect:payload.eventEffect,requireItem:payload.requireItem||null};
  }

  async function runObserverAnimation(pid,roll,fromSt,toPos,toRoute,eventName=null,eventEffect=null,eventRequireItem=null){
    showHospitalMap = false;
    observerAnimating=true;
    const btn=$('btn-roll');
    const wasDisabled=btn.disabled;
    btn.disabled=true;

    if(roll){
      const p=players.find(pl=>pl.player_id===pid);
      await animateDice(roll,p?.player_name||'');
      if(observerAnimCancel){observerAnimating=false;observerRealtimeData=null;btn.disabled=wasDisabled;drawBoard();return;}
    }

    // 位置のみ fromSt にリセット。金・幸福度等は現在の playerData[pid] を優先
    // (Realtime がアニメ開始前に届いていた場合も正しい値を保持する)
    playerData={...playerData,[pid]:{...(playerData[pid]||fromSt),pos:fromSt.pos,route:fromSt.route}};
    drawBoard();
    for(let pos=fromSt.pos+1;pos<=toPos;pos++){
      if(observerAnimCancel){observerAnimating=false;observerRealtimeData=null;btn.disabled=wasDisabled;drawBoard();return;}
      const midRoute=(pos>BRANCH_START&&pos<BRANCH_END)?(toRoute||fromSt.route||null):null;
      // fromSt ではなく現在の playerData[pid] を使用（Realtime 到着時のステータス更新を保持）
      playerData={...playerData,[pid]:{...playerData[pid],pos,route:midRoute}};
      drawBoard();
      await sleep(120);
    }
    playerData={...playerData,[pid]:{...playerData[pid],pos:toPos,route:toRoute||null}};
    await arrivalAnimation(toPos,toRoute,pid);

    observerAnimating=false;
    if(observerRealtimeData){
      // Realtime が animation 中に届いていた場合、正しい DB データで上書き
      playerData=observerRealtimeData;
      observerRealtimeData=null;
    }
    drawBoard();
    btn.disabled=wasDisabled;
    updateTurnUI();

    // broadcast でイベント情報が届いている場合を優先、なければ DB フォールバックの eventName を使用
    const evInfo = (pendingObserverEvent?.pid===pid) ? pendingObserverEvent : null;
    if(evInfo){ pendingObserverEvent=null; }
    const evName = evInfo?.eventName || eventName;
    const evEffect = evInfo?.eventEffect || eventEffect;
    const evRequireItem = evInfo?.requireItem ?? eventRequireItem;
    if(evName){
      await sleep(350);
      showObserverEventOverlay({pid,eventName:evName,eventEffect:evEffect,requireItem:evRequireItem});
    } else {
      requestAnimationFrame(showStatDeltas);
    }
  }

  async function showObserverEventOverlay(ev){
    const p=players.find(pl=>pl.player_id===ev.pid);
    $('event-observer-label').textContent=p?`${p.player_name} のイベント`:'';
    setEventItemThumb(ev.upgradeItem?.to||ev.item||ev.requireItem||null);
    $('event-name-text').textContent=ev.eventName||'';
    $('event-effect-text').textContent=ev.eventEffect||'';
    $('event-overlay').classList.add('observer');
    $('event-overlay').classList.remove('hidden');
  }

  function showGameStart(){
    const el=$('game-start-overlay');
    el.classList.remove('hidden');
    const mySt=getStats(playerData[myId]);
    const startItems=mySt.items.filter(Boolean);
    setTimeout(()=>{
      el.classList.add('hidden');
      if(startItems.length) showStartItemsOverlay(startItems);
    },1800);
  }

  function showStartItemsOverlay(items){
    const overlay=$('start-items-overlay');
    const container=$('start-items-container');
    container.innerHTML='';
    items.forEach(item=>{
      const def=ITEMS[item];
      const card=document.createElement('div');
      card.className='start-item-card';
      card.innerHTML=`
        <div class="start-item-img-wrap" style="background:${ITEM_BG[item]||'linear-gradient(150deg,#c6d9f6,#deeeff)'}">
          <img class="start-item-img" data-item="${item}" src="" alt="${item}">
        </div>
        <div class="start-item-body">
          <p class="start-item-name">${item}</p>
          <p class="start-item-desc">${def?.desc||''}</p>
        </div>`;
      container.appendChild(card);
      const img=card.querySelector('.start-item-img');
      const loader=new Image();
      loader.onload=()=>{
        try{ img.src=removeWhiteBg(loader); }catch(e){ img.src=loader.src; }
        img.classList.remove('hidden');
      };
      loader.onerror=()=>{ if(!loader.src.endsWith('.jpg')){ loader.src=`items/${item}.jpg`; }else{ img.classList.add('hidden'); } };
      img.classList.add('hidden');
      loader.src=getItemImg(item);
    });
    overlay.classList.remove('hidden');
  }

  $('btn-start-items-ok').addEventListener('click',()=>{
    $('start-items-overlay').classList.add('hidden');
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
