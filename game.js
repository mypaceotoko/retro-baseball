/* ============================================================
   RETRO BASEBALL  –  game.js
   完全アニメーション野球ゲーム
   ============================================================ */

"use strict";

// ============================================================
// 1. 選手データ
// ============================================================
const PLAYER_POOL = [
  // 名前, パワー(0-100), ミート(0-100), 走力(0-100), 投球(0-100), 守備(0-100)
  { name:"王 貞治",       pow:98, meet:90, spd:70, pitch:40, def:80 },
  { name:"長嶋 茂雄",     pow:85, meet:95, spd:85, pitch:35, def:90 },
  { name:"大谷 翔平",     pow:99, meet:88, spd:90, pitch:99, def:85 },
  { name:"イチロー",      pow:65, meet:99, spd:99, pitch:30, def:99 },
  { name:"松井 秀喜",     pow:95, meet:85, spd:70, pitch:30, def:80 },
  { name:"野茂 英雄",     pow:50, meet:40, spd:55, pitch:97, def:70 },
  { name:"江夏 豊",       pow:55, meet:50, spd:50, pitch:95, def:72 },
  { name:"金田 正一",     pow:52, meet:48, spd:52, pitch:96, def:68 },
  { name:"ベーブ・ルース", pow:99, meet:85, spd:60, pitch:90, def:75 },
  { name:"ルー・ゲーリッグ",pow:97,meet:88, spd:65, pitch:20, def:85 },
  { name:"ハンク・アーロン",pow:96,meet:90, spd:75, pitch:20, def:88 },
  { name:"ウィリー・メイズ",pow:90,meet:92, spd:95, pitch:20, def:99 },
  { name:"テッド・ウィリアムズ",pow:88,meet:97,spd:72,pitch:20,def:78 },
  { name:"マイク・トラウト",pow:93,meet:91, spd:92, pitch:20, def:92 },
  { name:"ケン・グリフィーJr",pow:94,meet:89,spd:88,pitch:20,def:97 },
  { name:"ロジャー・クレメンス",pow:55,meet:45,spd:50,pitch:98,def:70 },
  { name:"サンディ・コーファックス",pow:48,meet:42,spd:48,pitch:99,def:65 },
  { name:"ランディ・ジョンソン",pow:52,meet:40,spd:52,pitch:98,def:68 },
  { name:"マリアノ・リベラ",pow:45,meet:38,spd:50,pitch:97,def:72 },
  { name:"田中 将大",     pow:50, meet:45, spd:55, pitch:94, def:75 },
  { name:"松坂 大輔",     pow:52, meet:44, spd:54, pitch:93, def:73 },
  { name:"山本 由伸",     pow:55, meet:48, spd:58, pitch:96, def:78 },
  { name:"清原 和博",     pow:97, meet:83, spd:68, pitch:20, def:82 },
  { name:"落合 博満",     pow:88, meet:98, spd:65, pitch:20, def:80 },
  { name:"張本 勲",       pow:80, meet:97, spd:80, pitch:20, def:85 },
  { name:"秋山 幸二",     pow:87, meet:86, spd:90, pitch:20, def:95 },
  { name:"福本 豊",       pow:60, meet:85, spd:99, pitch:20, def:92 },
  { name:"山田 哲人",     pow:85, meet:90, spd:92, pitch:20, def:90 },
  { name:"村上 宗隆",     pow:96, meet:87, spd:72, pitch:20, def:80 },
  { name:"佐々木 朗希",   pow:50, meet:42, spd:55, pitch:98, def:72 },
];

// ============================================================
// 2. ユーティリティ
// ============================================================
const rnd  = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = arr => arr[rnd(0, arr.length - 1)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const sleep = ms => new Promise(r => setTimeout(r, ms));

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============================================================
// 3. チーム生成
// ============================================================
function buildTeam(name, color) {
  const pool = shuffle(PLAYER_POOL);
  // 投手1名 + 野手8名 = 9名
  // 投球能力が高い選手を投手に
  const sorted = [...pool].sort((a, b) => b.pitch - a.pitch);
  const pitcher = sorted[0];
  const batters = pool.filter(p => p !== pitcher).slice(0, 8);
  const roster  = [pitcher, ...batters];
  return {
    name,
    color,
    roster,
    pitcher,
    batterIdx: 0,
    scores: Array(9).fill(null),   // イニング得点
    totalRuns: 0,
    hits: 0,
    errors: 0,
  };
}

// ============================================================
// 4. ゲーム状態
// ============================================================
const G = {
  teams: [],
  inning: 1,       // 1〜9
  half: 0,         // 0=表, 1=裏
  outs: 0,
  balls: 0,
  strikes: 0,
  bases: [false, false, false],  // 1塁, 2塁, 3塁
  phase: "IDLE",   // IDLE | PITCHING | SWINGING | RESULT | BETWEEN | GAMEOVER
  animating: false,
  gameStarted: false,
};

function attackTeam()  { return G.teams[G.half]; }
function defenseTeam() { return G.teams[1 - G.half]; }
function currentBatter() {
  const t = attackTeam();
  return t.roster[t.batterIdx % t.roster.length];
}
function currentPitcher() {
  return defenseTeam().pitcher;
}

// ============================================================
// 5. Canvas セットアップ
// ============================================================
const canvas = document.getElementById("field-canvas");
const ctx    = canvas.getContext("2d");
const CW = canvas.width;   // 480
const CH = canvas.height;  // 320

// フィールド座標定数
const FIELD = {
  // ダイヤモンド中心
  cx: CW * 0.5,
  cy: CH * 0.62,
  // 塁の位置（中心から）
  base1: { x: CW * 0.72, y: CH * 0.62 },
  base2: { x: CW * 0.5,  y: CH * 0.38 },
  base3: { x: CW * 0.28, y: CH * 0.62 },
  home:  { x: CW * 0.5,  y: CH * 0.86 },
  // マウンド
  mound: { x: CW * 0.5,  y: CH * 0.62 },
  // バッターボックス
  batter: { x: CW * 0.5 + 22, y: CH * 0.82 },
  // 外野方向
  outfield: { x: CW * 0.5, y: CH * 0.05 },
  // スタンド（ホームラン着地）
  stand: { x: CW * 0.5, y: -20 },
};

// ============================================================
// 6. アニメーション状態
// ============================================================
let anim = {
  ball:    { x: 0, y: 0, visible: false, trail: [] },
  pitcher: { x: 0, y: 0, frame: 0, state: "idle" },  // idle|windup|release
  batter:  { x: 0, y: 0, frame: 0, state: "idle" },  // idle|ready|swing|miss
  fielder: { x: 0, y: 0, visible: false, state: "idle" },
  runners: [
    { base: -1, x: 0, y: 0, visible: false },  // runner 0
    { base: -1, x: 0, y: 0, visible: false },  // runner 1
    { base: -1, x: 0, y: 0, visible: false },  // runner 2
  ],
  hitType: "",
  rafId: null,
};

// ============================================================
// 7. 描画関数
// ============================================================

function basePos(b) {
  if (b === 0) return FIELD.base1;
  if (b === 1) return FIELD.base2;
  if (b === 2) return FIELD.base3;
  return FIELD.home;
}

function drawField() {
  // 背景
  ctx.fillStyle = "#1a4a1a";
  ctx.fillRect(0, 0, CW, CH);

  // 外野芝（縞模様）
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#1a4a1a" : "#1e5420";
    ctx.beginPath();
    ctx.arc(FIELD.cx, FIELD.cy, 200 - i * 22, 0, Math.PI * 2);
    ctx.fill();
  }

  // 内野土
  ctx.fillStyle = "#7a5230";
  ctx.beginPath();
  ctx.moveTo(FIELD.home.x, FIELD.home.y);
  ctx.lineTo(FIELD.base1.x, FIELD.base1.y);
  ctx.lineTo(FIELD.base2.x, FIELD.base2.y);
  ctx.lineTo(FIELD.base3.x, FIELD.base3.y);
  ctx.closePath();
  ctx.fill();

  // ファウルライン
  ctx.strokeStyle = "#ffffff44";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(FIELD.home.x, FIELD.home.y);
  ctx.lineTo(CW * 0.05, CH * 0.05);
  ctx.moveTo(FIELD.home.x, FIELD.home.y);
  ctx.lineTo(CW * 0.95, CH * 0.05);
  ctx.stroke();

  // マウンド
  ctx.fillStyle = "#8b6340";
  ctx.beginPath();
  ctx.ellipse(FIELD.mound.x, FIELD.mound.y, 14, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // ホームプレート
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(FIELD.home.x, FIELD.home.y - 7);
  ctx.lineTo(FIELD.home.x + 6, FIELD.home.y);
  ctx.lineTo(FIELD.home.x + 6, FIELD.home.y + 5);
  ctx.lineTo(FIELD.home.x - 6, FIELD.home.y + 5);
  ctx.lineTo(FIELD.home.x - 6, FIELD.home.y);
  ctx.closePath();
  ctx.fill();

  // 塁（白い四角）
  [[FIELD.base1, "#ffffff"], [FIELD.base2, "#ffffff"], [FIELD.base3, "#ffffff"]].forEach(([pos, col]) => {
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = col;
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();
  });

  // 塁上のランナー表示
  G.bases.forEach((occupied, i) => {
    if (occupied) {
      const pos = [FIELD.base1, FIELD.base2, FIELD.base3][i];
      ctx.fillStyle = "#ffdd00";
      ctx.beginPath();
      ctx.arc(pos.x, pos.y - 14, 6, 0, Math.PI * 2);
      ctx.fill();
      // ランナーの体
      ctx.fillStyle = "#ffaa00";
      ctx.fillRect(pos.x - 4, pos.y - 8, 8, 10);
    }
  });

  // バッターボックス
  ctx.strokeStyle = "#ffffff55";
  ctx.lineWidth = 1;
  ctx.strokeRect(FIELD.batter.x - 18, FIELD.batter.y - 20, 36, 30);
  ctx.strokeRect(FIELD.batter.x - 38, FIELD.batter.y - 20, 36, 30);
}

function drawPitcher(state, frame) {
  const px = FIELD.mound.x;
  const py = FIELD.mound.y - 12;
  ctx.save();
  ctx.translate(px, py);

  // 体
  ctx.fillStyle = defenseTeam().color;
  ctx.fillRect(-6, 0, 12, 16);

  // 頭
  ctx.fillStyle = "#f5c5a0";
  ctx.beginPath();
  ctx.arc(0, -7, 7, 0, Math.PI * 2);
  ctx.fill();

  // 帽子
  ctx.fillStyle = defenseTeam().color;
  ctx.fillRect(-8, -13, 16, 6);
  ctx.fillRect(-5, -15, 10, 4);

  // 腕（投球モーション）
  ctx.strokeStyle = "#f5c5a0";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";

  if (state === "windup") {
    // ワインドアップ：腕を上げる
    const t = (frame % 20) / 20;
    const angle = -Math.PI * 0.5 - t * Math.PI * 0.5;
    ctx.beginPath();
    ctx.moveTo(6, 4);
    ctx.lineTo(6 + Math.cos(angle) * 14, 4 + Math.sin(angle) * 14);
    ctx.stroke();
  } else if (state === "release") {
    // リリース：腕を前に振る
    const t = (frame % 10) / 10;
    const angle = -Math.PI * 1.0 + t * Math.PI * 0.8;
    ctx.beginPath();
    ctx.moveTo(6, 4);
    ctx.lineTo(6 + Math.cos(angle) * 14, 4 + Math.sin(angle) * 14);
    ctx.stroke();
  } else {
    // アイドル
    ctx.beginPath();
    ctx.moveTo(-6, 4);
    ctx.lineTo(-14, 12);
    ctx.moveTo(6, 4);
    ctx.lineTo(14, 12);
    ctx.stroke();
  }

  // 足
  ctx.strokeStyle = defenseTeam().color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-4, 16);
  ctx.lineTo(-6, 26);
  ctx.moveTo(4, 16);
  ctx.lineTo(6, 26);
  ctx.stroke();

  ctx.restore();
}

function drawBatter(state, frame) {
  const bx = FIELD.batter.x;
  const by = FIELD.batter.y - 10;
  ctx.save();
  ctx.translate(bx, by);

  // 体
  ctx.fillStyle = attackTeam().color;
  ctx.fillRect(-6, 0, 12, 16);

  // 頭
  ctx.fillStyle = "#f5c5a0";
  ctx.beginPath();
  ctx.arc(0, -7, 7, 0, Math.PI * 2);
  ctx.fill();

  // 帽子
  ctx.fillStyle = attackTeam().color;
  ctx.fillRect(-8, -13, 16, 6);
  ctx.fillRect(-5, -15, 10, 4);

  // バット
  ctx.strokeStyle = "#8b5e3c";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";

  if (state === "ready") {
    // 構え
    ctx.beginPath();
    ctx.moveTo(-8, -4);
    ctx.lineTo(-16, -22);
    ctx.stroke();
  } else if (state === "swing") {
    // スイング
    const t = clamp((frame % 12) / 12, 0, 1);
    const startA = -Math.PI * 0.8;
    const endA   =  Math.PI * 0.1;
    const angle  = startA + (endA - startA) * t;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * 22, Math.sin(angle) * 22);
    ctx.stroke();
    // スイング軌跡
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 22, startA, angle);
    ctx.stroke();
  } else if (state === "miss") {
    // 空振り（バットが前に出る）
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(18, -4);
    ctx.stroke();
  } else {
    // アイドル（バットを持って立つ）
    ctx.beginPath();
    ctx.moveTo(-8, -4);
    ctx.lineTo(-14, -18);
    ctx.stroke();
  }

  // 足
  ctx.strokeStyle = attackTeam().color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-4, 16);
  ctx.lineTo(-6, 26);
  ctx.moveTo(4, 16);
  ctx.lineTo(6, 26);
  ctx.stroke();

  ctx.restore();
}

function drawBall(x, y, trail) {
  // トレイル
  trail.forEach((pt, i) => {
    const alpha = (i / trail.length) * 0.4;
    ctx.fillStyle = `rgba(255,255,200,${alpha})`;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 3 * (i / trail.length), 0, Math.PI * 2);
    ctx.fill();
  });

  // ボール本体
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();

  // 縫い目
  ctx.strokeStyle = "#cc2200";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 3, -0.3, 0.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 3, Math.PI - 0.3, Math.PI + 0.3);
  ctx.stroke();
}

function drawFielder(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = defenseTeam().color;
  ctx.fillRect(-5, 0, 10, 14);
  ctx.fillStyle = "#f5c5a0";
  ctx.beginPath();
  ctx.arc(0, -6, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = defenseTeam().color;
  ctx.fillRect(-7, -11, 14, 5);
  ctx.restore();
}

function drawScene() {
  ctx.clearRect(0, 0, CW, CH);
  drawField();
  drawPitcher(anim.pitcher.state, anim.pitcher.frame);
  drawBatter(anim.batter.state, anim.batter.frame);
  if (anim.fielder.visible) {
    drawFielder(anim.fielder.x, anim.fielder.y);
  }
  if (anim.ball.visible) {
    drawBall(anim.ball.x, anim.ball.y, anim.ball.trail);
  }
}

// ============================================================
// 8. アニメーション制御
// ============================================================

function lerp(a, b, t) { return a + (b - a) * t; }

function animatePitch(onDone) {
  // ワインドアップ → リリース → ボールが飛ぶ
  let frame = 0;
  const total = 30;

  function step() {
    frame++;
    if (frame < 15) {
      anim.pitcher.state = "windup";
      anim.pitcher.frame = frame;
    } else {
      anim.pitcher.state = "release";
      anim.pitcher.frame = frame - 15;
    }

    // ボール：マウンドからホームへ
    const t = clamp((frame - 10) / 20, 0, 1);
    anim.ball.visible = frame >= 10;
    anim.ball.x = lerp(FIELD.mound.x, FIELD.home.x, t);
    anim.ball.y = lerp(FIELD.mound.y, FIELD.home.y, t);
    // 放物線（わずかに）
    anim.ball.y -= Math.sin(t * Math.PI) * 8;

    // トレイル
    if (anim.ball.visible) {
      anim.ball.trail.push({ x: anim.ball.x, y: anim.ball.y });
      if (anim.ball.trail.length > 8) anim.ball.trail.shift();
    }

    drawScene();

    if (frame < total) {
      anim.rafId = requestAnimationFrame(step);
    } else {
      anim.pitcher.state = "idle";
      anim.ball.trail = [];
      if (onDone) onDone();
    }
  }
  anim.rafId = requestAnimationFrame(step);
}

function animateSwing(hit, onDone) {
  let frame = 0;
  const total = 18;

  function step() {
    frame++;
    anim.batter.state = hit ? "swing" : "miss";
    anim.batter.frame = frame;

    // ボールをホーム付近で止める
    anim.ball.x = FIELD.home.x + 5;
    anim.ball.y = FIELD.home.y - 5;

    drawScene();

    if (frame < total) {
      anim.rafId = requestAnimationFrame(step);
    } else {
      if (onDone) onDone();
    }
  }
  anim.rafId = requestAnimationFrame(step);
}

function animateBallFlight(type, onDone) {
  // type: "grounder" | "fly" | "liner" | "hit" | "homerun"
  let frame = 0;
  let total;
  let targetX, targetY, peakY;
  let fielderTargetX, fielderTargetY;
  let fielderStartX = FIELD.mound.x + rnd(-60, 60);
  let fielderStartY = FIELD.mound.y + rnd(-30, 30);

  const startX = FIELD.home.x;
  const startY = FIELD.home.y;

  switch (type) {
    case "grounder":
      total = 35;
      targetX = FIELD.cx + rnd(-80, 80);
      targetY = FIELD.cy + rnd(10, 30);
      peakY   = startY;
      fielderTargetX = targetX;
      fielderTargetY = targetY;
      break;
    case "fly":
      total = 50;
      targetX = FIELD.cx + rnd(-100, 100);
      targetY = FIELD.cy - rnd(30, 60);
      peakY   = CH * 0.15;
      fielderTargetX = targetX;
      fielderTargetY = targetY;
      break;
    case "liner":
      total = 28;
      targetX = FIELD.cx + rnd(-120, 120);
      targetY = FIELD.cy - rnd(10, 30);
      peakY   = startY - 20;
      fielderTargetX = targetX;
      fielderTargetY = targetY;
      break;
    case "hit":
      total = 55;
      targetX = FIELD.cx + rnd(-140, 140);
      targetY = CH * 0.18;
      peakY   = CH * 0.08;
      fielderTargetX = targetX + rnd(-20, 20);
      fielderTargetY = targetY + rnd(10, 30);
      break;
    case "homerun":
      total = 70;
      targetX = FIELD.cx + rnd(-80, 80);
      targetY = -30;
      peakY   = -60;
      fielderTargetX = targetX;
      fielderTargetY = CH * 0.1;
      break;
  }

  // フィールダー初期位置
  anim.fielder.x = fielderStartX;
  anim.fielder.y = fielderStartY;
  anim.fielder.visible = (type !== "homerun");

  function step() {
    frame++;
    const t = clamp(frame / total, 0, 1);

    // ボール軌道
    anim.ball.x = lerp(startX, targetX, t);
    const baseY = lerp(startY, targetY, t);
    anim.ball.y = baseY - Math.sin(t * Math.PI) * Math.abs(startY - peakY);

    // ゴロは地面バウンド演出
    if (type === "grounder") {
      anim.ball.y = lerp(startY, targetY, t) - Math.abs(Math.sin(t * Math.PI * 3)) * 18;
    }

    // トレイル
    anim.ball.trail.push({ x: anim.ball.x, y: anim.ball.y });
    if (anim.ball.trail.length > 10) anim.ball.trail.shift();

    // フィールダーがボールを追う
    if (anim.fielder.visible && frame > total * 0.3) {
      const ft = clamp((frame - total * 0.3) / (total * 0.7), 0, 1);
      anim.fielder.x = lerp(fielderStartX, fielderTargetX, ft);
      anim.fielder.y = lerp(fielderStartY, fielderTargetY, ft);
    }

    drawScene();

    if (frame < total) {
      anim.rafId = requestAnimationFrame(step);
    } else {
      anim.ball.visible = false;
      anim.ball.trail = [];
      anim.fielder.visible = false;
      if (onDone) onDone();
    }
  }
  anim.rafId = requestAnimationFrame(step);
}

function animateRunners(runnerMoves, onDone) {
  // runnerMoves: [{from, to}] (from/to: 0=1塁,1=2塁,2=3塁,3=本塁,-1=なし)
  if (!runnerMoves || runnerMoves.length === 0) {
    if (onDone) onDone();
    return;
  }

  let frame = 0;
  const total = 40;

  const positions = [FIELD.base1, FIELD.base2, FIELD.base3, FIELD.home];

  // ランナーアニメ用データ
  const runners = runnerMoves.map((mv, i) => ({
    from: positions[mv.from],
    to:   mv.to >= 0 ? positions[mv.to] : positions[3],
    runner: anim.runners[i],
  }));

  runners.forEach((r, i) => {
    anim.runners[i].visible = true;
    anim.runners[i].x = r.from.x;
    anim.runners[i].y = r.from.y;
  });

  function step() {
    frame++;
    const t = clamp(frame / total, 0, 1);

    runners.forEach((r, i) => {
      anim.runners[i].x = lerp(r.from.x, r.to.x, t);
      anim.runners[i].y = lerp(r.from.y, r.to.y, t);
    });

    drawScene();

    // ランナーを描画
    runners.forEach((r, i) => {
      const rx = anim.runners[i].x;
      const ry = anim.runners[i].y;
      ctx.fillStyle = "#ffdd00";
      ctx.beginPath();
      ctx.arc(rx, ry - 14, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffaa00";
      ctx.fillRect(rx - 4, ry - 8, 8, 10);
    });

    if (frame < total) {
      anim.rafId = requestAnimationFrame(step);
    } else {
      runners.forEach((r, i) => { anim.runners[i].visible = false; });
      if (onDone) onDone();
    }
  }
  anim.rafId = requestAnimationFrame(step);
}

// ============================================================
// 9. 実況テキスト
// ============================================================
const COMMENTARY = {
  pitch:    ["さあ、投げた！", "ピッチャー振りかぶって…", "第一球！", "投げた！"],
  ball:     ["ボール！", "外れてボール。", "ボール、低め。", "ボールです。"],
  strike:   ["ストライク！", "見逃しストライク！", "ストライクゾーンを通過！"],
  strikeout:["三振！！", "見逃し三振！！", "空振り三振！！", "バッターアウト！！"],
  grounder: ["ゴロ！　内野へ転がる！", "ゴロゴロ…内野ゴロ！", "転がった！"],
  fly:      ["高く上がった！　フライ！", "大きなフライ！", "打ち上げた！"],
  liner:    ["ライナー！　鋭い打球！", "ビュン！ライナー性の当たり！"],
  hit_single: ["ヒット！！", "カキーン！ヒット！！", "いい当たり！ヒット！！"],
  hit_double: ["ツーベース！！", "長打！！ツーベースヒット！！"],
  hit_triple: ["スリーベース！！！", "三塁打！！！"],
  homerun:  ["入ったーー！！ホームラン！！！", "場外弾！！ホームラン！！！", "スタンドイン！！！"],
  out_fly:  ["アウト！　フライをキャッチ！", "捕った！アウト！"],
  out_grounder: ["ゴロアウト！", "一塁送球、アウト！"],
  score:    ["得点！！", "ホームイン！！", "スコアが動いた！！"],
  inning_change: ["チェンジ！", "攻守交代！", "スリーアウト！チェンジ！！"],
  walk:     ["フォアボール！！", "四球！！バッターは一塁へ。"],
  swing_miss: ["空振り！", "バットが空を切った！", "ミス！"],
};

function say(key, extra = "") {
  const lines = COMMENTARY[key];
  const text = lines ? pick(lines) : key;
  document.getElementById("commentary-text").textContent = text + (extra ? "\n" + extra : "");
}

// ============================================================
// 10. UI 更新
// ============================================================
function updateScoreboard() {
  const tbody = document.getElementById("score-body");
  tbody.innerHTML = "";
  G.teams.forEach((team, ti) => {
    const tr = document.createElement("tr");
    let html = `<td class="team-name">${team.name}</td>`;
    for (let i = 0; i < 9; i++) {
      const isActive = (G.inning - 1 === i && G.half === ti);
      const score = team.scores[i];
      html += `<td class="${isActive ? "active-inning" : ""}">${score !== null ? score : (isActive ? "▶" : "-")}</td>`;
    }
    html += `<td class="score-total">${team.totalRuns}</td>`;
    tr.innerHTML = html;
    tbody.appendChild(tr);
  });
}

function updateStatus() {
  const halfStr = G.half === 0 ? "表" : "裏";
  document.getElementById("inning-display").textContent = `${G.inning}回${halfStr}`;

  // アウト
  [0, 1].forEach(i => {
    document.getElementById(`out${i}`).classList.toggle("filled", i < G.outs);
  });

  // ボールカウント
  [0, 1, 2].forEach(i => {
    document.getElementById(`b${i}`).classList.toggle("on", i < G.balls);
  });

  // ストライクカウント
  [0, 1].forEach(i => {
    document.getElementById(`s${i}`).classList.toggle("on", i < G.strikes);
  });
}

function updateBatterInfo() {
  const batter  = currentBatter();
  const pitcher = currentPitcher();
  document.getElementById("batter-name-display").textContent   = batter.name;
  document.getElementById("pitcher-name-display").textContent  = pitcher.name;
  document.getElementById("batter-stats-display").textContent  =
    `POW:${batter.pow} MEET:${batter.meet} SPD:${batter.spd}`;
}

// ============================================================
// 11. ゲームロジック
// ============================================================

function calcHitResult(batter, pitcher) {
  // 打撃判定
  // ストライクゾーン確率
  const strikeChance = 0.35 + pitcher.pitch / 400;
  const roll = Math.random();

  // ボール
  if (roll < (1 - strikeChance) * 0.5) {
    return { type: "ball" };
  }

  // ストライク（見逃し）
  const lookChance = 0.18 + (100 - batter.meet) / 400;
  if (roll < lookChance) {
    return { type: "strike_look" };
  }

  // 空振り
  const missChance = lookChance + 0.12 + (100 - batter.meet) / 500;
  if (roll < missChance) {
    return { type: "strike_swing" };
  }

  // 打球
  const contact = (batter.meet + batter.pow) / 200;
  const pitchDef = pitcher.pitch / 100;
  const hitRoll = Math.random();

  // ホームラン
  const hrChance = (batter.pow / 100) * 0.15 * (1 - pitchDef * 0.5);
  if (hitRoll < hrChance) {
    return { type: "homerun" };
  }

  // ヒット種別
  const hitChance = contact * 0.55 * (1 - pitchDef * 0.3);
  if (hitRoll < hrChance + hitChance) {
    const r = Math.random();
    if (r < 0.08) return { type: "triple" };
    if (r < 0.28) return { type: "double" };
    return { type: "single" };
  }

  // アウト打球
  const r2 = Math.random();
  if (r2 < 0.4) return { type: "grounder_out" };
  if (r2 < 0.75) return { type: "fly_out" };
  return { type: "liner_out" };
}

function advanceBatter() {
  const t = attackTeam();
  t.batterIdx++;
}

function addOut() {
  G.outs++;
  if (G.outs >= 3) {
    return true; // チェンジ
  }
  return false;
}

function addScore(runs) {
  const t = attackTeam();
  t.totalRuns += runs;
  t.scores[G.inning - 1] = (t.scores[G.inning - 1] || 0) + runs;
  updateScoreboard();
}

function resetCount() {
  G.balls   = 0;
  G.strikes = 0;
}

function resetInning() {
  G.outs   = 0;
  G.bases  = [false, false, false];
  resetCount();
}

// 塁上のランナーを進める
function advanceRunners(bases) {
  // bases: 進む塁数
  let scored = 0;
  const newBases = [false, false, false];

  // 3塁 → 本塁
  if (G.bases[2]) {
    if (3 - 2 + bases >= 1) scored++;
    else newBases[2 + bases - 1] = true;
  }
  // 2塁
  if (G.bases[1]) {
    const newBase = 1 + bases;
    if (newBase >= 3) scored++;
    else newBases[newBase] = true;
  }
  // 1塁
  if (G.bases[0]) {
    const newBase = 0 + bases;
    if (newBase >= 3) scored++;
    else newBases[newBase] = true;
  }

  G.bases = newBases;
  return scored;
}

// ============================================================
// 11b. 追加演出：フラッシュ・大文字テキスト
// ============================================================

function flashScreen(color = "#ffffff", duration = 300) {
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position:fixed;top:0;left:0;right:0;bottom:0;
    background:${color};opacity:0.35;
    pointer-events:none;z-index:9998;
    transition:opacity ${duration}ms ease-out;
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { overlay.style.opacity = "0"; });
  });
  setTimeout(() => overlay.remove(), duration + 50);
}

function showBigText(text, color = "#f5d800", duration = 1200) {
  const el = document.createElement("div");
  el.style.cssText = `
    position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
    font-family:'Press Start 2P',monospace;
    font-size:clamp(18px,5vw,32px);
    color:${color};
    text-shadow:3px 3px 0 #000,6px 6px 0 rgba(0,0,0,0.5);
    pointer-events:none;z-index:10000;
    white-space:nowrap;
    animation:bigTextAnim ${duration}ms ease-out forwards;
  `;
  el.textContent = text;
  document.body.appendChild(el);
  const style = document.createElement("style");
  style.textContent = `
    @keyframes bigTextAnim {
      0%   { opacity:0; transform:translate(-50%,-50%) scale(0.5); }
      20%  { opacity:1; transform:translate(-50%,-50%) scale(1.2); }
      60%  { opacity:1; transform:translate(-50%,-50%) scale(1.0); }
      100% { opacity:0; transform:translate(-50%,-60%) scale(1.0); }
    }
  `;
  document.head.appendChild(style);
  setTimeout(() => { el.remove(); style.remove(); }, duration + 50);
}

// ============================================================
// 12. メインゲームフロー
// ============================================================

let pitchBtnLocked = false;

async function doPitch() {
  if (pitchBtnLocked || G.phase === "GAMEOVER") return;
  pitchBtnLocked = true;
  document.getElementById("pitch-btn").disabled = true;

  G.phase = "PITCHING";

  // 1. 投球アニメーション
  say("pitch");
  await new Promise(res => animatePitch(res));
  await sleep(300);

  // 2. 結果判定
  const batter  = currentBatter();
  const pitcher = currentPitcher();
  const result  = calcHitResult(batter, pitcher);

  // 3. スイング / 見逃しアニメーション
  const isSwing = !["ball", "strike_look"].includes(result.type);
  await new Promise(res => animateSwing(isSwing, res));
  await sleep(400);

  // 4. 結果処理
  await handleResult(result);

  // 5. UI更新
  updateStatus();
  updateScoreboard();
  updateBatterInfo();
  drawScene();

  if (G.phase !== "GAMEOVER") {
    pitchBtnLocked = false;
    document.getElementById("pitch-btn").disabled = false;
  }
}

async function handleResult(result) {
  switch (result.type) {

    case "ball":
      G.balls++;
      if (G.balls >= 4) {
        say("walk");
        await sleep(600);
        // フォアボール
        let scored = 0;
        if (G.bases[2] && G.bases[1] && G.bases[0]) { scored = 1; G.bases[2] = false; }
        if (G.bases[1] && G.bases[0]) G.bases[2] = true;
        if (G.bases[0]) G.bases[1] = true;
        G.bases[0] = true;
        if (scored > 0) {
          addScore(scored);
          say("score", `${attackTeam().name} +${scored}点！`);
          await sleep(800);
        }
        resetCount();
        advanceBatter();
      } else {
        say("ball");
        await sleep(400);
      }
      break;

    case "strike_look":
      G.strikes++;
      if (G.strikes >= 3) {
        say("strikeout");
        await sleep(600);
        anim.batter.state = "idle";
        if (addOut()) await doInningChange();
        else { resetCount(); advanceBatter(); }
      } else {
        say("strike");
        await sleep(400);
      }
      break;

    case "strike_swing":
      G.strikes++;
      say("swing_miss");
      anim.batter.state = "miss";
      drawScene();
      await sleep(500);
      if (G.strikes >= 3) {
        say("strikeout");
        showBigText("三振！！", "#cc2200", 1000);
        await sleep(700);
        anim.batter.state = "idle";
        if (addOut()) await doInningChange();
        else { resetCount(); advanceBatter(); }
      }
      break;

    case "grounder_out":
      say("grounder");
      await new Promise(res => animateBallFlight("grounder", res));
      await sleep(300);
      say("out_grounder");
      await sleep(500);
      anim.batter.state = "idle";
      if (addOut()) await doInningChange();
      else { resetCount(); advanceBatter(); }
      break;

    case "fly_out":
      say("fly");
      await new Promise(res => animateBallFlight("fly", res));
      await sleep(300);
      say("out_fly");
      await sleep(500);
      anim.batter.state = "idle";
      if (addOut()) await doInningChange();
      else { resetCount(); advanceBatter(); }
      break;

    case "liner_out":
      say("liner");
      await new Promise(res => animateBallFlight("liner", res));
      await sleep(300);
      say("out_fly");
      await sleep(500);
      anim.batter.state = "idle";
      if (addOut()) await doInningChange();
      else { resetCount(); advanceBatter(); }
      break;

    case "single": {
      say("hit_single");
      flashScreen("#ffffff", 200);
      attackTeam().hits++;
      await new Promise(res => animateBallFlight("hit", res));
      await sleep(300);
      const scored = advanceRunners(1);
      G.bases[0] = true;
      if (scored > 0) {
        say("score", `${attackTeam().name} +${scored}点！`);
        addScore(scored);
        await sleep(800);
      }
      resetCount();
      advanceBatter();
      break;
    }

    case "double": {
      say("hit_double");
      showBigText("2B HIT!", "#4caf50", 1000);
      flashScreen("#ffffff", 200);
      attackTeam().hits++;
      await new Promise(res => animateBallFlight("hit", res));
      await sleep(300);
      const scored = advanceRunners(2);
      G.bases[1] = true;
      if (scored > 0) {
        say("score", `${attackTeam().name} +${scored}点！`);
        addScore(scored);
        await sleep(800);
      }
      resetCount();
      advanceBatter();
      break;
    }

    case "triple": {
      say("hit_triple");
      showBigText("3B HIT!!", "#4caf50", 1200);
      flashScreen("#ffffff", 200);
      attackTeam().hits++;
      await new Promise(res => animateBallFlight("hit", res));
      await sleep(300);
      const scored = advanceRunners(3);
      G.bases[2] = true;
      if (scored > 0) {
        say("score", `${attackTeam().name} +${scored}点！`);
        addScore(scored);
        await sleep(800);
      }
      resetCount();
      advanceBatter();
      break;
    }

    case "homerun": {
      say("homerun");
      attackTeam().hits++;
      await new Promise(res => animateBallFlight("homerun", res));
      flashScreen("#ffdd00", 400);
      showBigText("⚾ HOME RUN !!", "#f5d800", 1500);
      await sleep(600);
      // 全ランナー＋バッター生還
      let runs = 1;
      if (G.bases[0]) runs++;
      if (G.bases[1]) runs++;
      if (G.bases[2]) runs++;
      G.bases = [false, false, false];
      addScore(runs);
      say("score", `${attackTeam().name} +${runs}点！ ホームラン！！`);
      await sleep(1200);
      resetCount();
      advanceBatter();
      break;
    }
  }
}

async function doInningChange() {
  say("inning_change");
  await sleep(1000);
  resetInning();

  if (G.half === 0) {
    // 表→裏
    G.half = 1;
  } else {
    // 裏→次のイニング
    G.half = 0;
    G.inning++;

    if (G.inning > 9) {
      await endGame();
      return;
    }
  }

  // 新イニング開始
  const halfStr = G.half === 0 ? "表" : "裏";
  document.getElementById("commentary-text").textContent =
    `${G.inning}回${halfStr}　開始！`;

  updateStatus();
  updateScoreboard();
  updateBatterInfo();
  drawScene();
  await sleep(600);
}

async function endGame() {
  G.phase = "GAMEOVER";
  document.getElementById("pitch-btn").disabled = true;

  const [t0, t1] = G.teams;
  let winner, msg;
  if (t0.totalRuns > t1.totalRuns) {
    winner = t0.name;
    msg = `${t0.name}  ${t0.totalRuns} - ${t1.totalRuns}  ${t1.name}`;
  } else if (t1.totalRuns > t0.totalRuns) {
    winner = t1.name;
    msg = `${t0.name}  ${t0.totalRuns} - ${t1.totalRuns}  ${t1.name}`;
  } else {
    winner = "引き分け";
    msg = `${t0.name}  ${t0.totalRuns} - ${t1.totalRuns}  ${t1.name}`;
  }

  await sleep(800);

  document.getElementById("game-screen").style.display = "none";
  const rs = document.getElementById("result-screen");
  rs.style.display = "flex";
  document.getElementById("result-title").textContent =
    winner === "引き分け" ? "引き分け！" : `${winner} の勝利！！`;
  document.getElementById("result-detail").innerHTML =
    `${msg}<br><br>` +
    `${t0.name}　${t0.hits}安打<br>` +
    `${t1.name}　${t1.hits}安打`;
}

// ============================================================
// 13. ゲーム初期化
// ============================================================

const TEAM_COLORS = [
  "#1a5fa8", "#cc2200", "#1a7a1a", "#8b1a8b",
  "#c87800", "#1a7a7a", "#7a1a1a", "#3a3a8b",
];
const TEAM_NAMES = [
  "東京スターズ", "大阪タイガース", "横浜マリンズ", "名古屋ドラゴンズ",
  "福岡ホークス", "札幌ベアーズ", "広島カープス", "仙台イーグルス",
  "ニューヨーク・ヤンキース", "ロサンゼルス・ドジャース",
  "ボストン・レッドソックス", "シカゴ・カブス",
];

function startGame() {
  // チームをランダム生成
  const names  = shuffle(TEAM_NAMES).slice(0, 2);
  const colors = shuffle(TEAM_COLORS).slice(0, 2);
  G.teams  = [buildTeam(names[0], colors[0]), buildTeam(names[1], colors[1])];
  G.inning = 1;
  G.half   = 0;
  G.outs   = 0;
  G.balls  = 0;
  G.strikes = 0;
  G.bases  = [false, false, false];
  G.phase  = "IDLE";
  G.gameStarted = true;

  // スコアリセット
  G.teams.forEach(t => {
    t.scores    = Array(9).fill(null);
    t.totalRuns = 0;
    t.hits      = 0;
    t.batterIdx = 0;
  });

  // アニメ初期化
  anim.ball.visible = false;
  anim.ball.trail   = [];
  anim.pitcher.state = "idle";
  anim.batter.state  = "ready";
  anim.fielder.visible = false;

  // 画面切り替え
  document.getElementById("title-screen").style.display  = "none";
  document.getElementById("result-screen").style.display = "none";
  document.getElementById("game-screen").style.display   = "flex";

  pitchBtnLocked = false;
  document.getElementById("pitch-btn").disabled = false;

  updateScoreboard();
  updateStatus();
  updateBatterInfo();
  drawScene();

  document.getElementById("commentary-text").textContent =
    `⚾ プレイボール！\n${G.teams[0].name} vs ${G.teams[1].name}`;
}

// ============================================================
// 14. イベントリスナー
// ============================================================
document.getElementById("start-btn").addEventListener("click", startGame);
document.getElementById("retry-btn").addEventListener("click", startGame);
document.getElementById("pitch-btn").addEventListener("click", doPitch);

// タップでも進行（フィールド）
document.getElementById("field-canvas").addEventListener("click", () => {
  if (!pitchBtnLocked && G.phase !== "GAMEOVER" && G.gameStarted) doPitch();
});

// ============================================================
// 15. 初期描画
// ============================================================
(function init() {
  // タイトル画面ではフィールドを描かない
  // ゲーム開始後に描画
  drawScene();
})();
