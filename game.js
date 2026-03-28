/* ============================================================
   RETRO BASEBALL  –  game.js  v3.0
   改善内容:
   [1] ホームベースの向きを正しく修正（尖端を捕手側＝下向きに）
   [2] バッターをホームベース横に正しく配置
   [3] ストライク（黄）・アウト（赤）の色を正しく修正
   [4] ピッチャーモード／バッターモード選択を追加
   [5] ピッチャーモード：プレイヤーが投球、CPUが打撃
       バッターモード：CPUが投球、プレイヤーがスイングタイミングを操作
   ============================================================ */

"use strict";

// ============================================================
// 1. 選手データ
// ============================================================
const PLAYER_POOL = [
  { name:"王 貞治",              pow:98, meet:90, spd:70, pitch:40, def:80 },
  { name:"長嶋 茂雄",            pow:85, meet:95, spd:85, pitch:35, def:90 },
  { name:"大谷 翔平",            pow:99, meet:88, spd:90, pitch:99, def:85 },
  { name:"イチロー",             pow:65, meet:99, spd:99, pitch:30, def:99 },
  { name:"松井 秀喜",            pow:95, meet:85, spd:70, pitch:30, def:80 },
  { name:"野茂 英雄",            pow:50, meet:40, spd:55, pitch:97, def:70 },
  { name:"江夏 豊",              pow:55, meet:50, spd:50, pitch:95, def:72 },
  { name:"金田 正一",            pow:52, meet:48, spd:52, pitch:96, def:68 },
  { name:"ベーブ・ルース",       pow:99, meet:85, spd:60, pitch:90, def:75 },
  { name:"ルー・ゲーリッグ",     pow:97, meet:88, spd:65, pitch:20, def:85 },
  { name:"ハンク・アーロン",     pow:96, meet:90, spd:75, pitch:20, def:88 },
  { name:"ウィリー・メイズ",     pow:90, meet:92, spd:95, pitch:20, def:99 },
  { name:"テッド・ウィリアムズ", pow:88, meet:97, spd:72, pitch:20, def:78 },
  { name:"マイク・トラウト",     pow:93, meet:91, spd:92, pitch:20, def:92 },
  { name:"ケン・グリフィーJr",   pow:94, meet:89, spd:88, pitch:20, def:97 },
  { name:"ロジャー・クレメンス", pow:55, meet:45, spd:50, pitch:98, def:70 },
  { name:"サンディ・コーファックス",pow:48,meet:42,spd:48,pitch:99,def:65 },
  { name:"ランディ・ジョンソン", pow:52, meet:40, spd:52, pitch:98, def:68 },
  { name:"田中 将大",            pow:50, meet:45, spd:55, pitch:94, def:75 },
  { name:"松坂 大輔",            pow:52, meet:44, spd:54, pitch:93, def:73 },
  { name:"山本 由伸",            pow:55, meet:48, spd:58, pitch:96, def:78 },
  { name:"清原 和博",            pow:97, meet:83, spd:68, pitch:20, def:82 },
  { name:"落合 博満",            pow:88, meet:98, spd:65, pitch:20, def:80 },
  { name:"張本 勲",              pow:80, meet:97, spd:80, pitch:20, def:85 },
  { name:"秋山 幸二",            pow:87, meet:86, spd:90, pitch:20, def:95 },
  { name:"福本 豊",              pow:60, meet:85, spd:99, pitch:20, def:92 },
  { name:"山田 哲人",            pow:85, meet:90, spd:92, pitch:20, def:90 },
  { name:"村上 宗隆",            pow:96, meet:87, spd:72, pitch:20, def:80 },
  { name:"佐々木 朗希",          pow:50, meet:42, spd:55, pitch:98, def:72 },
];

// ============================================================
// 2. ユーティリティ
// ============================================================
const rnd   = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick  = arr => arr[rnd(0, arr.length - 1)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lerp  = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 2);

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
function buildTeam(name, color, uniformColor) {
  const pool   = shuffle(PLAYER_POOL);
  const sorted = [...pool].sort((a, b) => b.pitch - a.pitch);
  const pitcher = sorted[0];
  const batters = pool.filter(p => p !== pitcher).slice(0, 8);
  return {
    name, color, uniformColor,
    roster: [pitcher, ...batters],
    pitcher,
    batterIdx: 0,
    scores: Array(9).fill(null),
    totalRuns: 0,
    hits: 0,
  };
}

// ============================================================
// 4. ゲーム状態
// ============================================================
const G = {
  teams: [],
  inning: 1,
  half: 0,
  outs: 0,
  balls: 0,
  strikes: 0,
  bases: [false, false, false],
  phase: "IDLE",
  gameStarted: false,
  // モード: "pitcher"=プレイヤーが投手, "batter"=プレイヤーが打者
  playerMode: "pitcher",
};

const attackTeam  = () => G.teams[G.half];
const defenseTeam = () => G.teams[1 - G.half];
const currentBatter  = () => { const t = attackTeam(); return t.roster[t.batterIdx % t.roster.length]; };
const currentPitcher = () => defenseTeam().pitcher;

// ============================================================
// 5. Canvas セットアップ
// ============================================================
const canvas = document.getElementById("field-canvas");
const ctx    = canvas.getContext("2d");
const CW = canvas.width;
const CH = canvas.height;

// ============================================================
// [FIX 2] 座標定数 - バッターをホームベース左横に正しく配置
// ============================================================
const POS = {
  mound:   { x: CW * 0.50, y: CH * 0.52 },
  // ホームベース中心
  home:    { x: CW * 0.50, y: CH * 0.87 },
  // バッター：ホームベースの左横（右打者）
  batter:  { x: CW * 0.50 - 30, y: CH * 0.87 },
  base1:   { x: CW * 0.74, y: CH * 0.62 },
  base2:   { x: CW * 0.50, y: CH * 0.36 },
  base3:   { x: CW * 0.26, y: CH * 0.62 },
  outfield:{ x: CW * 0.50, y: CH * 0.04 },
};

// ============================================================
// 6. アニメーション状態
// ============================================================
let anim = {
  ball: { x: 0, y: 0, visible: false, r: 7, trail: [] },
  pitcher: { state: "idle", frame: 0 },
  batter:  { state: "idle", frame: 0 },
  fielder: { x: 0, y: 0, tx: 0, ty: 0, visible: false },
  flash: { active: false, color: "#fff", alpha: 0 },
  rafId: null,
};

// バッターモード用：スイング受付フラグ
let swingReady = false;
let swingPressed = false;

// ============================================================
// 7. キャラクター描画
// ============================================================

/* ---- ピッチャー ---- */
function drawPitcherChar(cx, cy, state, frame, teamColor) {
  ctx.save();
  ctx.translate(cx, cy);

  const t = frame / 20;
  let armAngle = 0.3;
  let legSpread = 0;

  if (state === "windup") {
    armAngle = -Math.PI * 0.8 - Math.sin(t * Math.PI) * 0.4;
    legSpread = Math.sin(t * Math.PI) * 8;
  } else if (state === "release") {
    const rt = clamp(frame / 12, 0, 1);
    armAngle = -Math.PI * 0.8 + rt * Math.PI * 1.5;
    legSpread = 10;
  }

  // 足
  ctx.fillStyle = "#222";
  ctx.fillRect(-6, 28, 8, 10);
  ctx.fillRect(4 + legSpread, 28, 8, 10);

  // 胴体
  ctx.fillStyle = teamColor;
  ctx.fillRect(-10, 4, 20, 26);
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect(-2, 4, 4, 26);

  // 頭
  ctx.fillStyle = "#f5c090";
  ctx.beginPath();
  ctx.arc(0, -6, 11, 0, Math.PI * 2);
  ctx.fill();

  // 帽子
  ctx.fillStyle = teamColor;
  ctx.beginPath();
  ctx.ellipse(0, -10, 13, 6, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-13, -14, 26, 7);
  ctx.fillRect(-16, -8, 32, 4);

  // 投球腕
  ctx.save();
  ctx.translate(10, 10);
  ctx.rotate(armAngle);
  ctx.fillStyle = "#f5c090";
  ctx.fillRect(-4, 0, 8, 22);
  if (state !== "release" || frame < 8) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 24, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#cc0000";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 24, 5, 0.3, 1.2);
    ctx.stroke();
  }
  ctx.restore();

  // グローブ腕
  ctx.save();
  ctx.translate(-10, 10);
  ctx.rotate(0.4);
  ctx.fillStyle = "#f5c090";
  ctx.fillRect(-4, 0, 8, 18);
  ctx.fillStyle = "#8B4513";
  ctx.beginPath();
  ctx.arc(0, 20, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

/* ---- バッター ---- */
function drawBatterChar(cx, cy, state, frame, teamColor) {
  ctx.save();
  ctx.translate(cx, cy);

  let batAngle = -0.3;
  let batLength = 38;
  let bodyLean = 0;

  if (state === "ready") {
    batAngle = -0.5;
  } else if (state === "swing") {
    const st = clamp(frame / 10, 0, 1);
    batAngle = -0.5 + st * Math.PI * 1.1;
    bodyLean = st * 0.3;
  } else if (state === "miss") {
    batAngle = Math.PI * 0.5;
    bodyLean = 0.2;
  }

  // 足
  ctx.fillStyle = "#222";
  ctx.fillRect(-14, 28, 9, 10);
  ctx.fillRect(2, 28, 9, 10);

  // 胴体
  ctx.save();
  ctx.rotate(bodyLean);
  ctx.fillStyle = teamColor;
  ctx.fillRect(-10, 4, 20, 26);
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect(-2, 4, 4, 26);
  ctx.restore();

  // 頭
  ctx.fillStyle = "#f5c090";
  ctx.beginPath();
  ctx.arc(0, -6, 11, 0, Math.PI * 2);
  ctx.fill();

  // ヘルメット
  ctx.fillStyle = teamColor;
  ctx.beginPath();
  ctx.arc(0, -10, 13, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-13, -12, 26, 6);
  // つば（ピッチャー側＝左向き）
  ctx.fillRect(-20, -8, 16, 4);

  // バット
  ctx.save();
  ctx.translate(10, 8);
  ctx.rotate(batAngle);
  ctx.fillStyle = "#8B4513";
  ctx.fillRect(-3, 0, 6, batLength * 0.35);
  ctx.fillStyle = "#D2691E";
  ctx.beginPath();
  ctx.moveTo(-3, batLength * 0.3);
  ctx.lineTo(3, batLength * 0.3);
  ctx.lineTo(6, batLength);
  ctx.lineTo(-6, batLength);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect(-1, batLength * 0.3, 2, batLength * 0.6);
  ctx.restore();

  // 腕
  ctx.save();
  ctx.translate(10, 8);
  ctx.rotate(batAngle - 0.2);
  ctx.fillStyle = "#f5c090";
  ctx.fillRect(-4, 0, 8, 16);
  ctx.restore();

  ctx.restore();
}

/* ---- フィールダー ---- */
function drawFielderChar(fx, fy, teamColor) {
  ctx.save();
  ctx.translate(fx, fy);
  ctx.scale(0.75, 0.75);

  ctx.fillStyle = "#222";
  ctx.fillRect(-5, 22, 6, 8);
  ctx.fillRect(3, 22, 6, 8);

  ctx.fillStyle = teamColor;
  ctx.fillRect(-8, 3, 16, 20);

  ctx.fillStyle = "#f5c090";
  ctx.beginPath();
  ctx.arc(0, -5, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = teamColor;
  ctx.beginPath();
  ctx.ellipse(0, -8, 11, 5, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-11, -11, 22, 5);
  ctx.fillRect(-14, -7, 28, 3);

  ctx.fillStyle = "#8B4513";
  ctx.beginPath();
  ctx.arc(-12, -2, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/* ---- ランナー ---- */
function drawRunnerChar(rx, ry, teamColor) {
  ctx.save();
  ctx.translate(rx, ry);
  ctx.scale(0.65, 0.65);

  ctx.fillStyle = "#222";
  ctx.fillRect(-4, 20, 5, 7);
  ctx.fillRect(3, 20, 5, 7);

  ctx.fillStyle = teamColor;
  ctx.fillRect(-7, 2, 14, 18);

  ctx.fillStyle = "#f5c090";
  ctx.beginPath();
  ctx.arc(0, -4, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = teamColor;
  ctx.beginPath();
  ctx.ellipse(0, -7, 10, 4, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-10, -9, 20, 4);

  ctx.restore();
}

// ============================================================
// 8. フィールド描画
// ============================================================
function drawField() {
  // 空・背景
  const skyGrad = ctx.createLinearGradient(0, 0, 0, CH * 0.4);
  skyGrad.addColorStop(0, "#1a3a6a");
  skyGrad.addColorStop(1, "#2a5a9a");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, CW, CH * 0.4);

  // スタンド
  ctx.fillStyle = "#3a2a1a";
  ctx.fillRect(0, CH * 0.28, CW, CH * 0.15);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 24; col++) {
      const colors = ["#cc4444","#4444cc","#44cc44","#cccc44","#cc44cc","#44cccc"];
      ctx.fillStyle = colors[(row * 7 + col) % colors.length];
      ctx.beginPath();
      ctx.arc(col * (CW / 23) + rnd(-2, 2), CH * 0.30 + row * 10, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 外野芝
  for (let i = 6; i >= 0; i--) {
    ctx.fillStyle = i % 2 === 0 ? "#1a5a1a" : "#226622";
    ctx.beginPath();
    ctx.ellipse(CW * 0.5, CH * 0.75, CW * 0.48 - i * 12, CH * 0.38 - i * 8, 0, Math.PI, 0);
    ctx.fill();
  }

  // 内野土
  ctx.fillStyle = "#8B6340";
  ctx.beginPath();
  ctx.moveTo(POS.home.x, POS.home.y);
  ctx.lineTo(POS.base1.x, POS.base1.y);
  ctx.lineTo(POS.base2.x, POS.base2.y);
  ctx.lineTo(POS.base3.x, POS.base3.y);
  ctx.closePath();
  ctx.fill();

  // 内野芝
  ctx.fillStyle = "#1e5a1e";
  ctx.beginPath();
  ctx.moveTo(POS.home.x, POS.home.y - 10);
  ctx.lineTo(POS.base1.x - 10, POS.base1.y);
  ctx.lineTo(POS.base2.x, POS.base2.y + 10);
  ctx.lineTo(POS.base3.x + 10, POS.base3.y);
  ctx.closePath();
  ctx.fill();

  // ファウルライン
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(POS.home.x, POS.home.y);
  ctx.lineTo(CW * 0.02, CH * 0.05);
  ctx.moveTo(POS.home.x, POS.home.y);
  ctx.lineTo(CW * 0.98, CH * 0.05);
  ctx.stroke();
  ctx.setLineDash([]);

  // マウンド
  const moundGrad = ctx.createRadialGradient(POS.mound.x, POS.mound.y, 0, POS.mound.x, POS.mound.y, 18);
  moundGrad.addColorStop(0, "#a07848");
  moundGrad.addColorStop(1, "#8B6340");
  ctx.fillStyle = moundGrad;
  ctx.beginPath();
  ctx.ellipse(POS.mound.x, POS.mound.y + 4, 18, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // ============================================================
  // [FIX 1] ホームベース：正しい向き（五角形・尖端が捕手側＝下）
  // 野球のホームベースは手前（捕手側）が尖った五角形
  // ============================================================
  const hx = POS.home.x;
  const hy = POS.home.y;
  const hw = 10; // 横幅の半分
  const hh = 8;  // 縦の高さ
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(hx - hw, hy - hh);   // 左上
  ctx.lineTo(hx + hw, hy - hh);   // 右上
  ctx.lineTo(hx + hw, hy);        // 右中
  ctx.lineTo(hx,      hy + hh);   // 下（尖端・捕手側）
  ctx.lineTo(hx - hw, hy);        // 左中
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#aaaaaa";
  ctx.lineWidth = 1;
  ctx.stroke();

  // 塁
  const bases = [POS.base1, POS.base2, POS.base3];
  bases.forEach((pos, i) => {
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = G.bases[i] ? "#ffdd00" : "#ffffff";
    ctx.fillRect(-8, -8, 16, 16);
    ctx.strokeStyle = "#ccaa00";
    ctx.lineWidth = 1;
    ctx.strokeRect(-8, -8, 16, 16);
    ctx.restore();
  });

  // ============================================================
  // [FIX 2] バッターボックス：ホームベース両横に正しく描画
  // ============================================================
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1.5;
  // 右打者ボックス（ホームベース左側）
  ctx.strokeRect(POS.home.x - 50, POS.home.y - 28, 30, 44);
  // 左打者ボックス（ホームベース右側）
  ctx.strokeRect(POS.home.x + 20, POS.home.y - 28, 30, 44);
}

// ============================================================
// 9. ボール描画
// ============================================================
function drawBall() {
  if (!anim.ball.visible) return;

  const bx = anim.ball.x;
  const by = anim.ball.y;
  const br = anim.ball.r;

  anim.ball.trail.forEach((pt, i) => {
    const alpha = (i / anim.ball.trail.length) * 0.5;
    const r = br * (i / anim.ball.trail.length) * 0.8;
    ctx.fillStyle = `rgba(255,255,200,${alpha})`;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fill();
  });

  const ballGrad = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, br);
  ballGrad.addColorStop(0, "#ffffff");
  ballGrad.addColorStop(0.7, "#eeeeee");
  ballGrad.addColorStop(1, "#cccccc");
  ctx.fillStyle = ballGrad;
  ctx.beginPath();
  ctx.arc(bx, by, br, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#cc2222";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(bx - 1, by, br * 0.7, -0.5, 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(bx + 1, by, br * 0.7, Math.PI - 0.5, Math.PI + 0.5);
  ctx.stroke();
}

// ============================================================
// 10. メインシーン描画
// ============================================================
function drawScene() {
  ctx.clearRect(0, 0, CW, CH);
  drawField();

  G.bases.forEach((occ, i) => {
    if (occ) {
      const pos = [POS.base1, POS.base2, POS.base3][i];
      drawRunnerChar(pos.x, pos.y - 20, attackTeam().uniformColor);
    }
  });

  if (anim.fielder.visible) {
    drawFielderChar(anim.fielder.x, anim.fielder.y, defenseTeam().uniformColor);
  }

  drawPitcherChar(
    POS.mound.x, POS.mound.y - 20,
    anim.pitcher.state, anim.pitcher.frame,
    defenseTeam().uniformColor
  );

  // [FIX 2] バッターをホームベース左横に描画
  drawBatterChar(
    POS.batter.x, POS.batter.y - 30,
    anim.batter.state, anim.batter.frame,
    attackTeam().uniformColor
  );

  drawBall();

  if (anim.flash.active && anim.flash.alpha > 0) {
    ctx.fillStyle = anim.flash.color;
    ctx.globalAlpha = anim.flash.alpha;
    ctx.fillRect(0, 0, CW, CH);
    ctx.globalAlpha = 1;
  }
}

// ============================================================
// 11. アニメーション関数
// ============================================================

/* 投球アニメーション */
function animatePitch(onDone) {
  let frame = 0;
  const windupFrames = 22;
  const releaseFrames = 14;
  const total = windupFrames + releaseFrames;

  anim.ball.visible = false;

  function step() {
    frame++;
    if (frame <= windupFrames) {
      anim.pitcher.state = "windup";
      anim.pitcher.frame = frame;
    } else {
      anim.pitcher.state = "release";
      anim.pitcher.frame = frame - windupFrames;
    }
    drawScene();
    if (frame < total) {
      anim.rafId = requestAnimationFrame(step);
    } else {
      anim.pitcher.state = "idle";
      if (onDone) onDone();
    }
  }
  anim.rafId = requestAnimationFrame(step);
}

/* スイングアニメーション（ボールがホームベースに飛んでくる） */
function animateSwing(doSwing, onDone) {
  let frame = 0;
  const total = doSwing ? 16 : 10;

  anim.batter.state = doSwing ? "swing" : "ready";
  anim.batter.frame = 0;

  const ballStartX = POS.mound.x;
  const ballStartY = POS.mound.y - 10;
  // ボールはホームベース中心に向かう
  const ballEndX   = POS.home.x;
  const ballEndY   = POS.home.y - 8;

  anim.ball.visible = true;
  anim.ball.trail = [];

  function step() {
    frame++;
    const t = easeOut(clamp(frame / total, 0, 1));

    anim.ball.x = lerp(ballStartX, ballEndX, t);
    anim.ball.y = lerp(ballStartY, ballEndY, t) - Math.sin(t * Math.PI) * 8;
    anim.ball.trail.push({ x: anim.ball.x, y: anim.ball.y });
    if (anim.ball.trail.length > 8) anim.ball.trail.shift();

    if (doSwing) {
      anim.batter.state = "swing";
      anim.batter.frame = frame;
    }

    drawScene();

    if (frame < total) {
      anim.rafId = requestAnimationFrame(step);
    } else {
      if (!doSwing) anim.ball.visible = false;
      anim.ball.trail = [];
      if (onDone) onDone();
    }
  }
  anim.rafId = requestAnimationFrame(step);
}

/* 打球アニメーション */
function animateBallFlight(type, onDone) {
  let frame = 0;
  let total, targetX, targetY, peakY;
  let fielderSX = POS.mound.x + rnd(-70, 70);
  let fielderSY = POS.mound.y + rnd(-30, 20);
  let fielderTX, fielderTY;

  const startX = POS.home.x;
  const startY = POS.home.y - 8;

  switch (type) {
    case "grounder":
      total = 40;
      targetX = CW * 0.5 + rnd(-90, 90);
      targetY = POS.mound.y + rnd(10, 30);
      peakY   = startY;
      fielderTX = targetX;
      fielderTY = targetY;
      break;
    case "fly":
      total = 60;
      targetX = CW * 0.5 + rnd(-110, 110);
      targetY = CH * 0.42;
      peakY   = CH * 0.12;
      fielderTX = targetX + rnd(-20, 20);
      fielderTY = targetY + 10;
      break;
    case "liner":
      total = 25;
      targetX = CW * 0.5 + rnd(-130, 130);
      targetY = CH * 0.45;
      peakY   = startY - 15;
      fielderTX = targetX;
      fielderTY = targetY;
      break;
    case "hit":
      total = 65;
      targetX = CW * 0.5 + rnd(-150, 150);
      targetY = CH * 0.16;
      peakY   = CH * 0.06;
      fielderTX = targetX + rnd(-30, 30);
      fielderTY = targetY + 20;
      break;
    case "homerun":
      total = 80;
      targetX = CW * 0.5 + rnd(-100, 100);
      targetY = -50;
      peakY   = -80;
      fielderTX = targetX;
      fielderTY = CH * 0.08;
      break;
  }

  anim.fielder.x  = fielderSX;
  anim.fielder.y  = fielderSY;
  anim.fielder.tx = fielderTX;
  anim.fielder.ty = fielderTY;
  anim.fielder.visible = (type !== "homerun");

  anim.ball.visible = true;
  anim.ball.trail   = [];
  anim.ball.r       = type === "homerun" ? 9 : 7;

  function step() {
    frame++;
    const t = clamp(frame / total, 0, 1);

    anim.ball.x = lerp(startX, targetX, t);
    const baseY = lerp(startY, targetY, t);

    if (type === "grounder") {
      anim.ball.y = baseY - Math.abs(Math.sin(t * Math.PI * 3.5)) * 28 * (1 - t);
    } else if (type === "liner") {
      anim.ball.y = baseY - Math.sin(t * Math.PI) * 18;
    } else {
      anim.ball.y = baseY - Math.sin(t * Math.PI) * Math.abs(startY - peakY) * 1.1;
    }

    anim.ball.trail.push({ x: anim.ball.x, y: anim.ball.y });
    if (anim.ball.trail.length > 14) anim.ball.trail.shift();

    if (anim.fielder.visible && frame > total * 0.25) {
      const ft = easeOut(clamp((frame - total * 0.25) / (total * 0.75), 0, 1));
      anim.fielder.x = lerp(fielderSX, fielderTX, ft);
      anim.fielder.y = lerp(fielderSY, fielderTY, ft);
    }

    if (type === "homerun" && anim.ball.y < 0) {
      anim.flash.active = true;
      anim.flash.color  = "rgba(255,220,0,0.6)";
      anim.flash.alpha  = 0.6;
    }

    drawScene();

    if (frame < total) {
      anim.rafId = requestAnimationFrame(step);
    } else {
      anim.ball.visible    = false;
      anim.ball.trail      = [];
      anim.ball.r          = 7;
      anim.fielder.visible = false;
      anim.flash.active    = false;
      anim.flash.alpha     = 0;
      if (onDone) onDone();
    }
  }
  anim.rafId = requestAnimationFrame(step);
}

/* ランナーアニメーション */
function animateRunners(moves, onDone) {
  if (!moves || moves.length === 0) { if (onDone) onDone(); return; }

  let frame = 0;
  const total = 45;
  const posArr = [POS.base1, POS.base2, POS.base3, POS.home];

  const runners = moves.map(mv => ({
    from: posArr[mv.from],
    to:   posArr[mv.to >= 0 ? mv.to : 3],
    color: attackTeam().uniformColor,
  }));

  function step() {
    frame++;
    const t = easeOut(clamp(frame / total, 0, 1));

    drawScene();

    runners.forEach(r => {
      const rx = lerp(r.from.x, r.to.x, t);
      const ry = lerp(r.from.y, r.to.y, t) - Math.sin(t * Math.PI) * 12;
      drawRunnerChar(rx, ry - 20, r.color);
    });

    if (frame < total) {
      anim.rafId = requestAnimationFrame(step);
    } else {
      if (onDone) onDone();
    }
  }
  anim.rafId = requestAnimationFrame(step);
}

// ============================================================
// 12. 実況テキスト
// ============================================================
const COMMENTARY = {
  pitch:        ["さあ、投げた！", "ピッチャー振りかぶって…", "第一球！", "投げた！"],
  ball:         ["ボール！", "外れてボール。", "ボール、低め。", "ボールです。"],
  strike:       ["ストライク！", "見逃しストライク！", "ストライクゾーンを通過！"],
  strikeout:    ["三振！！", "見逃し三振！！", "空振り三振！！", "バッターアウト！！"],
  grounder:     ["ゴロ！　内野へ転がる！", "ゴロゴロ…内野ゴロ！", "転がった！"],
  fly:          ["高く上がった！　フライ！", "大きなフライ！", "打ち上げた！"],
  liner:        ["ライナー！　鋭い打球！", "ビュン！ライナー性の当たり！"],
  hit_single:   ["ヒット！！", "カキーン！ヒット！！", "いい当たり！ヒット！！"],
  hit_double:   ["ツーベース！！", "長打！！ツーベースヒット！！"],
  hit_triple:   ["スリーベース！！！", "三塁打！！！"],
  homerun:      ["入ったーー！！ホームラン！！！", "場外弾！！ホームラン！！！", "スタンドイン！！！"],
  out_fly:      ["アウト！　フライをキャッチ！", "捕った！アウト！"],
  out_grounder: ["ゴロアウト！", "一塁送球、アウト！"],
  score:        ["得点！！", "ホームイン！！", "スコアが動いた！！"],
  inning_change:["チェンジ！", "攻守交代！", "スリーアウト！チェンジ！！"],
  walk:         ["フォアボール！！", "四球！！バッターは一塁へ。"],
  swing_miss:   ["空振り！", "バットが空を切った！", "ミス！"],
  // バッターモード専用
  batter_hint:  ["タイミングを合わせて！", "ボールが来たらスイング！", "今だ！"],
  swing_late:   ["タイミングが遅かった！", "振り遅れ！"],
  swing_early:  ["早すぎた！", "空振り！フライングスイング！"],
  swing_good:   ["ナイスタイミング！", "いい当たりだ！"],
};

function say(key, extra = "") {
  const lines = COMMENTARY[key];
  const text  = lines ? pick(lines) : key;
  document.getElementById("commentary-text").textContent = text + (extra ? "  " + extra : "");
}

// ============================================================
// 13. 大テキスト・フラッシュ演出
// ============================================================
function showBigText(text, color = "#f5d800", duration = 1400) {
  const el = document.createElement("div");
  el.className = "big-text-overlay";
  el.style.cssText = `
    position:fixed;top:40%;left:50%;
    transform:translate(-50%,-50%) scale(0.5);
    font-family:'Press Start 2P',monospace;
    font-size:clamp(20px,6vw,38px);
    color:${color};
    text-shadow:4px 4px 0 #000,8px 8px 0 rgba(0,0,0,0.4);
    pointer-events:none;z-index:10000;
    white-space:nowrap;
    opacity:0;
    transition:transform 0.15s ease-out, opacity 0.15s ease-out;
  `;
  el.textContent = text;
  document.body.appendChild(el);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.transform = "translate(-50%,-50%) scale(1.15)";
      el.style.opacity   = "1";
    });
  });

  setTimeout(() => {
    el.style.transform = "translate(-50%,-60%) scale(1.0)";
    el.style.opacity   = "0";
    el.style.transition = `transform ${duration * 0.4}ms ease-in, opacity ${duration * 0.4}ms ease-in`;
  }, duration * 0.6);

  setTimeout(() => el.remove(), duration + 100);
}

function flashScreen(color = "#ffffff", duration = 250) {
  const el = document.createElement("div");
  el.style.cssText = `
    position:fixed;top:0;left:0;right:0;bottom:0;
    background:${color};opacity:0.5;
    pointer-events:none;z-index:9998;
    transition:opacity ${duration}ms ease-out;
  `;
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = "0"; }));
  setTimeout(() => el.remove(), duration + 50);
}

// ============================================================
// 14. UI 更新
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
  [0, 1].forEach(i => document.getElementById(`out${i}`).classList.toggle("filled", i < G.outs));
  [0, 1, 2].forEach(i => document.getElementById(`b${i}`).classList.toggle("on", i < G.balls));
  [0, 1].forEach(i => document.getElementById(`s${i}`).classList.toggle("on", i < G.strikes));
}

function updateBatterInfo() {
  const batter  = currentBatter();
  const pitcher = currentPitcher();
  document.getElementById("batter-name-display").textContent  = batter.name;
  document.getElementById("pitcher-name-display").textContent = pitcher.name;
  document.getElementById("batter-stats-display").textContent =
    `POW:${batter.pow} MEET:${batter.meet} SPD:${batter.spd}`;
}

// ============================================================
// 15. ゲームロジック
// ============================================================
function calcHitResult(batter, pitcher) {
  const strikeChance = 0.35 + pitcher.pitch / 400;
  const roll = Math.random();

  if (roll < (1 - strikeChance) * 0.5) return { type: "ball" };

  const lookChance = 0.18 + (100 - batter.meet) / 400;
  if (roll < lookChance) return { type: "strike_look" };

  const missChance = lookChance + 0.12 + (100 - batter.meet) / 500;
  if (roll < missChance) return { type: "strike_swing" };

  const contact  = (batter.meet + batter.pow) / 200;
  const pitchDef = pitcher.pitch / 100;
  const hitRoll  = Math.random();

  const hrChance = (batter.pow / 100) * 0.12 * (1 - pitchDef * 0.4);
  if (hitRoll < hrChance) return { type: "homerun" };

  const hitChance = contact * 0.55 * (1 - pitchDef * 0.3);
  if (hitRoll < hrChance + hitChance) {
    const r = Math.random();
    if (r < 0.08) return { type: "triple" };
    if (r < 0.28) return { type: "double" };
    return { type: "single" };
  }

  const r2 = Math.random();
  if (r2 < 0.4)  return { type: "grounder_out" };
  if (r2 < 0.75) return { type: "fly_out" };
  return { type: "liner_out" };
}

function addOut() {
  G.outs++;
  return G.outs >= 3;
}

function addScore(runs) {
  const t = attackTeam();
  t.totalRuns += runs;
  t.scores[G.inning - 1] = (t.scores[G.inning - 1] || 0) + runs;
  updateScoreboard();
}

function resetCount() { G.balls = 0; G.strikes = 0; }

function resetInning() {
  G.outs  = 0;
  G.bases = [false, false, false];
  resetCount();
}

function advanceRunners(bases) {
  let scored = 0;
  const nb = [false, false, false];
  if (G.bases[2]) { if (2 + bases >= 3) scored++; else nb[2 + bases] = true; }
  if (G.bases[1]) { if (1 + bases >= 3) scored++; else nb[1 + bases] = true; }
  if (G.bases[0]) { if (0 + bases >= 3) scored++; else nb[0 + bases] = true; }
  G.bases = nb;
  return scored;
}

// ============================================================
// 16. メインゲームフロー（共通）
// ============================================================
let actionBtnLocked = false;

// ============================================================
// [FIX 4/5] ピッチャーモード：プレイヤーが投球、CPUが打撃
// ============================================================
async function doPitcherMode() {
  if (actionBtnLocked || G.phase === "GAMEOVER") return;
  actionBtnLocked = true;
  document.getElementById("pitch-btn").disabled = true;

  G.phase = "PITCHING";
  say("pitch");

  // 1. 投球モーション（プレイヤー操作）
  await new Promise(res => animatePitch(res));
  await sleep(250);

  // 2. CPU判定
  const batter  = currentBatter();
  const pitcher = currentPitcher();
  const result  = calcHitResult(batter, pitcher);

  // 3. CPUスイング
  const isSwing = !["ball", "strike_look"].includes(result.type);
  await new Promise(res => animateSwing(isSwing, res));
  await sleep(350);

  // 4. 結果処理
  await handleResult(result);

  // 5. UI更新
  updateStatus();
  updateScoreboard();
  updateBatterInfo();
  drawScene();

  if (G.phase !== "GAMEOVER") {
    actionBtnLocked = false;
    document.getElementById("pitch-btn").disabled = false;
  }
}

// ============================================================
// [FIX 4/5] バッターモード：CPUが投球、プレイヤーがスイング操作
// ============================================================
async function doBatterMode() {
  if (actionBtnLocked || G.phase === "GAMEOVER") return;
  actionBtnLocked = true;

  const swingBtn = document.getElementById("swing-btn");
  if (swingBtn) swingBtn.disabled = true;

  G.phase = "PITCHING";
  say("pitch");

  // 1. CPU投球モーション
  await new Promise(res => animatePitch(res));
  await sleep(200);

  // 2. ボールが飛んでくる間にプレイヤーがスイングタイミングを決める
  swingReady = true;
  swingPressed = false;

  const batter  = currentBatter();
  const pitcher = currentPitcher();

  // ボールがホームベースに向かうアニメーション（この間にスイングボタンを押す）
  const ballTravelMs = 600 + Math.floor((100 - pitcher.pitch) * 3); // 速いピッチャーほど短い
  const swingWindowStart = ballTravelMs * 0.35; // スイング受付開始（35%〜75%）
  const swingWindowEnd   = ballTravelMs * 0.75;

  // ボール飛来アニメーション開始
  const ballPromise = new Promise(res => {
    let frame = 0;
    const totalFrames = Math.round(ballTravelMs / 16.7);

    const ballStartX = POS.mound.x;
    const ballStartY = POS.mound.y - 10;
    const ballEndX   = POS.home.x;
    const ballEndY   = POS.home.y - 8;

    anim.ball.visible = true;
    anim.ball.trail = [];
    anim.batter.state = "ready";

    function step() {
      frame++;
      const t = easeOut(clamp(frame / totalFrames, 0, 1));
      anim.ball.x = lerp(ballStartX, ballEndX, t);
      anim.ball.y = lerp(ballStartY, ballEndY, t) - Math.sin(t * Math.PI) * 8;
      anim.ball.trail.push({ x: anim.ball.x, y: anim.ball.y });
      if (anim.ball.trail.length > 8) anim.ball.trail.shift();

      // スイング受付ウィンドウ内でボタンが押されたらスイング
      const elapsed = (frame / totalFrames) * ballTravelMs;
      if (swingPressed && elapsed >= swingWindowStart && elapsed <= swingWindowEnd) {
        anim.batter.state = "swing";
        anim.batter.frame = Math.min(frame * 2, 16);
      } else if (swingPressed && elapsed > swingWindowEnd) {
        anim.batter.state = "miss";
      }

      drawScene();

      if (frame < totalFrames) {
        anim.rafId = requestAnimationFrame(step);
      } else {
        anim.ball.visible = false;
        anim.ball.trail = [];
        res();
      }
    }
    anim.rafId = requestAnimationFrame(step);
  });

  // ヒント表示
  say("batter_hint");
  if (swingBtn) swingBtn.disabled = false;

  await ballPromise;
  swingReady = false;
  if (swingBtn) swingBtn.disabled = true;

  await sleep(200);

  // 3. タイミング判定
  let result;
  if (!swingPressed) {
    // 見逃し
    const baseResult = calcHitResult(batter, pitcher);
    if (baseResult.type === "ball") {
      result = { type: "ball" };
    } else {
      result = { type: "strike_look" };
    }
  } else {
    // スイングあり → CPU判定ベースで少しタイミングボーナス
    const baseResult = calcHitResult(batter, pitcher);
    if (["ball"].includes(baseResult.type)) {
      // ボール球を振った
      result = { type: "strike_swing" };
    } else if (["strike_look"].includes(baseResult.type)) {
      // ストライクを振った → ミスになりやすいが少しチャンス
      result = Math.random() < 0.3 ? { type: "single" } : { type: "strike_swing" };
    } else {
      // 打てる球を振った → 結果はCPU判定そのまま（タイミング良ければ）
      result = baseResult;
    }
  }

  // 4. 結果処理
  await handleResult(result);

  // 5. UI更新
  updateStatus();
  updateScoreboard();
  updateBatterInfo();
  drawScene();

  if (G.phase !== "GAMEOVER") {
    actionBtnLocked = false;
    if (swingBtn) swingBtn.disabled = false;
  }
}

async function handleResult(result) {
  switch (result.type) {

    case "ball":
      G.balls++;
      if (G.balls >= 4) {
        say("walk");
        await sleep(600);
        let sc = 0;
        if (G.bases[2] && G.bases[1] && G.bases[0]) { sc = 1; G.bases[2] = false; }
        if (G.bases[1] && G.bases[0]) G.bases[2] = true;
        if (G.bases[0]) G.bases[1] = true;
        G.bases[0] = true;
        if (sc > 0) { addScore(sc); say("score", `${attackTeam().name} +${sc}点！`); await sleep(800); }
        resetCount();
        attackTeam().batterIdx++;
      } else {
        say("ball");
        await sleep(400);
      }
      break;

    case "strike_look":
      G.strikes++;
      if (G.strikes >= 3) {
        say("strikeout");
        showBigText("三振！！", "#cc2200", 1100);
        await sleep(700);
        anim.batter.state = "idle";
        if (addOut()) await doInningChange();
        else { resetCount(); attackTeam().batterIdx++; }
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
        showBigText("空振り三振！！", "#cc2200", 1100);
        await sleep(800);
        anim.batter.state = "idle";
        if (addOut()) await doInningChange();
        else { resetCount(); attackTeam().batterIdx++; }
      }
      break;

    case "grounder_out":
      say("grounder");
      await new Promise(res => animateBallFlight("grounder", res));
      await sleep(250);
      say("out_grounder");
      await sleep(500);
      anim.batter.state = "idle";
      if (addOut()) await doInningChange();
      else { resetCount(); attackTeam().batterIdx++; }
      break;

    case "fly_out":
      say("fly");
      await new Promise(res => animateBallFlight("fly", res));
      await sleep(250);
      say("out_fly");
      await sleep(500);
      anim.batter.state = "idle";
      if (addOut()) await doInningChange();
      else { resetCount(); attackTeam().batterIdx++; }
      break;

    case "liner_out":
      say("liner");
      await new Promise(res => animateBallFlight("liner", res));
      await sleep(250);
      say("out_fly");
      await sleep(500);
      anim.batter.state = "idle";
      if (addOut()) await doInningChange();
      else { resetCount(); attackTeam().batterIdx++; }
      break;

    case "single": {
      say("hit_single");
      flashScreen("#ffffff", 200);
      showBigText("ヒット！！", "#00ff88", 1000);
      attackTeam().hits++;
      await new Promise(res => animateBallFlight("hit", res));
      await sleep(200);
      const sc1 = advanceRunners(1);
      G.bases[0] = true;
      if (sc1 > 0) { say("score", `${attackTeam().name} +${sc1}点！`); addScore(sc1); await sleep(800); }
      resetCount();
      attackTeam().batterIdx++;
      break;
    }

    case "double": {
      say("hit_double");
      flashScreen("#ffffff", 200);
      showBigText("2ベース！！", "#00ff88", 1100);
      attackTeam().hits++;
      await new Promise(res => animateBallFlight("hit", res));
      await sleep(200);
      const sc2 = advanceRunners(2);
      G.bases[1] = true;
      if (sc2 > 0) { say("score", `${attackTeam().name} +${sc2}点！`); addScore(sc2); await sleep(800); }
      resetCount();
      attackTeam().batterIdx++;
      break;
    }

    case "triple": {
      say("hit_triple");
      flashScreen("#ffffff", 200);
      showBigText("3ベース！！！", "#00ff88", 1200);
      attackTeam().hits++;
      await new Promise(res => animateBallFlight("hit", res));
      await sleep(200);
      const sc3 = advanceRunners(3);
      G.bases[2] = true;
      if (sc3 > 0) { say("score", `${attackTeam().name} +${sc3}点！`); addScore(sc3); await sleep(800); }
      resetCount();
      attackTeam().batterIdx++;
      break;
    }

    case "homerun": {
      say("homerun");
      attackTeam().hits++;
      await new Promise(res => animateBallFlight("homerun", res));
      flashScreen("#ffdd00", 500);
      showBigText("⚾ HOME RUN !!", "#f5d800", 1800);
      await sleep(700);
      let runs = 1;
      if (G.bases[0]) runs++;
      if (G.bases[1]) runs++;
      if (G.bases[2]) runs++;
      G.bases = [false, false, false];
      addScore(runs);
      say("score", `${attackTeam().name} +${runs}点！ ホームラン！！`);
      await sleep(1300);
      resetCount();
      attackTeam().batterIdx++;
      break;
    }
  }
}

async function doInningChange() {
  say("inning_change");
  showBigText("チェンジ！", "#ffffff", 1000);
  await sleep(1000);
  resetInning();

  if (G.half === 0) {
    G.half = 1;
  } else {
    G.half = 0;
    G.inning++;
    if (G.inning > 9) { await endGame(); return; }
  }

  const halfStr = G.half === 0 ? "表" : "裏";
  document.getElementById("commentary-text").textContent = `${G.inning}回${halfStr}　開始！`;
  updateStatus();
  updateScoreboard();
  updateBatterInfo();
  drawScene();
  await sleep(600);
}

async function endGame() {
  G.phase = "GAMEOVER";
  document.getElementById("pitch-btn").disabled = true;
  const swingBtn = document.getElementById("swing-btn");
  if (swingBtn) swingBtn.disabled = true;

  const [t0, t1] = G.teams;
  let winner;
  if (t0.totalRuns > t1.totalRuns)      winner = t0.name;
  else if (t1.totalRuns > t0.totalRuns) winner = t1.name;
  else                                   winner = "引き分け";

  const msg = `${t0.name}  ${t0.totalRuns} - ${t1.totalRuns}  ${t1.name}`;
  await sleep(800);

  document.getElementById("game-screen").style.display = "none";
  const rs = document.getElementById("result-screen");
  rs.style.display = "flex";
  document.getElementById("result-title").textContent =
    winner === "引き分け" ? "引き分け！" : `${winner} の勝利！！`;
  document.getElementById("result-detail").innerHTML =
    `${msg}<br><br>${t0.name}　${t0.hits}安打<br>${t1.name}　${t1.hits}安打`;
}

// ============================================================
// 17. ゲーム初期化
// ============================================================
const TEAM_DEFS = [
  { name:"東京スターズ",           color:"#1a5fa8", uni:"#1a5fa8" },
  { name:"大阪タイガース",         color:"#cc2200", uni:"#cc2200" },
  { name:"横浜マリンズ",           color:"#007a9a", uni:"#007a9a" },
  { name:"名古屋ドラゴンズ",       color:"#1a7a1a", uni:"#1a7a1a" },
  { name:"福岡ホークス",           color:"#c87800", uni:"#c87800" },
  { name:"札幌ベアーズ",           color:"#4a1a8b", uni:"#4a1a8b" },
  { name:"広島カープス",           color:"#cc2244", uni:"#cc2244" },
  { name:"仙台イーグルス",         color:"#8b1a1a", uni:"#8b1a1a" },
  { name:"ニューヨーク・ヤンキース",color:"#1a1a3a", uni:"#1a1a3a" },
  { name:"ロサンゼルス・ドジャース",color:"#005fa8", uni:"#005fa8" },
];

function startGame(mode) {
  G.playerMode = mode || G.playerMode;

  const defs   = shuffle(TEAM_DEFS).slice(0, 2);
  G.teams  = defs.map(d => buildTeam(d.name, d.color, d.uni));
  G.inning = 1;
  G.half   = 0;
  G.outs   = 0;
  G.balls  = 0;
  G.strikes = 0;
  G.bases  = [false, false, false];
  G.phase  = "IDLE";
  G.gameStarted = true;

  G.teams.forEach(t => {
    t.scores    = Array(9).fill(null);
    t.totalRuns = 0;
    t.hits      = 0;
    t.batterIdx = 0;
  });

  anim.ball.visible    = false;
  anim.ball.trail      = [];
  anim.pitcher.state   = "idle";
  anim.batter.state    = "ready";
  anim.fielder.visible = false;

  // モードに応じてボタンを切り替え
  const pitchBtn = document.getElementById("pitch-btn");
  const swingBtn = document.getElementById("swing-btn");
  const modeLabel = document.getElementById("mode-label");

  if (G.playerMode === "pitcher") {
    pitchBtn.style.display = "inline-block";
    if (swingBtn) swingBtn.style.display = "none";
    if (modeLabel) modeLabel.textContent = "⚾ ピッチャーモード：ボタンを押して投球！";
  } else {
    pitchBtn.style.display = "none";
    if (swingBtn) swingBtn.style.display = "inline-block";
    if (modeLabel) modeLabel.textContent = "🏏 バッターモード：ボールが来たらスイング！";
  }

  pitchBtn.disabled = false;
  if (swingBtn) swingBtn.disabled = false;
  actionBtnLocked = false;

  document.getElementById("title-screen").style.display  = "none";
  document.getElementById("result-screen").style.display = "none";
  document.getElementById("game-screen").style.display   = "flex";

  updateScoreboard();
  updateStatus();
  updateBatterInfo();
  drawScene();

  document.getElementById("commentary-text").textContent =
    `⚾ プレイボール！\n${G.teams[0].name} vs ${G.teams[1].name}`;
}

// ============================================================
// 18. イベントリスナー
// ============================================================

// タイトル画面のモード選択ボタン
document.getElementById("start-pitcher-btn").addEventListener("click", () => startGame("pitcher"));
document.getElementById("start-batter-btn").addEventListener("click",  () => startGame("batter"));

// リトライ（前回のモードで再開）
document.getElementById("retry-btn").addEventListener("click", () => startGame(G.playerMode));

// ピッチャーモード：PITCHボタン
document.getElementById("pitch-btn").addEventListener("click", doPitcherMode);

// バッターモード：SWINGボタン
const swingBtnEl = document.getElementById("swing-btn");
if (swingBtnEl) {
  swingBtnEl.addEventListener("click", () => {
    if (swingReady) swingPressed = true;
    else if (!actionBtnLocked && G.gameStarted && G.phase !== "GAMEOVER") doBatterMode();
  });
}

// フィールドタップ
document.getElementById("field-canvas").addEventListener("click", () => {
  if (!G.gameStarted || G.phase === "GAMEOVER") return;
  if (G.playerMode === "pitcher" && !actionBtnLocked) doPitcherMode();
  else if (G.playerMode === "batter") {
    if (swingReady) swingPressed = true;
    else if (!actionBtnLocked) doBatterMode();
  }
});

// ============================================================
// 19. 初期描画
// ============================================================
(function init() {
  drawScene();
})();
