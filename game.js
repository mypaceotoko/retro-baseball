/* ===========================================================/*
   RETRO BASEBALL  –  game.js  v6.0
   改善内容:
   [v6.0] バッティング体験強化
     - CPU投球バリエーション（球速5段階×コース5種×重み付きランダム）
     - 直前3球履歴で同じ球が続かない仕組み
     - タイミング難易度：球速・コースでスイングウィンドウ動的変化
     - 投球前ヒント演出（「速い！」「低め！」など0.8秒表示）
     - コース別ボール軌道（X/Yオフセット）
     - Web Audio API SE（投球/スイング/ヒット/空振り/ホームラン歓声）
     - タイミング評価フィードバック（PERFECT / GOOD / MISS）
   [v5.0] 試合進行システム・ハイブリッド観戦+操作
   [v4.0] ピッチャー操作強化（コース×球速選択）
   [v3.0] ホームベース向き・バッター位置・色修正
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
  { name:"浜野 滋",              pow:82, meet:88, spd:85, pitch:78, def:83 },
];

// ============================================================
// 2. チーム定義
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
  { name:"ブリーズ",               color:"#00a878", uni:"#00a878" },
];

// ============================================================
// 3. ユーティリティ
// ============================================================
const rnd   = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick  = arr => arr[rnd(0, arr.length - 1)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp  = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 2);

// スキップ対応sleep：G.skipMode が true のときは最小待機
function sleep(ms) {
  return new Promise(r => setTimeout(r, G.skipMode ? Math.min(ms, 60) : ms));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============================================================
// 4. チーム生成
// ============================================================
function buildTeam(def) {
  const pool   = shuffle(PLAYER_POOL);
  const sorted = [...pool].sort((a, b) => b.pitch - a.pitch);
  const pitcher = sorted[0];
  const batters = pool.filter(p => p !== pitcher).slice(0, 8);
  return {
    name: def.name,
    color: def.color,
    uniformColor: def.uni,
    roster: [pitcher, ...batters],
    pitcher,
    batterIdx: 0,
    scores: Array(9).fill(null),
    totalRuns: 0,
    hits: 0,
  };
}

// ============================================================
// 5. ゲーム状態
// ============================================================
const G = {
  teams: [],
  inning: 1,
  half: 0,          // 0=表(チーム0攻撃), 1=裏(チーム1攻撃)
  outs: 0,
  balls: 0,
  strikes: 0,
  bases: [false, false, false],
  phase: "IDLE",
  gameStarted: false,

  // プレイヤー設定
  playerTeamIdx: 0,   // プレイヤーが選んだチームのインデックス
  playerRole: "pitcher", // "pitcher" | "batter"

  // スキップ制御
  skipMode: false,
  skipRequested: false,

  // 試合進行制御（Promiseのresolveを外から呼ぶ）
  playerActionResolve: null,
};

// 投球設定
const PITCH_CONFIG = {
  course: "center",
  speed:  "normal",
};

const COURSE_PARAMS = {
  inner:  { label:"内角",   xOffset:-38, yOffset:  0, hitPenalty:0.22, ballBonus:0.08, windowMult:0.80 },
  center: { label:"真ん中", xOffset:  0, yOffset:  0, hitPenalty:0.00, ballBonus:0.00, windowMult:1.00 },
  outer:  { label:"外角",   xOffset:+38, yOffset:  0, hitPenalty:0.20, ballBonus:0.08, windowMult:0.82 },
  high:   { label:"高め",   xOffset:  0, yOffset:-22, hitPenalty:0.18, ballBonus:0.06, windowMult:0.85 },
  low:    { label:"低め",   xOffset:  0, yOffset:+18, hitPenalty:0.16, ballBonus:0.10, windowMult:0.88 },
};

const SPEED_PARAMS = {
  veryslow: { label:"超遅い", kmh: 90, animFrames:34, hitBonus: 0.18, strikeBonus:-0.10, windowMult:1.30, trailLen: 4 },
  slow:     { label:"遅い",   kmh:110, animFrames:28, hitBonus: 0.12, strikeBonus:-0.06, windowMult:1.15, trailLen: 6 },
  normal:   { label:"普通",   kmh:140, animFrames:18, hitBonus: 0.00, strikeBonus: 0.00, windowMult:1.00, trailLen: 8 },
  fast:     { label:"速い",   kmh:158, animFrames:12, hitBonus:-0.14, strikeBonus: 0.08, windowMult:0.72, trailLen:12 },
  veryfast: { label:"剛速球", kmh:165, animFrames: 8, hitBonus:-0.22, strikeBonus: 0.14, windowMult:0.50, trailLen:16 },
};

// ============================================================
// SE エンジン（Web Audio API）
// ============================================================
const SE = (() => {
  let ctx = null;
  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function noise(duration, freq, type="square", vol=0.18, decay=0.9) {
    try {
      const ac = getCtx();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * decay, ac.currentTime + duration);
      gain.gain.setValueAtTime(vol, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
      osc.connect(gain); gain.connect(ac.destination);
      osc.start(); osc.stop(ac.currentTime + duration);
    } catch(e) {}
  }
  function burst(duration, vol=0.15) {
    try {
      const ac = getCtx();
      const buf = ac.createBuffer(1, ac.sampleRate * duration, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
      const src = ac.createBufferSource();
      const gain = ac.createGain();
      src.buffer = buf;
      gain.gain.setValueAtTime(vol, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
      src.connect(gain); gain.connect(ac.destination);
      src.start();
    } catch(e) {}
  }
  return {
    pitch()    { burst(0.06, 0.10); noise(0.08, 900, "sine", 0.08, 0.5); },
    swing()    { noise(0.12, 180, "sawtooth", 0.14, 0.4); burst(0.05, 0.06); },
    hit()      { noise(0.04, 1200, "sine", 0.30, 0.3); noise(0.15, 600, "triangle", 0.20, 0.6); },
    miss()     { noise(0.10, 220, "sawtooth", 0.08, 0.7); },
    foul()     { noise(0.06, 800, "sine", 0.15, 0.5); noise(0.08, 400, "triangle", 0.10, 0.6); },
    homerun()  { noise(0.05, 1400, "sine", 0.35, 0.2); noise(0.20, 700, "triangle", 0.25, 0.5); burst(0.30, 0.18); },
    crowd()    { burst(0.60, 0.12); },
    strike()   { noise(0.08, 500, "square", 0.10, 0.8); },
    ball_se()  { noise(0.06, 300, "sine", 0.08, 0.9); },
  };
})();

// ============================================================
// CPU投球パターン生成（バッターモード用）
// ============================================================
const CPU_PITCH_HISTORY = [];

const CPU_PITCH_WEIGHTS = [
  { speed:"normal",   course:"center",  w:20 },
  { speed:"fast",     course:"inner",   w:14 },
  { speed:"fast",     course:"outer",   w:14 },
  { speed:"normal",   course:"inner",   w:12 },
  { speed:"normal",   course:"outer",   w:12 },
  { speed:"slow",     course:"center",  w:10 },
  { speed:"fast",     course:"center",  w: 8 },
  { speed:"normal",   course:"low",     w: 8 },
  { speed:"normal",   course:"high",    w: 6 },
  { speed:"veryfast", course:"inner",   w: 5 },
  { speed:"veryfast", course:"outer",   w: 5 },
  { speed:"slow",     course:"low",     w: 5 },
  { speed:"veryslow", course:"center",  w: 4 },
  { speed:"veryfast", course:"center",  w: 3 },
  { speed:"veryslow", course:"outer",   w: 3 },
  { speed:"slow",     course:"inner",   w: 3 },
  { speed:"slow",     course:"high",    w: 2 },
];

function generateCpuPitch(pitcher) {
  // 直前3球の履歴で同じ球が続かないよう重みを調整
  let weights = CPU_PITCH_WEIGHTS.map(p => ({
    ...p,
    w: p.w * (pitcher.pitch / 80),  // 投手能力で球種の精度が変わる
  }));
  // 直前3球と同じ組み合わせはペナルティ
  const recent = CPU_PITCH_HISTORY.slice(-3);
  weights = weights.map(p => {
    const sameCount = recent.filter(r => r.speed === p.speed && r.course === p.course).length;
    return { ...p, w: p.w * Math.pow(0.2, sameCount) };
  });
  // 重み付きランダム選択
  const total = weights.reduce((s, p) => s + p.w, 0);
  let r = Math.random() * total;
  for (const p of weights) { r -= p.w; if (r <= 0) { CPU_PITCH_HISTORY.push(p); if (CPU_PITCH_HISTORY.length > 10) CPU_PITCH_HISTORY.shift(); return p; } }
  const fallback = weights[0];
  CPU_PITCH_HISTORY.push(fallback);
  return fallback;
}

// タイミング評価
function evalTiming(elapsed, windowStart, windowEnd) {
  const center = (windowStart + windowEnd) / 2;
  const half   = (windowEnd - windowStart) / 2;
  const dist   = Math.abs(elapsed - center);
  if (dist < half * 0.30) return "PERFECT";
  if (dist < half * 0.70) return "GOOD";
  return "LATE";
}

const attackTeam  = () => G.teams[G.half];
const defenseTeam = () => G.teams[1 - G.half];
const currentBatter  = () => { const t = attackTeam();  return t.roster[t.batterIdx % t.roster.length]; };
const currentPitcher = () => defenseTeam().pitcher;

// プレイヤーが今操作すべきターンかを判定
function isPlayerTurn() {
  if (G.playerRole === "pitcher") {
    // ピッチャー：自チームが守備中（= 相手チームが攻撃中）
    return (1 - G.half) === G.playerTeamIdx;
  } else {
    // バッター：自チームが攻撃中
    return G.half === G.playerTeamIdx;
  }
}

// ============================================================
// 6. Canvas セットアップ
// ============================================================
const canvas = document.getElementById("field-canvas");
const ctx    = canvas.getContext("2d");
const CW = canvas.width;
const CH = canvas.height;

const POS = {
  mound:   { x: CW * 0.50, y: CH * 0.52 },
  home:    { x: CW * 0.50, y: CH * 0.87 },
  batter:  { x: CW * 0.50 - 30, y: CH * 0.87 },
  base1:   { x: CW * 0.74, y: CH * 0.62 },
  base2:   { x: CW * 0.50, y: CH * 0.36 },
  base3:   { x: CW * 0.26, y: CH * 0.62 },
  outfield:{ x: CW * 0.50, y: CH * 0.04 },
};

// ============================================================
// 7. アニメーション状態
// ============================================================
let anim = {
  ball:    { x: 0, y: 0, visible: false, r: 7, trail: [] },
  pitcher: { state: "idle", frame: 0 },
  batter:  { state: "idle", frame: 0 },
  fielder: { x: 0, y: 0, tx: 0, ty: 0, visible: false },
  flash:   { active: false, color: "#fff", alpha: 0 },
  rafId:   null,
};

let swingReady   = false;
let swingPressed = false;

// ============================================================
// 8. キャラクター描画
// ============================================================
function drawPitcherChar(cx, cy, state, frame, teamColor) {
  ctx.save();
  ctx.translate(cx, cy);
  const t = frame / 20;
  let armAngle = 0.3, legSpread = 0;
  if (state === "windup") {
    armAngle = -Math.PI * 0.8 - Math.sin(t * Math.PI) * 0.4;
    legSpread = Math.sin(t * Math.PI) * 8;
  } else if (state === "release") {
    const rt = clamp(frame / 12, 0, 1);
    armAngle = -Math.PI * 0.8 + rt * Math.PI * 1.5;
    legSpread = 10;
  }
  ctx.fillStyle = "#222";
  ctx.fillRect(-6, 28, 8, 10);
  ctx.fillRect(4 + legSpread, 28, 8, 10);
  ctx.fillStyle = teamColor;
  ctx.fillRect(-10, 4, 20, 26);
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect(-2, 4, 4, 26);
  ctx.fillStyle = "#f5c090";
  ctx.beginPath(); ctx.arc(0, -6, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = teamColor;
  ctx.beginPath(); ctx.ellipse(0, -10, 13, 6, 0, Math.PI, 0); ctx.fill();
  ctx.fillRect(-13, -14, 26, 7);
  ctx.fillRect(-16, -8, 32, 4);
  ctx.save();
  ctx.translate(10, 10); ctx.rotate(armAngle);
  ctx.fillStyle = "#f5c090"; ctx.fillRect(-4, 0, 8, 22);
  if (state !== "release" || frame < 8) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(0, 24, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#cc0000"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 24, 5, 0.3, 1.2); ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.translate(-10, 10); ctx.rotate(0.4);
  ctx.fillStyle = "#f5c090"; ctx.fillRect(-4, 0, 8, 18);
  ctx.fillStyle = "#8B4513";
  ctx.beginPath(); ctx.arc(0, 20, 7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawBatterChar(cx, cy, state, frame, teamColor) {
  ctx.save();
  ctx.translate(cx, cy);
  let batAngle = -0.3, batLength = 38, bodyLean = 0;
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
  ctx.fillStyle = "#222";
  ctx.fillRect(-14, 28, 9, 10); ctx.fillRect(2, 28, 9, 10);
  ctx.save(); ctx.rotate(bodyLean);
  ctx.fillStyle = teamColor; ctx.fillRect(-10, 4, 20, 26);
  ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.fillRect(-2, 4, 4, 26);
  ctx.restore();
  ctx.fillStyle = "#f5c090";
  ctx.beginPath(); ctx.arc(0, -6, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = teamColor;
  ctx.beginPath(); ctx.arc(0, -10, 13, Math.PI, 0); ctx.fill();
  ctx.fillRect(-13, -12, 26, 6); ctx.fillRect(-20, -8, 16, 4);
  ctx.save();
  ctx.translate(10, 8); ctx.rotate(batAngle);
  ctx.fillStyle = "#8B4513"; ctx.fillRect(-3, 0, 6, batLength * 0.35);
  ctx.fillStyle = "#D2691E";
  ctx.beginPath();
  ctx.moveTo(-3, batLength * 0.3); ctx.lineTo(3, batLength * 0.3);
  ctx.lineTo(6, batLength); ctx.lineTo(-6, batLength); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.fillRect(-1, batLength * 0.3, 2, batLength * 0.6);
  ctx.restore();
  ctx.save();
  ctx.translate(10, 8); ctx.rotate(batAngle - 0.2);
  ctx.fillStyle = "#f5c090"; ctx.fillRect(-4, 0, 8, 16);
  ctx.restore();
  ctx.restore();
}

function drawFielderChar(fx, fy, teamColor) {
  ctx.save(); ctx.translate(fx, fy); ctx.scale(0.75, 0.75);
  ctx.fillStyle = "#222"; ctx.fillRect(-5, 22, 6, 8); ctx.fillRect(3, 22, 6, 8);
  ctx.fillStyle = teamColor; ctx.fillRect(-8, 3, 16, 20);
  ctx.fillStyle = "#f5c090";
  ctx.beginPath(); ctx.arc(0, -5, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = teamColor;
  ctx.beginPath(); ctx.ellipse(0, -8, 11, 5, 0, Math.PI, 0); ctx.fill();
  ctx.fillRect(-11, -11, 22, 5); ctx.fillRect(-14, -7, 28, 3);
  ctx.fillStyle = "#8B4513";
  ctx.beginPath(); ctx.arc(-12, -2, 8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawRunnerChar(rx, ry, teamColor) {
  ctx.save(); ctx.translate(rx, ry); ctx.scale(0.65, 0.65);
  ctx.fillStyle = "#222"; ctx.fillRect(-4, 20, 5, 7); ctx.fillRect(3, 20, 5, 7);
  ctx.fillStyle = teamColor; ctx.fillRect(-7, 2, 14, 18);
  ctx.fillStyle = "#f5c090";
  ctx.beginPath(); ctx.arc(0, -4, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = teamColor;
  ctx.beginPath(); ctx.ellipse(0, -7, 10, 4, 0, Math.PI, 0); ctx.fill();
  ctx.fillRect(-10, -9, 20, 4);
  ctx.restore();
}

// ============================================================
// 9. フィールド描画
// ============================================================
function drawField() {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, CH * 0.4);
  skyGrad.addColorStop(0, "#1a3a6a"); skyGrad.addColorStop(1, "#2a5a9a");
  ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, CW, CH * 0.4);

  ctx.fillStyle = "#3a2a1a"; ctx.fillRect(0, CH * 0.28, CW, CH * 0.15);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 24; col++) {
      const colors = ["#cc4444","#4444cc","#44cc44","#cccc44","#cc44cc","#44cccc"];
      ctx.fillStyle = colors[(row * 7 + col) % colors.length];
      ctx.beginPath();
      ctx.arc(col * (CW / 23) + rnd(-2, 2), CH * 0.30 + row * 10, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (let i = 6; i >= 0; i--) {
    ctx.fillStyle = i % 2 === 0 ? "#1a5a1a" : "#226622";
    ctx.beginPath();
    ctx.ellipse(CW * 0.5, CH * 0.75, CW * 0.48 - i * 12, CH * 0.38 - i * 8, 0, Math.PI, 0);
    ctx.fill();
  }

  ctx.fillStyle = "#8B6340";
  ctx.beginPath();
  ctx.moveTo(POS.home.x, POS.home.y);
  ctx.lineTo(POS.base1.x, POS.base1.y);
  ctx.lineTo(POS.base2.x, POS.base2.y);
  ctx.lineTo(POS.base3.x, POS.base3.y);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = "#1e5a1e";
  ctx.beginPath();
  ctx.moveTo(POS.home.x, POS.home.y - 10);
  ctx.lineTo(POS.base1.x - 10, POS.base1.y);
  ctx.lineTo(POS.base2.x, POS.base2.y + 10);
  ctx.lineTo(POS.base3.x + 10, POS.base3.y);
  ctx.closePath(); ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(POS.home.x, POS.home.y); ctx.lineTo(CW * 0.02, CH * 0.05);
  ctx.moveTo(POS.home.x, POS.home.y); ctx.lineTo(CW * 0.98, CH * 0.05);
  ctx.stroke(); ctx.setLineDash([]);

  const moundGrad = ctx.createRadialGradient(POS.mound.x, POS.mound.y, 0, POS.mound.x, POS.mound.y, 18);
  moundGrad.addColorStop(0, "#a07848"); moundGrad.addColorStop(1, "#8B6340");
  ctx.fillStyle = moundGrad;
  ctx.beginPath(); ctx.ellipse(POS.mound.x, POS.mound.y + 4, 18, 10, 0, 0, Math.PI * 2); ctx.fill();

  const hx = POS.home.x, hy = POS.home.y, hw = 10, hh = 8;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(hx - hw, hy - hh); ctx.lineTo(hx + hw, hy - hh);
  ctx.lineTo(hx + hw, hy); ctx.lineTo(hx, hy + hh); ctx.lineTo(hx - hw, hy);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#aaaaaa"; ctx.lineWidth = 1; ctx.stroke();

  const bases = [POS.base1, POS.base2, POS.base3];
  bases.forEach((pos, i) => {
    ctx.save(); ctx.translate(pos.x, pos.y); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = G.bases[i] ? "#ffdd00" : "#ffffff";
    ctx.fillRect(-8, -8, 16, 16);
    ctx.strokeStyle = "#ccaa00"; ctx.lineWidth = 1; ctx.strokeRect(-8, -8, 16, 16);
    ctx.restore();
  });

  ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1.5;
  ctx.strokeRect(POS.home.x - 50, POS.home.y - 28, 30, 44);
  ctx.strokeRect(POS.home.x + 20, POS.home.y - 28, 30, 44);

  // ストライクゾーン照準（ピッチャーモード・自分の守備番のみ）
  if (G.gameStarted && G.playerRole === "pitcher" && isPlayerTurn() && G.phase === "IDLE") {
    drawStrikeZoneAim();
  }
}

function drawStrikeZoneAim() {
  const cp = COURSE_PARAMS[PITCH_CONFIG.course];
  const zx = POS.home.x + cp.xOffset, zy = POS.home.y - 18;
  const zw = 18, zh = 22;
  ctx.strokeStyle = "rgba(68,136,255,0.7)"; ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]); ctx.strokeRect(zx - zw / 2, zy - zh / 2, zw, zh); ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(68,136,255,0.9)"; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(zx - 10, zy); ctx.lineTo(zx + 10, zy);
  ctx.moveTo(zx, zy - 10); ctx.lineTo(zx, zy + 10);
  ctx.stroke();
  const speedColors = { slow:"#44cc88", normal:"#ffcc00", fast:"#ff4444" };
  ctx.fillStyle = speedColors[PITCH_CONFIG.speed];
  ctx.beginPath(); ctx.arc(zx, zy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke();
}

// ============================================================
// 10. ボール描画
// ============================================================
function drawBall() {
  if (!anim.ball.visible) return;
  const bx = anim.ball.x, by = anim.ball.y, br = anim.ball.r;
  anim.ball.trail.forEach((pt, i) => {
    const alpha = (i / anim.ball.trail.length) * 0.5;
    const r = br * (i / anim.ball.trail.length) * 0.8;
    ctx.fillStyle = `rgba(255,255,200,${alpha})`;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2); ctx.fill();
  });
  const ballGrad = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, br);
  ballGrad.addColorStop(0, "#ffffff"); ballGrad.addColorStop(0.7, "#eeeeee"); ballGrad.addColorStop(1, "#cccccc");
  ctx.fillStyle = ballGrad;
  ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#cc2222"; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(bx - 1, by, br * 0.7, -0.5, 0.5); ctx.stroke();
  ctx.beginPath(); ctx.arc(bx + 1, by, br * 0.7, Math.PI - 0.5, Math.PI + 0.5); ctx.stroke();
}

// ============================================================
// 11. メインシーン描画
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
  if (anim.fielder.visible) drawFielderChar(anim.fielder.x, anim.fielder.y, defenseTeam().uniformColor);
  drawPitcherChar(POS.mound.x, POS.mound.y - 20, anim.pitcher.state, anim.pitcher.frame, defenseTeam().uniformColor);
  drawBatterChar(POS.batter.x, POS.batter.y - 30, anim.batter.state, anim.batter.frame, attackTeam().uniformColor);
  drawBall();
  if (anim.flash.active && anim.flash.alpha > 0) {
    ctx.fillStyle = anim.flash.color; ctx.globalAlpha = anim.flash.alpha;
    ctx.fillRect(0, 0, CW, CH); ctx.globalAlpha = 1;
  }
}

// ============================================================
// 12. アニメーション関数
// ============================================================
function animatePitch(onDone) {
  let frame = 0;
  const windupFrames = G.skipMode ? 8 : 22;
  const releaseFrames = G.skipMode ? 5 : 14;
  const total = windupFrames + releaseFrames;
  anim.ball.visible = false;
  function step() {
    frame++;
    if (frame <= windupFrames) { anim.pitcher.state = "windup"; anim.pitcher.frame = frame; }
    else { anim.pitcher.state = "release"; anim.pitcher.frame = frame - windupFrames; }
    drawScene();
    if (frame < total) anim.rafId = requestAnimationFrame(step);
    else { anim.pitcher.state = "idle"; if (onDone) onDone(); }
  }
  anim.rafId = requestAnimationFrame(step);
}

function animateSwing(doSwing, onDone, courseOffset) {
  let frame = 0;
  const sp = SPEED_PARAMS[PITCH_CONFIG.speed];
  const baseFr = G.skipMode ? 6 : sp.animFrames;
  const total = doSwing ? Math.max(baseFr, 6) : Math.max(baseFr - 4, 5);
  anim.batter.state = doSwing ? "swing" : "ready";
  anim.batter.frame = 0;
  const ballStartX = POS.mound.x, ballStartY = POS.mound.y - 10;
  const ballEndX = POS.home.x + (courseOffset || 0), ballEndY = POS.home.y - 8;
  anim.ball.visible = true; anim.ball.trail = [];
  function step() {
    frame++;
    const t = easeOut(clamp(frame / total, 0, 1));
    anim.ball.x = lerp(ballStartX, ballEndX, t);
    anim.ball.y = lerp(ballStartY, ballEndY, t) - Math.sin(t * Math.PI) * 8;
    anim.ball.trail.push({ x: anim.ball.x, y: anim.ball.y });
    if (anim.ball.trail.length > 8) anim.ball.trail.shift();
    if (doSwing) { anim.batter.state = "swing"; anim.batter.frame = frame; }
    drawScene();
    if (frame < total) anim.rafId = requestAnimationFrame(step);
    else { if (!doSwing) anim.ball.visible = false; anim.ball.trail = []; if (onDone) onDone(); }
  }
  anim.rafId = requestAnimationFrame(step);
}

function animateBallFlight(type, onDone) {
  let frame = 0;
  let total, targetX, targetY, peakY;
  let fielderSX = POS.mound.x + rnd(-70, 70), fielderSY = POS.mound.y + rnd(-30, 20);
  let fielderTX, fielderTY;
  const startX = POS.home.x, startY = POS.home.y - 8;

  if (G.skipMode) {
    // スキップ時は即完了
    anim.ball.visible = false; anim.ball.trail = []; anim.fielder.visible = false;
    if (onDone) onDone(); return;
  }

  switch (type) {
    case "grounder": total=40; targetX=CW*0.5+rnd(-90,90); targetY=POS.mound.y+rnd(10,30); peakY=startY; fielderTX=targetX; fielderTY=targetY; break;
    case "fly":      total=60; targetX=CW*0.5+rnd(-110,110); targetY=CH*0.42; peakY=CH*0.12; fielderTX=targetX+rnd(-20,20); fielderTY=targetY+10; break;
    case "liner":    total=25; targetX=CW*0.5+rnd(-130,130); targetY=CH*0.45; peakY=startY-15; fielderTX=targetX; fielderTY=targetY; break;
    case "hit":      total=65; targetX=CW*0.5+rnd(-150,150); targetY=CH*0.16; peakY=CH*0.06; fielderTX=targetX+rnd(-30,30); fielderTY=targetY+20; break;
    case "homerun":  total=80; targetX=CW*0.5+rnd(-100,100); targetY=-50; peakY=-80; fielderTX=targetX; fielderTY=CH*0.08; break;
  }

  anim.fielder.x=fielderSX; anim.fielder.y=fielderSY; anim.fielder.tx=fielderTX; anim.fielder.ty=fielderTY;
  anim.fielder.visible=(type!=="homerun");
  anim.ball.visible=true; anim.ball.trail=[]; anim.ball.r=(type==="homerun"?9:7);

  function step() {
    frame++;
    const t = clamp(frame / total, 0, 1);
    anim.ball.x = lerp(startX, targetX, t);
    const baseY = lerp(startY, targetY, t);
    if (type==="grounder") anim.ball.y = baseY - Math.abs(Math.sin(t*Math.PI*3.5))*28*(1-t);
    else if (type==="liner") anim.ball.y = baseY - Math.sin(t*Math.PI)*18;
    else anim.ball.y = baseY - Math.sin(t*Math.PI)*Math.abs(startY-peakY)*1.1;
    anim.ball.trail.push({x:anim.ball.x,y:anim.ball.y});
    if (anim.ball.trail.length>14) anim.ball.trail.shift();
    if (anim.fielder.visible && frame>total*0.25) {
      const ft = easeOut(clamp((frame-total*0.25)/(total*0.75),0,1));
      anim.fielder.x=lerp(fielderSX,fielderTX,ft); anim.fielder.y=lerp(fielderSY,fielderTY,ft);
    }
    if (type==="homerun" && anim.ball.y<0) { anim.flash.active=true; anim.flash.color="rgba(255,220,0,0.6)"; anim.flash.alpha=0.6; }
    drawScene();
    if (frame<total) anim.rafId=requestAnimationFrame(step);
    else { anim.ball.visible=false; anim.ball.trail=[]; anim.ball.r=7; anim.fielder.visible=false; anim.flash.active=false; anim.flash.alpha=0; if(onDone)onDone(); }
  }
  anim.rafId = requestAnimationFrame(step);
}

function animateRunners(moves, onDone) {
  if (!moves || moves.length === 0) { if (onDone) onDone(); return; }
  if (G.skipMode) { if (onDone) onDone(); return; }
  let frame = 0;
  const total = 45;
  const posArr = [POS.base1, POS.base2, POS.base3, POS.home];
  const runners = moves.map(mv => ({ from:posArr[mv.from], to:posArr[mv.to>=0?mv.to:3], color:attackTeam().uniformColor }));
  function step() {
    frame++;
    const t = easeOut(clamp(frame/total,0,1));
    drawScene();
    runners.forEach(r => {
      const rx=lerp(r.from.x,r.to.x,t), ry=lerp(r.from.y,r.to.y,t)-Math.sin(t*Math.PI)*12;
      drawRunnerChar(rx,ry-20,r.color);
    });
    if (frame<total) anim.rafId=requestAnimationFrame(step);
    else { if(onDone)onDone(); }
  }
  anim.rafId = requestAnimationFrame(step);
}

// ============================================================
// 13. 実況テキスト
// ============================================================
const COMMENTARY = {
  pitch:         ["さあ、投げた！","ピッチャー振りかぶって…","第一球！","投げた！"],
  pitch_inner:   ["内角攻め！","インコース！","内角へ！"],
  pitch_outer:   ["外角へ！","アウトコース！","外に逃げる！"],
  pitch_fast:    ["速い！","剛速球！！","火の玉ストレート！！"],
  pitch_slow:    ["緩い球！","チェンジアップ気味！","タイミングを外した！"],
  ball:          ["ボール！","外れてボール。","ボール、低め。","ボールです。"],
  strike:        ["ストライク！","見逃しストライク！","ストライクゾーンを通過！"],
  strikeout:     ["三振！！","見逃し三振！！","空振り三振！！","バッターアウト！！"],
  grounder:      ["ゴロ！　内野へ転がる！","ゴロゴロ…内野ゴロ！","転がった！"],
  fly:           ["高く上がった！　フライ！","大きなフライ！","打ち上げた！"],
  liner:         ["ライナー！　鋭い打球！","ビュン！ライナー性の当たり！"],
  hit_single:    ["ヒット！！","カキーン！ヒット！！","いい当たり！ヒット！！"],
  hit_double:    ["ツーベース！！","長打！！ツーベースヒット！！"],
  hit_triple:    ["スリーベース！！！","三塁打！！！"],
  homerun:       ["入ったーー！！ホームラン！！！","場外弾！！ホームラン！！！","スタンドイン！！！"],
  out_fly:       ["アウト！　フライをキャッチ！","捕った！アウト！"],
  out_grounder:  ["ゴロアウト！","一塁送球、アウト！"],
  score:         ["得点！！","ホームイン！！","スコアが動いた！！"],
  inning_change: ["チェンジ！","攻守交代！","スリーアウト！チェンジ！！"],
  walk:          ["フォアボール！！","四球！！バッターは一塁へ。"],
  swing_miss:    ["空振り！","バットが空を切った！","ミス！"],
  batter_hint:   ["タイミングを合わせて！","ボールが来たらスイング！"],
  your_turn_p:   ["あなたの番！コースと球速を選んで投げよう！","ピッチャー、あなたが投げます！"],
  your_turn_b:   ["あなたの打席！タイミングよくスイング！","バッター、あなたが打ちます！"],
  auto_play:     ["自動進行中…","CPUが対戦中…"],
};

function say(key, extra = "") {
  const lines = COMMENTARY[key];
  const text  = lines ? pick(lines) : key;
  document.getElementById("commentary-text").textContent = text + (extra ? "  " + extra : "");
}

function sayPitchComment() {
  const sp = SPEED_PARAMS[PITCH_CONFIG.speed];
  let text = pick(COMMENTARY.pitch);
  if (PITCH_CONFIG.speed === "fast")        text = pick(COMMENTARY.pitch_fast);
  else if (PITCH_CONFIG.speed === "slow")   text = pick(COMMENTARY.pitch_slow);
  else if (PITCH_CONFIG.course === "inner") text = pick(COMMENTARY.pitch_inner);
  else if (PITCH_CONFIG.course === "outer") text = pick(COMMENTARY.pitch_outer);
  document.getElementById("commentary-text").textContent = `${text}  ${sp.kmh}km/h`;
}

// ============================================================
// 14. 大テキスト・フラッシュ演出
// ============================================================
function showBigText(text, color = "#f5d800", duration = 1400) {
  if (G.skipMode) return; // スキップ中は演出なし
  const el = document.createElement("div");
  el.style.cssText = `
    position:fixed;top:40%;left:50%;
    transform:translate(-50%,-50%) scale(0.5);
    font-family:'Press Start 2P',monospace;
    font-size:clamp(20px,6vw,38px);
    color:${color};
    text-shadow:4px 4px 0 #000,8px 8px 0 rgba(0,0,0,0.4);
    pointer-events:none;z-index:10000;
    white-space:nowrap;opacity:0;
    transition:transform 0.15s ease-out,opacity 0.15s ease-out;
  `;
  el.textContent = text;
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.transform = "translate(-50%,-50%) scale(1.15)";
    el.style.opacity   = "1";
  }));
  setTimeout(() => {
    el.style.transform = "translate(-50%,-60%) scale(1.0)";
    el.style.opacity   = "0";
    el.style.transition = `transform ${duration*0.4}ms ease-in,opacity ${duration*0.4}ms ease-in`;
  }, duration * 0.6);
  setTimeout(() => el.remove(), duration + 100);
}

function flashScreen(color = "#ffffff", duration = 250) {
  if (G.skipMode) return;
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
// 15. UI 更新
// ============================================================
function updateScoreboard() {
  const tbody = document.getElementById("score-body");
  tbody.innerHTML = "";
  G.teams.forEach((team, ti) => {
    const tr = document.createElement("tr");
    const isPlayerTeam = ti === G.playerTeamIdx;
    let html = `<td class="team-name${isPlayerTeam?' player-team':''}">${isPlayerTeam?'★ ':''  }${team.name}</td>`;
    for (let i = 0; i < 9; i++) {
      const isActive = (G.inning - 1 === i && G.half === ti);
      const score = team.scores[i];
      html += `<td class="${isActive?"active-inning":""}">${score!==null?score:(isActive?"▶":"-")}</td>`;
    }
    html += `<td class="score-total">${team.totalRuns}</td>`;
    tr.innerHTML = html;
    tbody.appendChild(tr);
  });
}

function updateStatus() {
  const halfStr = G.half === 0 ? "表" : "裏";
  document.getElementById("inning-display").textContent = `${G.inning}回${halfStr}`;
  [0,1].forEach(i => document.getElementById(`out${i}`).classList.toggle("filled", i < G.outs));
  [0,1,2].forEach(i => document.getElementById(`b${i}`).classList.toggle("on", i < G.balls));
  [0,1].forEach(i => document.getElementById(`s${i}`).classList.toggle("on", i < G.strikes));
}

function updateBatterInfo() {
  const batter  = currentBatter();
  const pitcher = currentPitcher();
  document.getElementById("batter-name-display").textContent  = batter.name;
  document.getElementById("pitcher-name-display").textContent = pitcher.name;
  document.getElementById("batter-stats-display").textContent =
    `POW:${batter.pow} MEET:${batter.meet} SPD:${batter.spd}`;
}

function updatePitcherPanel() {
  document.querySelectorAll("#course-btns .sel-btn").forEach(btn => {
    btn.classList.toggle("selected-course", btn.dataset.course === PITCH_CONFIG.course);
  });
  ["inner","center","outer"].forEach(c => {
    const el = document.getElementById(`zone-${c}`);
    if (el) el.classList.toggle("zone-active", c === PITCH_CONFIG.course);
  });
  document.querySelectorAll("#speed-btns .sel-btn").forEach(btn => {
    btn.classList.toggle("selected-speed", btn.dataset.speed === PITCH_CONFIG.speed);
  });
  const sp = SPEED_PARAMS[PITCH_CONFIG.speed];
  const bar1=document.getElementById("speed-bar1"), bar2=document.getElementById("speed-bar2"), bar3=document.getElementById("speed-bar3");
  const speedVal=document.getElementById("speed-value");
  [bar1,bar2,bar3].forEach(b => b.classList.remove("active-slow","active-normal","active-fast"));
  if (PITCH_CONFIG.speed==="slow")   { bar1.classList.add("active-slow");   speedVal.textContent=`${sp.kmh}km/h`; speedVal.style.color="#44cc88"; }
  else if (PITCH_CONFIG.speed==="normal") { bar1.classList.add("active-normal"); bar2.classList.add("active-normal"); speedVal.textContent=`${sp.kmh}km/h`; speedVal.style.color="#ffcc00"; }
  else { bar1.classList.add("active-fast"); bar2.classList.add("active-fast"); bar3.classList.add("active-fast"); speedVal.textContent=`${sp.kmh}km/h`; speedVal.style.color="#ff4444"; }
  drawScene();
}

// プレイヤー操作UIの表示切り替え
function showPlayerUI(show) {
  const pitcherPanel = document.getElementById("pitcher-panel");
  const pitchBtn     = document.getElementById("pitch-btn");
  const swingBtn     = document.getElementById("swing-btn");
  const modeLabel    = document.getElementById("mode-label");
  const banner       = document.getElementById("player-turn-banner");
  const skipBtn      = document.getElementById("skip-btn");

  if (show && isPlayerTurn()) {
    banner.style.display = "block";
    skipBtn.disabled = true;
    skipBtn.classList.remove("skipping");

    if (G.playerRole === "pitcher") {
      pitcherPanel.style.display = "flex";
      pitchBtn.style.display = "inline-block";
      pitchBtn.disabled = false;
      swingBtn.style.display = "none";
      if (modeLabel) modeLabel.textContent = "コース・球速を選んで ⚾ PITCH ！";
      updatePitcherPanel();
    } else {
      pitcherPanel.style.display = "none";
      pitchBtn.style.display = "none";
      swingBtn.style.display = "inline-block";
      swingBtn.disabled = false;
      if (modeLabel) modeLabel.textContent = "🏏 ボールが来たらスイング！";
    }
  } else {
    banner.style.display = "none";
    pitcherPanel.style.display = "none";
    pitchBtn.style.display = "none";
    swingBtn.style.display = "none";
    if (modeLabel) modeLabel.textContent = G.skipMode ? "⏩ スキップ中…" : "観戦中…";
    skipBtn.disabled = (G.phase === "GAMEOVER");
  }
}

// ============================================================
// 16. ゲームロジック
// ============================================================
function calcHitResult(batter, pitcher, course, speed) {
  const cp = COURSE_PARAMS[course || "center"];
  const sp = SPEED_PARAMS[speed  || "normal"];
  const baseStrikeChance = 0.35 + pitcher.pitch / 400 + sp.strikeBonus;
  const roll = Math.random();
  const ballThreshold = (1 - baseStrikeChance) * 0.5 + cp.ballBonus;
  if (roll < ballThreshold) return { type: "ball" };
  const lookChance = ballThreshold + 0.18 + (100 - batter.meet) / 400;
  if (roll < lookChance) return { type: "strike_look" };
  const missChance = lookChance + 0.12 + (100 - batter.meet) / 500 + (sp.hitBonus < 0 ? Math.abs(sp.hitBonus) * 0.3 : 0);
  if (roll < missChance) return { type: "strike_swing" };
  const contact  = (batter.meet + batter.pow) / 200;
  const pitchDef = pitcher.pitch / 100;
  const coursePenalty = cp.hitPenalty, speedBonus = sp.hitBonus;
  const hitRoll = Math.random();
  const hrChance  = (batter.pow/100)*0.12*(1-pitchDef*0.4)*(1-coursePenalty*0.5)*(1+speedBonus*0.3);
  if (hitRoll < hrChance) return { type: "homerun" };
  const hitChance = contact*0.55*(1-pitchDef*0.3)*(1-coursePenalty)*(1+speedBonus);
  if (hitRoll < hrChance + hitChance) {
    const r = Math.random();
    if (r < 0.08) return { type: "triple" };
    if (r < 0.28) return { type: "double" };
    return { type: "single" };
  }
  const r2 = Math.random();
  if (r2 < 0.4) return { type: "grounder_out" };
  if (r2 < 0.75) return { type: "fly_out" };
  return { type: "liner_out" };
}

function addOut() { G.outs++; return G.outs >= 3; }

function addScore(runs) {
  const t = attackTeam();
  t.totalRuns += runs;
  t.scores[G.inning - 1] = (t.scores[G.inning - 1] || 0) + runs;
  updateScoreboard();
}

function resetCount() { G.balls = 0; G.strikes = 0; }

function resetInning() {
  G.outs = 0;
  G.bases = [false, false, false];
  resetCount();
}

function advanceRunners(bases) {
  let scored = 0;
  const nb = [false, false, false];
  if (G.bases[2]) { if (2+bases>=3) scored++; else nb[2+bases]=true; }
  if (G.bases[1]) { if (1+bases>=3) scored++; else nb[1+bases]=true; }
  if (G.bases[0]) { if (0+bases>=3) scored++; else nb[0+bases]=true; }
  G.bases = nb;
  return scored;
}

// ============================================================
// 17. 打席処理（共通）
// ============================================================
async function handleResult(result) {
  switch (result.type) {
    case "ball":
      G.balls++;
      SE.ball_se();
      if (G.balls >= 4) {
        say("walk");
        await sleep(600);
        let sc = 0;
        if (G.bases[2] && G.bases[1] && G.bases[0]) { sc=1; G.bases[2]=false; }
        if (G.bases[1] && G.bases[0]) G.bases[2]=true;
        if (G.bases[0]) G.bases[1]=true;
        G.bases[0]=true;
        if (sc>0) { addScore(sc); say("score",`${attackTeam().name} +${sc}点！`); await sleep(800); }
        resetCount(); attackTeam().batterIdx++;
      } else { say("ball"); await sleep(400); }
      break;

    case "strike_look":
      G.strikes++;
      SE.strike();
      if (G.strikes >= 3) {
        say("strikeout"); showBigText("三振！！","#cc2200",1100);
        await sleep(700); anim.batter.state="idle";
        if (addOut()) await doInningChange();
        else { resetCount(); attackTeam().batterIdx++; }
      } else { say("strike"); await sleep(400); }
      break;

    case "strike_swing":
      G.strikes++;
      SE.miss();
      say("swing_miss"); anim.batter.state="miss"; drawScene();
      await sleep(500);
      if (G.strikes >= 3) {
        say("strikeout"); showBigText("空振り三振！！","#cc2200",1100);
        await sleep(800); anim.batter.state="idle";
        if (addOut()) await doInningChange();
        else { resetCount(); attackTeam().batterIdx++; }
      }
      break;

    case "grounder_out":
      say("grounder"); await new Promise(res=>animateBallFlight("grounder",res)); await sleep(250);
      say("out_grounder"); await sleep(500); anim.batter.state="idle";
      if (addOut()) await doInningChange();
      else { resetCount(); attackTeam().batterIdx++; }
      break;

    case "fly_out":
      say("fly"); await new Promise(res=>animateBallFlight("fly",res)); await sleep(250);
      say("out_fly"); await sleep(500); anim.batter.state="idle";
      if (addOut()) await doInningChange();
      else { resetCount(); attackTeam().batterIdx++; }
      break;

    case "liner_out":
      say("liner"); await new Promise(res=>animateBallFlight("liner",res)); await sleep(250);
      say("out_fly"); await sleep(500); anim.batter.state="idle";
      if (addOut()) await doInningChange();
      else { resetCount(); attackTeam().batterIdx++; }
      break;

    case "single": {
      SE.hit();
      say("hit_single"); flashScreen("#ffffff",200); showBigText("ヒット！！","#00ff88",1000);
      attackTeam().hits++;
      await new Promise(res=>animateBallFlight("hit",res)); await sleep(200);
      const sc1=advanceRunners(1); G.bases[0]=true;
      if (sc1>0) { say("score",`${attackTeam().name} +${sc1}点！`); addScore(sc1); await sleep(800); }
      resetCount(); attackTeam().batterIdx++;
      break;
    }
    case "double": {
      SE.hit();
      say("hit_double"); flashScreen("#ffffff",200); showBigText("2ベース！！","#00ff88",1100);
      attackTeam().hits++;
      await new Promise(res=>animateBallFlight("hit",res)); await sleep(200);
      const sc2=advanceRunners(2); G.bases[1]=true;
      if (sc2>0) { say("score",`${attackTeam().name} +${sc2}点！`); addScore(sc2); await sleep(800); }
      resetCount(); attackTeam().batterIdx++;
      break;
    }
    case "triple": {
      SE.hit();
      say("hit_triple"); flashScreen("#ffffff",200); showBigText("3ベース！！！","#00ff88",1200);
      attackTeam().hits++;
      await new Promise(res=>animateBallFlight("hit",res)); await sleep(200);
      const sc3=advanceRunners(3); G.bases[2]=true;
      if (sc3>0) { say("score",`${attackTeam().name} +${sc3}点！`); addScore(sc3); await sleep(800); }
      resetCount(); attackTeam().batterIdx++;
      break;
    }
    case "homerun": {
      SE.homerun(); SE.crowd();
      say("homerun"); attackTeam().hits++;
      await new Promise(res=>animateBallFlight("homerun",res));
      flashScreen("#ffdd00",500); showBigText("⚾ HOME RUN !!","#f5d800",1800);
      await sleep(700);
      let runs=1;
      if (G.bases[0]) runs++; if (G.bases[1]) runs++; if (G.bases[2]) runs++;
      G.bases=[false,false,false]; addScore(runs);
      say("score",`${attackTeam().name} +${runs}点！ ホームラン！！`);
      await sleep(1300); resetCount(); attackTeam().batterIdx++;
      break;
    }
  }
}

// ============================================================
// 18. 打席タイプ別処理
// ============================================================

// CPU同士の自動打席
async function autoAtBat() {
  const batter  = currentBatter();
  const pitcher = currentPitcher();

  // CPU投球設定（ランダム）
  const courses = ["inner","center","outer"];
  const speeds  = ["slow","normal","fast"];
  const autoCourse = pick(courses);
  const autoSpeed  = pick(speeds);
  const cp = COURSE_PARAMS[autoCourse];

  say("pitch");
  await new Promise(res => animatePitch(res));
  await sleep(150);

  const result  = calcHitResult(batter, pitcher, autoCourse, autoSpeed);
  const isSwing = !["ball","strike_look"].includes(result.type);
  await new Promise(res => animateSwing(isSwing, res, cp.xOffset));
  await sleep(200);

  await handleResult(result);
  updateStatus(); updateScoreboard(); updateBatterInfo(); drawScene();
  await sleep(G.skipMode ? 50 : 300);
}

// プレイヤーがピッチャーとして操作する打席
async function playerPitchAtBat() {
  const batter  = currentBatter();
  const pitcher = currentPitcher();

  G.phase = "WAITING_PLAYER";
  showPlayerUI(true);

  // プレイヤーがPITCHボタンを押すまで待機
  await new Promise(resolve => {
    G.playerActionResolve = resolve;
  });
  G.playerActionResolve = null;
  G.phase = "PITCHING";
  showPlayerUI(false);

  const cp = COURSE_PARAMS[PITCH_CONFIG.course];
  sayPitchComment();

  await new Promise(res => animatePitch(res));
  await sleep(200);

  const result  = calcHitResult(batter, pitcher, PITCH_CONFIG.course, PITCH_CONFIG.speed);
  const isSwing = !["ball","strike_look"].includes(result.type);
  await new Promise(res => animateSwing(isSwing, res, cp.xOffset));
  await sleep(300);

  await handleResult(result);
  updateStatus(); updateScoreboard(); updateBatterInfo(); drawScene();
  G.phase = "IDLE";
}

// プレイヤーがバッターとして操作する打席
async function playerBatAtBat() {
  const batter  = currentBatter();
  const pitcher = currentPitcher();

  G.phase = "WAITING_PLAYER";
  showPlayerUI(true);

  // ── CPU投球パターン生成 ──
  const cpuPitch = generateCpuPitch(pitcher);
  const sp = SPEED_PARAMS[cpuPitch.speed];
  const cp = COURSE_PARAMS[cpuPitch.course];

  // ── 投球前ヒント演出（0.8秒） ──
  const hintEl = document.createElement("div");
  hintEl.style.cssText = `
    position:fixed;top:32%;left:50%;transform:translate(-50%,-50%);
    font-family:'Press Start 2P',monospace;font-size:clamp(10px,2.5vw,16px);
    color:#ffdd44;text-shadow:0 0 12px #ff8800,0 0 4px #000;
    background:rgba(0,0,0,0.6);padding:6px 14px;border-radius:4px;
    pointer-events:none;z-index:200;opacity:0;
    transition:opacity 0.15s;`;
  // ヒントは球速のみ（コースは隠す）
  const speedHints = { veryslow:"遅い…", slow:"ゆっくり…", normal:"", fast:"速い！", veryfast:"剛速球！！" };
  const hint = speedHints[cpuPitch.speed];
  if (hint) {
    hintEl.textContent = hint;
    document.body.appendChild(hintEl);
    requestAnimationFrame(() => { hintEl.style.opacity = "1"; });
    await sleep(800);
    hintEl.style.opacity = "0";
    setTimeout(() => hintEl.remove(), 200);
  }

  // ── 実況 ──
  const hintComments = {
    veryslow: ["緩い球が来るぞ…","チェンジアップ気味！"],
    slow:     ["タイミングを外してくる！","遅い球に注意！"],
    normal:   ["タイミングを合わせて！","ボールが来たらスイング！"],
    fast:     ["速い球が来るぞ！","剛速球に備えろ！"],
    veryfast: ["剛速球！！反応しろ！！","超高速！！"],
  };
  say("batter_hint");
  document.getElementById("commentary-text").textContent = pick(hintComments[cpuPitch.speed]);

  // ── 投球モーション ──
  SE.pitch();
  await new Promise(res => animatePitch(res));
  await sleep(100);

  swingReady   = false;
  swingPressed = false;
  let swingElapsed = 0;
  let timingGrade  = "";

  // ── 球速・コースに応じたスイングウィンドウ計算 ──
  const baseTravelMs  = 550 + Math.floor((100 - pitcher.pitch) * 2.5);
  const speedTravelMs = Math.round(baseTravelMs / (sp.windowMult));
  const ballTravelMs  = Math.max(speedTravelMs, 200);
  const baseWindow    = ballTravelMs * 0.28;  // 基本ウィンドウ幅
  const windowSize    = baseWindow * sp.windowMult * cp.windowMult;
  const windowCenter  = ballTravelMs * 0.58;
  const swingWindowStart = windowCenter - windowSize / 2;
  const swingWindowEnd   = windowCenter + windowSize / 2;

  // ── ボール飛来アニメーション（プレイヤー操作） ──
  const ballPromise = new Promise(res => {
    let frame = 0;
    const totalFrames = Math.max(Math.round(ballTravelMs / 16.7), 8);
    const ballStartX = POS.mound.x;
    const ballStartY = POS.mound.y - 10;
    const ballEndX   = POS.home.x  + cp.xOffset * 0.6;
    const ballEndY   = POS.home.y  - 8 + (cp.yOffset || 0) * 0.7;
    anim.ball.visible = true;
    anim.ball.trail   = [];
    anim.ball.r       = cpuPitch.speed === "veryfast" ? 9 : 7;
    anim.batter.state = "ready";
    const maxTrail    = sp.trailLen || 8;

    function step() {
      frame++;
      const t = easeOut(clamp(frame / totalFrames, 0, 1));
      anim.ball.x = lerp(ballStartX, ballEndX, t);
      const baseY = lerp(ballStartY, ballEndY, t);
      // コース別Y軌道変化
      if (cpuPitch.course === "high") {
        anim.ball.y = baseY - Math.sin(t * Math.PI) * 20;
      } else if (cpuPitch.course === "low") {
        anim.ball.y = baseY + Math.sin(t * Math.PI) * 10;
      } else {
        anim.ball.y = baseY - Math.sin(t * Math.PI) * 8;
      }
      anim.ball.trail.push({ x: anim.ball.x, y: anim.ball.y });
      if (anim.ball.trail.length > maxTrail) anim.ball.trail.shift();

      swingElapsed = (frame / totalFrames) * ballTravelMs;
      if (swingPressed) {
        if (swingElapsed >= swingWindowStart && swingElapsed <= swingWindowEnd) {
          anim.batter.state = "swing";
          anim.batter.frame = Math.min(frame * 2, 16);
        } else {
          anim.batter.state = "miss";
        }
      }
      drawScene();
      if (frame < totalFrames) anim.rafId = requestAnimationFrame(step);
      else { anim.ball.visible = false; anim.ball.trail = []; anim.ball.r = 7; res(); }
    }
    anim.rafId = requestAnimationFrame(step);
  });

  swingReady = true;
  const swingBtn = document.getElementById("swing-btn");
  if (swingBtn) swingBtn.disabled = false;

  await ballPromise;
  swingReady = false;
  if (swingBtn) swingBtn.disabled = true;
  showPlayerUI(false);

  // ── タイミング評価 ──
  if (swingPressed) {
    timingGrade = evalTiming(swingElapsed, swingWindowStart, swingWindowEnd);
  }

  await sleep(150);

  // ── 結果判定（タイミングとCPU投球を考慮） ──
  let result;
  if (!swingPressed) {
    // 見逃し
    const baseResult = calcHitResult(batter, pitcher, cpuPitch.course, cpuPitch.speed);
    result = baseResult.type === "ball" ? { type:"ball" } : { type:"strike_look" };
    SE.ball_se();
  } else {
    SE.swing();
    const inWindow = swingElapsed >= swingWindowStart && swingElapsed <= swingWindowEnd;
    if (!inWindow) {
      // 完全にタイミング外れ → 空振り確定
      result = { type:"strike_swing" };
      SE.miss();
    } else {
      // タイミング内：グレードに応じてヒット確率を補正
      const timingBonus = timingGrade === "PERFECT" ? 0.30 :
                          timingGrade === "GOOD"    ? 0.12 : -0.08;
      const baseResult = calcHitResult(batter, pitcher, cpuPitch.course, cpuPitch.speed);
      if (baseResult.type === "ball") {
        // ボール球をスイング → 空振りか弱い当たり
        result = Math.random() < 0.25 + timingBonus * 0.3 ? { type:"grounder_out" } : { type:"strike_swing" };
      } else if (baseResult.type === "strike_look") {
        // ストライクをスイング → タイミング次第でヒット
        const hitRoll = Math.random();
        if (hitRoll < 0.15 + timingBonus * 0.5) result = { type:"single" };
        else result = { type:"strike_swing" };
      } else {
        // 通常の打球：タイミングボーナスを加味
        if (timingGrade === "PERFECT" && baseResult.type === "grounder_out" && Math.random() < 0.40) {
          result = { type:"single" };
        } else if (timingGrade === "PERFECT" && baseResult.type === "homerun") {
          result = baseResult; // ホームランはそのまま
        } else if (timingGrade === "LATE" && ["single","double","triple"].includes(baseResult.type)) {
          result = Math.random() < 0.5 ? { type:"grounder_out" } : baseResult;
        } else {
          result = baseResult;
        }
      }
      // SE
      if (["single","double","triple"].includes(result.type)) SE.hit();
      else if (result.type === "homerun") { SE.homerun(); SE.crowd(); }
      else if (result.type === "strike_swing") SE.miss();
    }
    // タイミング評価フィードバック表示
    if (inWindow) {
      const gradeColors = { PERFECT:"#00ffcc", GOOD:"#ffdd44", LATE:"#ff8844" };
      showBigText(timingGrade, gradeColors[timingGrade] || "#ffffff", 700);
    }
  }

  await handleResult(result);
  updateStatus(); updateScoreboard(); updateBatterInfo(); drawScene();
  G.phase = "IDLE";
}

// ============================================================
// 19. 試合進行エンジン（matchLoop）
// ============================================================
async function matchLoop() {
  G.phase = "PLAYING";

  while (G.inning <= 9 && G.phase !== "GAMEOVER") {
    // 表・裏のループ
    for (let half = 0; half < 2; half++) {
      G.half = half;
      resetInning();
      updateStatus(); updateScoreboard(); updateBatterInfo();

      const halfStr = G.half === 0 ? "表" : "裏";
      document.getElementById("commentary-text").textContent = `${G.inning}回${halfStr}　開始！`;
      drawScene();
      await sleep(G.skipMode ? 100 : 600);

      // スキップ解除チェック：プレイヤーの番が来たら自動解除
      if (G.skipRequested && isPlayerTurn()) {
        G.skipMode = false;
        G.skipRequested = false;
        updateSkipBtn();
        // 「あなたの番！」演出
        showBigText("⚡ あなたの番！", "#00ff88", 1200);
        await sleep(1000);
      }

      // 3アウトになるまで打席を繰り返す
      while (G.outs < 3 && G.phase !== "GAMEOVER") {
        updateBatterInfo();
        drawScene();

        // スキップ解除チェック（打席ごと）
        if (G.skipRequested && isPlayerTurn()) {
          G.skipMode = false;
          G.skipRequested = false;
          updateSkipBtn();
          showBigText("⚡ あなたの番！", "#00ff88", 1200);
          await sleep(1000);
        }

        if (isPlayerTurn()) {
          // プレイヤー操作打席
          if (G.playerRole === "pitcher") {
            await playerPitchAtBat();
          } else {
            await playerBatAtBat();
          }
        } else {
          // CPU自動打席
          showPlayerUI(false);
          await autoAtBat();
        }

        if (G.phase === "GAMEOVER") break;
      }

      if (G.phase === "GAMEOVER") break;

      // 攻守交代
      if (!(G.inning === 9 && half === 1)) {
        say("inning_change");
        showBigText("チェンジ！", "#ffffff", 1000);
        await sleep(G.skipMode ? 200 : 1000);
      }
    }

    G.inning++;
    if (G.inning > 9) { await endGame(); return; }

    updateStatus(); updateScoreboard();
    await sleep(G.skipMode ? 100 : 400);
  }

  if (G.phase !== "GAMEOVER") await endGame();
}

async function doInningChange() {
  say("inning_change");
  showBigText("チェンジ！", "#ffffff", 1000);
  await sleep(G.skipMode ? 200 : 1000);
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
  updateStatus(); updateScoreboard(); updateBatterInfo(); drawScene();
  await sleep(G.skipMode ? 100 : 600);
}

async function endGame() {
  G.phase = "GAMEOVER";
  const [t0, t1] = G.teams;
  let winner;
  if (t0.totalRuns > t1.totalRuns)      winner = t0.name;
  else if (t1.totalRuns > t0.totalRuns) winner = t1.name;
  else                                   winner = "引き分け";

  showPlayerUI(false);
  document.getElementById("skip-btn").disabled = true;
  await sleep(800);

  document.getElementById("game-screen").style.display = "none";
  const rs = document.getElementById("result-screen");
  rs.style.display = "flex";
  document.getElementById("result-title").textContent =
    winner === "引き分け" ? "引き分け！" : `${winner} の勝利！！`;
  document.getElementById("result-detail").innerHTML =
    `${t0.name}  ${t0.totalRuns} - ${t1.totalRuns}  ${t1.name}<br><br>${t0.name}　${t0.hits}安打<br>${t1.name}　${t1.hits}安打`;
}

// ============================================================
// 20. スキップ機能
// ============================================================
function updateSkipBtn() {
  const btn = document.getElementById("skip-btn");
  if (G.skipMode) {
    btn.textContent = "⏩ スキップ中…（自分の番で停止）";
    btn.classList.add("skipping");
  } else {
    btn.textContent = "⏩ スキップ（次の自分の番まで）";
    btn.classList.remove("skipping");
  }
}

// ============================================================
// 21. 球団選択画面
// ============================================================
let tsSelectedTeamIdx = -1;
let tsSelectedRole    = "";

function buildTeamSelectScreen() {
  const grid = document.getElementById("team-grid");
  grid.innerHTML = "";
  TEAM_DEFS.forEach((def, idx) => {
    const card = document.createElement("div");
    card.className = "team-card";
    card.innerHTML = `<span class="team-color-dot" style="background:${def.color}"></span>${def.name}`;
    card.addEventListener("click", () => {
      tsSelectedTeamIdx = idx;
      document.querySelectorAll(".team-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      updateTsSummary();
    });
    grid.appendChild(card);
  });
}

function updateTsSummary() {
  const summary = document.getElementById("ts-summary");
  const confirmBtn = document.getElementById("ts-confirm-btn");
  if (tsSelectedTeamIdx >= 0 && tsSelectedRole) {
    const teamName = TEAM_DEFS[tsSelectedTeamIdx].name;
    const roleLabel = tsSelectedRole === "pitcher" ? "ピッチャー" : "バッター";
    summary.textContent = `${teamName} で ${roleLabel} として出場！`;
    confirmBtn.disabled = false;
  } else if (tsSelectedTeamIdx >= 0) {
    summary.textContent = `${TEAM_DEFS[tsSelectedTeamIdx].name} を選択。役割を選んでください。`;
    confirmBtn.disabled = true;
  } else if (tsSelectedRole) {
    summary.textContent = "チームを選んでください。";
    confirmBtn.disabled = true;
  } else {
    summary.textContent = "チームと役割を選んでください";
    confirmBtn.disabled = true;
  }
}

// ============================================================
// 22. ゲーム初期化
// ============================================================
function startGame() {
  // 2チームを生成（プレイヤーチームを先に確定）
  const playerDef = TEAM_DEFS[tsSelectedTeamIdx];
  const otherDefs = TEAM_DEFS.filter((_, i) => i !== tsSelectedTeamIdx);
  const opponentDef = pick(otherDefs);

  // プレイヤーチームをインデックス0に固定
  G.teams = [buildTeam(playerDef), buildTeam(opponentDef)];
  G.playerTeamIdx = 0;
  G.playerRole    = tsSelectedRole;

  G.inning  = 1;
  G.half    = 0;
  G.outs    = 0;
  G.balls   = 0;
  G.strikes = 0;
  G.bases   = [false, false, false];
  G.phase   = "IDLE";
  G.gameStarted = true;
  G.skipMode = false;
  G.skipRequested = false;

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

  // 初期UI設定
  PITCH_CONFIG.course = "center";
  PITCH_CONFIG.speed  = "normal";

  document.getElementById("team-select-screen").style.display = "none";
  document.getElementById("result-screen").style.display      = "none";
  document.getElementById("game-screen").style.display        = "flex";

  showPlayerUI(false);
  updateSkipBtn();
  updateScoreboard();
  updateStatus();
  updateBatterInfo();
  drawScene();

  document.getElementById("commentary-text").textContent =
    `⚾ プレイボール！\n${G.teams[0].name} vs ${G.teams[1].name}`;

  // 試合進行ループ開始
  matchLoop();
}

// ============================================================
// 23. イベントリスナー
// ============================================================

// タイトル → 球団選択
document.getElementById("title-start-btn").addEventListener("click", () => {
  document.getElementById("title-screen").style.display       = "none";
  document.getElementById("team-select-screen").style.display = "flex";
  buildTeamSelectScreen();
  tsSelectedTeamIdx = -1;
  tsSelectedRole    = "";
  updateTsSummary();
});

// 球団選択 → タイトルへ戻る
document.getElementById("ts-back-btn").addEventListener("click", () => {
  document.getElementById("team-select-screen").style.display = "none";
  document.getElementById("title-screen").style.display       = "flex";
});

// 役割選択ボタン
document.getElementById("role-pitcher-btn").addEventListener("click", () => {
  tsSelectedRole = "pitcher";
  document.querySelectorAll(".role-btn").forEach(b => b.classList.remove("selected-pitcher","selected-batter"));
  document.getElementById("role-pitcher-btn").classList.add("selected-pitcher");
  updateTsSummary();
});
document.getElementById("role-batter-btn").addEventListener("click", () => {
  tsSelectedRole = "batter";
  document.querySelectorAll(".role-btn").forEach(b => b.classList.remove("selected-pitcher","selected-batter"));
  document.getElementById("role-batter-btn").classList.add("selected-batter");
  updateTsSummary();
});

// 試合開始確定
document.getElementById("ts-confirm-btn").addEventListener("click", () => {
  if (tsSelectedTeamIdx < 0 || !tsSelectedRole) return;
  startGame();
});

// PITCHボタン（プレイヤーがピッチャーモードの打席で押す）
document.getElementById("pitch-btn").addEventListener("click", () => {
  if (G.phase === "WAITING_PLAYER" && G.playerRole === "pitcher" && isPlayerTurn()) {
    if (G.playerActionResolve) {
      G.playerActionResolve();
    }
  }
});

// SWINGボタン
document.getElementById("swing-btn").addEventListener("click", () => {
  if (swingReady) swingPressed = true;
});

// フィールドタップ（ピッチャーモード時はPITCH、バッターモード時はSWING）
document.getElementById("field-canvas").addEventListener("click", () => {
  if (!G.gameStarted || G.phase === "GAMEOVER") return;
  if (G.phase === "WAITING_PLAYER" && G.playerRole === "pitcher" && isPlayerTurn()) {
    if (G.playerActionResolve) G.playerActionResolve();
  } else if (swingReady) {
    swingPressed = true;
  }
});

// スキップボタン
document.getElementById("skip-btn").addEventListener("click", () => {
  if (G.phase === "GAMEOVER") return;
  if (isPlayerTurn() && G.phase === "WAITING_PLAYER") return; // 自分の番中はスキップ不可

  if (G.skipMode) {
    // スキップ解除
    G.skipMode = false;
    G.skipRequested = false;
    updateSkipBtn();
  } else {
    // スキップ開始
    G.skipMode = true;
    G.skipRequested = true;
    updateSkipBtn();
    const modeLabel = document.getElementById("mode-label");
    if (modeLabel) modeLabel.textContent = "⏩ スキップ中…";
  }
});

// コース選択ボタン
document.querySelectorAll("#course-btns .sel-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    PITCH_CONFIG.course = btn.dataset.course;
    updatePitcherPanel();
  });
});

// 球速選択ボタン
document.querySelectorAll("#speed-btns .sel-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    PITCH_CONFIG.speed = btn.dataset.speed;
    updatePitcherPanel();
  });
});

// リトライ
document.getElementById("retry-btn").addEventListener("click", () => {
  document.getElementById("result-screen").style.display      = "none";
  document.getElementById("team-select-screen").style.display = "flex";
  buildTeamSelectScreen();
  tsSelectedTeamIdx = -1;
  tsSelectedRole    = "";
  updateTsSummary();
});

// タイトルへ戻る
document.getElementById("back-title-btn").addEventListener("click", () => {
  document.getElementById("result-screen").style.display = "none";
  document.getElementById("title-screen").style.display  = "flex";
});

// ============================================================
// 24. 初期描画
// ============================================================
(function init() {
  drawScene();
})();
