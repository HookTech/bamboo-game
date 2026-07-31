'use strict';
/* 势如破竹 —— 解压竹子小游戏原型
 * 节奏按空格 → 竹子生长 → 小人抱竹梢升天拾金币
 * 无依赖,纯 Canvas + WebAudio
 */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const GROUND_PAD = 80;           // 地面距画布底部
const BAMBOO_X = W * 0.42;       // 竹子水平位置
const METER_PX = 50;             // 多少像素算 1 米

// ---------- 状态 ----------
const S = {
  started: false,
  t: 0,                    // 全局时间(秒)
  camY: 0,                 // 相机世界高度
  height: 0,               // 竹子当前高度(显示值,缓动)
  targetHeight: 0,         // 竹子目标高度
  combo: 0,
  maxCombo: 0,
  coins: 0,
  score: 0,
  stunUntil: 0,            // 眩晕截止时间
  lastPressAt: -Infinity,
  pressFlash: 0,           // 按键反馈动画
  shake: 0,
  best: parseFloat(localStorage.getItem('bamboo_best') || '0'),
  coinList: [],
  particles: [],
  floatTexts: [],
  clouds: [],
  leaves: [],
  lastCoinSpawn: 0,
  dizzy: false,
  tipSway: 0,
  charX: 0,
  charY: 0,
};

// ---------- 音频 ----------
let AC = null;
function audio() {
  if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(freq, dur, type, vol, when = 0, slide = 0) {
  const ac = audio();
  const o = ac.createOscillator(), g = ac.createGain();
  const t0 = ac.currentTime + when;
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ac.destination);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
const sfxPress = () => tone(190 + Math.random() * 30, 0.09, 'triangle', 0.16, 0, -60);
const sfxBad   = () => { tone(140, 0.18, 'sawtooth', 0.08, 0, -70); tone(98, 0.22, 'sawtooth', 0.07, 0.05, -40); };
const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]; // C 大调五声音阶
function sfxCoin(combo) {
  const i = Math.min(combo, PENTA.length - 1);
  tone(PENTA[i], 0.25, 'sine', 0.2);
  tone(PENTA[i] * 2, 0.18, 'sine', 0.06, 0.02);
}

// ---------- 工具 ----------
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
// 世界坐标(向上为正) → 屏幕 y
const sy = wy => H - GROUND_PAD - (wy - S.camY);

// ---------- 输入:节奏判定 ----------
const MIN_GAP = 0.12;   // 快于此 = 连点,眩晕
const GOOD_GAP = 0.55;  // 慢于此 = 断连击

window.addEventListener('keydown', e => {
  if (e.code !== 'Space' || e.repeat) return;
  e.preventDefault();
  if (!S.started) {
    S.started = true;
    document.getElementById('overlay').classList.add('hidden');
    audio();
    return;
  }
  const now = S.t;
  if (now < S.stunUntil) return;              // 眩晕中按键无效
  const gap = now - S.lastPressAt;
  S.lastPressAt = now;

  if (gap < MIN_GAP) {                        // 按太急 → 竹子晕了
    S.stunUntil = now + 0.9;
    S.dizzy = true;
    S.combo = 0;
    S.shake = 14;
    sfxBad();
    spawnFloatText('慢一点~', BAMBOO_X + 40, S.height, '#ff9a9a');
    return;
  }
  if (gap > GOOD_GAP) S.combo = 0;            // 断连击
  S.combo = Math.min(S.combo + 1, 12);
  S.maxCombo = Math.max(S.maxCombo, S.combo);
  const gain = 26 * (1 + S.combo * 0.09);     // 连击加成
  S.targetHeight += gain;
  S.pressFlash = 1;
  sfxPress();
  // 竹根溅起小叶子
  for (let i = 0; i < 3; i++) spawnLeaf(BAMBOO_X + rand(-14, 14), 6);
});

// ---------- 生成物 ----------
function spawnCoin() {
  // 在小人头顶上方一段距离内随机生成,左右飘
  const baseY = S.camY + H + rand(0, 240);
  S.coinList.push({
    x: rand(60, W - 60),
    y: baseY,
    r: 14,
    ph: rand(0, Math.PI * 2),   // 漂浮相位
    vx: rand(-14, 14),          // 水平风
    spin: rand(0, Math.PI * 2),
    dead: false,
  });
}
function spawnLeaf(x, wy) {
  S.leaves.push({ x, y: wy, vx: rand(-25, 25), vy: rand(30, 70), rot: rand(0, 6), vr: rand(-3, 3), life: rand(1.2, 2.2) });
}
function spawnBurst(x, wy, color) {
  for (let i = 0; i < 14; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(40, 160);
    S.particles.push({ x, y: wy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(.4, .8), max: .8, color, r: rand(2, 5) });
  }
}
function spawnFloatText(txt, x, wy, color) {
  S.floatTexts.push({ txt, x, y: wy, life: 1.1, color });
}
function initClouds() {
  S.clouds = [];
  for (let i = 0; i < 9; i++) {
    S.clouds.push({ x: rand(0, W), y: rand(0, H * 1.4), s: rand(.5, 1.4), v: rand(6, 20) });
  }
}
initClouds();

// ---------- 更新 ----------
function update(dt) {
  S.t += dt;
  S.dizzy = S.t < S.stunUntil;

  // 竹子高度缓动 → 柔软生长感
  S.height = lerp(S.height, S.targetHeight, Math.min(1, dt * 3.2));

  // 相机跟随竹梢,让小人保持在屏幕下 40% 附近
  const anchor = S.height - H * 0.55;
  S.camY = Math.max(0, lerp(S.camY, anchor, Math.min(1, dt * 4)));

  S.pressFlash = Math.max(0, S.pressFlash - dt * 4);
  S.shake = Math.max(0, S.shake - dt * 30);

  // 金币生成:保持天上始终有货(上限防挂机堆积)
  if (S.t - S.lastCoinSpawn > 0.7 && S.coinList.length < 30) { S.lastCoinSpawn = S.t; spawnCoin(); }

  // 竹尖摆动:像素制,幅度钳制,随高度仅略微增加(14→24px)
  const growPull = clamp((S.targetHeight - S.height) * 0.06, -18, 18);
  const baseAmp = 14 + Math.min(S.height / 300, 1) * 10;
  const dizzyWob = S.dizzy ? Math.sin(S.t * 22) * 10 : 0;
  S.tipSway = clamp(Math.sin(S.t * 1.6) * baseAmp + growPull + dizzyWob, -44, 44);

  // 小人世界位置:贴着竹身(高度 h-26 处),随竹尖摆动同比例偏移
  const charWY = Math.max(S.height - 26, 0);
  const ratio = S.height > 1 ? charWY / S.height : 0;
  S.charX = BAMBOO_X + S.tipSway * ratio * ratio;
  S.charY = charWY;

  // 金币:漂浮 + 磁吸 + 拾取
  for (const c of S.coinList) {
    c.ph += dt * 2;
    c.spin += dt * 5;
    c.x += (c.vx + Math.sin(c.ph) * 12) * dt;
    c.y += Math.cos(c.ph * 0.7) * 8 * dt;
    if (c.x < 30 || c.x > W - 30) c.vx *= -1;
    const dx = S.charX + 16 - c.x, dy = S.charY - c.y;
    const d = Math.hypot(dx, dy) || 1e-6;
    if (d < 95) {           // 磁吸
      c.x += dx / d * 220 * dt;
      c.y += dy / d * 220 * dt;
    }
    if (d < 40) {           // 拾取
      c.dead = true;
      const mult = 1 + Math.floor(S.combo / 4);
      S.coins++;
      S.score += mult;
      sfxCoin(S.combo);
      spawnBurst(c.x, c.y, '#ffd76e');
      spawnFloatText(mult > 1 ? `+${mult}` : '+1', c.x, c.y, '#ffd76e');
    }
    if (sy(c.y) > H + 60) c.dead = true;  // 落到屏幕下方丢弃
  }
  S.coinList = S.coinList.filter(c => !c.dead);

  // 云
  for (const cl of S.clouds) {
    cl.x += cl.v * dt;
    if (cl.x > W + 120) { cl.x = -120; cl.y = rand(0, H * 1.4); }
  }
  // 叶子
  if (Math.random() < dt * 0.8 && S.height > 120) spawnLeaf(S.charX + rand(-30, 30), S.height - rand(0, 120));
  for (const l of S.leaves) {
    l.x += l.vx * dt; l.y -= l.vy * dt;   // 世界坐标:vy 向下(世界 y 减小)
    l.rot += l.vr * dt; l.life -= dt;
  }
  S.leaves = S.leaves.filter(l => l.life > 0);

  // 粒子
  for (const p of S.particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy -= 300 * dt;                      // 世界坐标下重力向上为负 → 粒子下落
    p.life -= dt;
  }
  S.particles = S.particles.filter(p => p.life > 0);

  for (const f of S.floatTexts) { f.y += 40 * dt; f.life -= dt; }
  S.floatTexts = S.floatTexts.filter(f => f.life > 0);

  // 最高分
  const m = S.height / METER_PX;
  if (m > S.best) { S.best = m; localStorage.setItem('bamboo_best', String(S.best)); }
}

// ---------- 绘制 ----------
function skyColor() {
  // 越高天越暮色:0m 白天 → 200m 星空紫
  const k = clamp(S.height / (METER_PX * 200), 0, 1);
  const top = [lerp(88, 30, k), lerp(176, 24, k), lerp(240, 70, k)];
  const bot = [lerp(196, 90, k), lerp(236, 60, k), lerp(255, 110, k)];
  return { top, bot, k };
}

function draw() {
  const { top, bot, k } = skyColor();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgb(${top.map(Math.round).join(',')})`);
  g.addColorStop(1, `rgb(${bot.map(Math.round).join(',')})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 星星(高空出现)
  if (k > 0.25) {
    ctx.fillStyle = `rgba(255,255,255,${(k - 0.25) * 1.2})`;
    for (let i = 0; i < 40; i++) {
      const x = (i * 197.3) % W, y = (i * 89.7) % (H * 0.7);
      const tw = 0.5 + 0.5 * Math.sin(S.t * 2 + i);
      ctx.globalAlpha = tw * clamp((k - 0.25) * 1.5, 0, 1);
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  // 太阳 / 月亮
  ctx.beginPath();
  ctx.arc(W - 110, 90, 34, 0, Math.PI * 2);
  ctx.fillStyle = k < 0.5 ? '#ffedb0' : '#f4f1de';
  ctx.shadowColor = '#ffedb0'; ctx.shadowBlur = 40;
  ctx.fill(); ctx.shadowBlur = 0;

  // 云(视差:随相机轻微移动)
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  for (const cl of S.clouds) {
    const yy = ((cl.y - S.camY * 0.15) % (H * 1.4) + H * 1.4) % (H * 1.4) - H * 0.2;
    ctx.globalAlpha = clamp(1 - k * 0.8, 0.15, 1);
    cloud(cl.x, yy, cl.s);
  }
  ctx.globalAlpha = 1;

  // 远山(接近地面时可见)
  const hillAlpha = clamp(1 - S.camY / 500, 0, 1);
  if (hillAlpha > 0.01) {
    ctx.globalAlpha = hillAlpha;
    ctx.fillStyle = '#7fb069';
    ctx.beginPath();
    ctx.moveTo(0, H - GROUND_PAD + 2 - S.camY * 0.3);
    for (let x = 0; x <= W; x += 40) {
      ctx.lineTo(x, H - GROUND_PAD - S.camY * 0.3 - 40 - Math.sin(x * 0.01) * 46);
    }
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // 地面
  const gy = sy(0);
  if (gy < H + 200) {
    ctx.fillStyle = '#5c8a4d';
    ctx.fillRect(0, gy, W, H - gy + GROUND_PAD);
    ctx.fillStyle = '#4a7340';
    for (let x = 0; x < W; x += 26) ctx.fillRect(x, gy, 14, 5);
  }

  ctx.save();
  if (S.shake > 0) ctx.translate(rand(-S.shake, S.shake) * 0.4, rand(-S.shake, S.shake) * 0.4);

  drawBamboo();
  drawCoins();
  drawChar();
  drawParticles();
  drawLeaves();
  drawFloatTexts();
  ctx.restore();

  drawHUD();
}

function cloud(x, y, s) {
  ctx.beginPath();
  ctx.arc(x, y, 22 * s, 0, Math.PI * 2);
  ctx.arc(x + 24 * s, y - 8 * s, 18 * s, 0, Math.PI * 2);
  ctx.arc(x + 48 * s, y, 20 * s, 0, Math.PI * 2);
  ctx.fill();
}

function drawBamboo() {
  const h = S.height;
  if (h < 4) return;
  // 二次弯曲,竹尖处恰好等于钳制后的 tipSway → 摆动永不超 ±44px
  const bend = S.tipSway * 300 / (h * h);
  const segLen = 46;
  const n = Math.ceil(h / segLen);
  for (let i = 0; i < n; i++) {
    const y0 = i * segLen, y1 = Math.min((i + 1) * segLen, h);
    const w0 = lerp(16, 7, y0 / Math.max(h, 1));
    const x0 = BAMBOO_X + bend * y0 * y0 / 300;
    const x1 = BAMBOO_X + bend * y1 * y1 / 300;
    const grad = clamp(i / 8, 0, 1);
    ctx.strokeStyle = S.dizzy && Math.floor(S.t * 10) % 2 ? '#c9d16b'
      : `rgb(${Math.round(lerp(96, 130, grad))},${Math.round(lerp(168, 190, grad))},${Math.round(lerp(84, 110, grad))})`;
    ctx.lineWidth = w0;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, sy(y0));
    ctx.lineTo(x1, sy(y1));
    ctx.stroke();
    // 竹节环
    if (i > 0) {
      ctx.strokeStyle = 'rgba(60,90,50,.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x0 - w0 / 2, sy(y0));
      ctx.lineTo(x0 + w0 / 2, sy(y0));
      ctx.stroke();
    }
    // 竹叶
    if (i > 1 && i % 2 === 0) {
      const side = i % 4 === 0 ? 1 : -1;
      ctx.save();
      ctx.translate(x0, sy(y0));
      ctx.rotate(side * 0.7 + Math.sin(S.t * 2 + i) * 0.08);
      ctx.fillStyle = 'rgba(80,150,80,.9)';
      ctx.beginPath();
      ctx.ellipse(side * 22, 0, 22, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawChar() {
  const x = S.charX + 16;
  const y = sy(S.charY);
  const bounce = Math.sin(S.t * 3) * 2 - S.pressFlash * 4;

  ctx.save();
  ctx.translate(x, y + bounce);
  if (S.dizzy) ctx.rotate(Math.sin(S.t * 20) * 0.15);

  const FUR = '#c05427', FUR_L = '#d97b45', CREAM = '#f7ecd7', DARK = '#3d2a1d';

  // 环纹大尾巴(身后右下方,随节奏轻摆)
  ctx.save();
  ctx.translate(15, 20);
  ctx.rotate(0.55 + Math.sin(S.t * 2) * 0.1);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i % 2 ? '#8a3c1c' : FUR_L;
    ctx.beginPath();
    ctx.ellipse(0, i * 8.5, 10 - i * 0.7, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 后腿(黑棕,夹住竹子)
  ctx.strokeStyle = DARK; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 16); ctx.lineTo(-14, 24); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 21); ctx.lineTo(-12, 32); ctx.stroke();

  // 身体(红棕)+ 深色肚皮
  ctx.fillStyle = FUR;
  ctx.beginPath(); ctx.ellipse(6, 8, 14, 17, -0.15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = DARK;
  ctx.beginPath(); ctx.ellipse(4, 13, 9, 11, -0.15, 0, Math.PI * 2); ctx.fill();

  // 前肢环抱竹子
  ctx.strokeStyle = DARK; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(4, 0); ctx.quadraticCurveTo(-16, -5, -18, 5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(5, 9); ctx.quadraticCurveTo(-15, 7, -18, 14); ctx.stroke();

  // 头
  ctx.fillStyle = FUR;
  ctx.beginPath(); ctx.arc(6, -15, 14, 0, Math.PI * 2); ctx.fill();
  // 耳朵:外深内白
  for (const ex of [-4, 16]) {
    ctx.fillStyle = DARK;
    ctx.beginPath(); ctx.arc(ex, -27, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = CREAM;
    ctx.beginPath(); ctx.arc(ex, -27, 3.2, 0, Math.PI * 2); ctx.fill();
  }
  // 白脸斑:吻部 + 双眉斑
  ctx.fillStyle = CREAM;
  ctx.beginPath(); ctx.ellipse(6, -10.5, 8.5, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -19.5, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(12, -19.5, 2.6, 0, Math.PI * 2); ctx.fill();
  // 鼻
  ctx.fillStyle = '#2a1a12';
  ctx.beginPath(); ctx.arc(6, -12.5, 1.8, 0, Math.PI * 2); ctx.fill();
  // 眼:眩晕=圈圈,平时=开心笑眼
  ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 2;
  if (S.dizzy) {
    ctx.beginPath(); ctx.arc(1, -17, 2.5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(11, -17, 2.5, 0, Math.PI * 2); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(1, -17, 3, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(11, -17, 3, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  }
  // 嘴:小微笑
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(6, -9.5, 2.6, 0.3, Math.PI - 0.3); ctx.stroke();
  // 眩晕星星
  if (S.dizzy) {
    ctx.fillStyle = '#ffe27a';
    for (let i = 0; i < 3; i++) {
      const a = S.t * 4 + i * Math.PI * 2 / 3;
      ctx.beginPath();
      ctx.arc(6 + Math.cos(a) * 22, -30 + Math.sin(a) * 6, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawCoins() {
  for (const c of S.coinList) {
    const yy = sy(c.y);
    if (yy < -40 || yy > H + 40) continue;
    const sq = Math.abs(Math.cos(c.spin));      // 旋转错觉
    ctx.save();
    ctx.translate(c.x, yy);
    ctx.scale(Math.max(sq, 0.15), 1);
    ctx.fillStyle = '#ffd76e';
    ctx.strokeStyle = '#d9a441';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, c.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d9a441';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (sq > 0.5) ctx.fillText('¥', 0, 1);
    ctx.restore();
    // 闪光
    const tw = Math.sin(S.t * 3 + c.ph);
    if (tw > 0.7) {
      ctx.strokeStyle = `rgba(255,255,220,${(tw - 0.7) * 3})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(c.x - 8, yy - c.r - 6); ctx.lineTo(c.x + 8, yy - c.r - 6);
      ctx.moveTo(c.x, yy - c.r - 14); ctx.lineTo(c.x, yy - c.r + 2);
      ctx.stroke();
    }
  }
}

function drawParticles() {
  for (const p of S.particles) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, sy(p.y), p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawLeaves() {
  ctx.fillStyle = 'rgba(110,170,90,.85)';
  for (const l of S.leaves) {
    ctx.save();
    ctx.translate(l.x, sy(l.y));
    ctx.rotate(l.rot);
    ctx.globalAlpha = clamp(l.life, 0, 1);
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawFloatTexts() {
  ctx.textAlign = 'center';
  ctx.font = 'bold 18px "PingFang SC", sans-serif';
  for (const f of S.floatTexts) {
    ctx.globalAlpha = clamp(f.life, 0, 1);
    ctx.fillStyle = f.color;
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.lineWidth = 3;
    ctx.strokeText(f.txt, f.x, sy(f.y));
    ctx.fillText(f.txt, f.x, sy(f.y));
  }
  ctx.globalAlpha = 1;
}

function drawHUD() {
  const m = S.height / METER_PX;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 22px "PingFang SC", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.95)';
  ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 4;
  ctx.fillText(`金币 ${S.coins}`, 18, 36);
  ctx.fillText(`分数 ${S.score}`, 18, 66);
  ctx.fillText(`高度 ${m.toFixed(1)}m`, 18, 96);
  ctx.font = '15px "PingFang SC", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.65)';
  ctx.fillText(`最高 ${S.best.toFixed(1)}m`, 18, 120);
  ctx.shadowBlur = 0;

  // 连击条
  if (S.combo > 0) {
    const cx = W - 190, cy = 26, cw = 160, ch = 14;
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.roundRect(cx, cy, cw, ch, 7); ctx.fill();
    const pulse = 1 + Math.sin(S.t * 6) * 0.05;
    ctx.fillStyle = `hsl(${45 + S.combo * 8}, 90%, ${55 + S.combo}%)`;
    ctx.beginPath();
    ctx.roundRect(cx, cy + (ch - ch * pulse) / 2, cw * (S.combo / 12), ch * pulse, 7);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px "PingFang SC", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`连击 x${S.combo}`, W - 22, 62);
  }
  if (S.dizzy) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px "PingFang SC", sans-serif';
    ctx.fillStyle = 'rgba(255,120,120,.9)';
    ctx.fillText('竹子晕了…歇一下', W / 2, 60);
  }

  // 按键规则说明(常驻底部)
  ctx.textAlign = 'center';
  ctx.font = '15px "PingFang SC", sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.roundRect(W / 2 - 268, H - 38, 536, 28, 14); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  ctx.fillText('空格:有节奏地点按(0.1~0.5秒/次)竹子长高 · 按太急会眩晕 · 按太慢断连击', W / 2, H - 19);
}

// ---------- 主循环 ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (S.started) update(dt); else S.t += dt;
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
