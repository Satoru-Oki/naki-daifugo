// Web Audio API 効果音ユーティリティ

let ctx: AudioContext | null = null;

function getContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  if (ctx.state === "suspended") {
    ctx.resume();
  }
  return ctx;
}

/** カード配り音 — 枚数分のノイズバーストを60ms間隔で再生 */
export function playDeal(count: number): void {
  const ac = getContext();
  for (let i = 0; i < count; i++) {
    const t = ac.currentTime + i * 0.06;
    const duration = 0.05;

    // ノイズバッファ
    const buf = ac.createBuffer(1, ac.sampleRate * duration, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let j = 0; j < data.length; j++) {
      data[j] = (Math.random() * 2 - 1) * 0.2;
    }

    const src = ac.createBufferSource();
    src.buffer = buf;

    // ローパスフィルタで低く柔らかい音に
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900 + (i % 5) * 80;

    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    src.connect(lp).connect(gain).connect(ac.destination);
    src.start(t);
    src.stop(t + duration);
  }
}

/** パス音 — 短い低めのトーン（ポン） */
export function playPass(): void {
  const ac = getContext();
  const t = ac.currentTime;
  const duration = 0.15;

  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(300, t);
  osc.frequency.exponentialRampToValueAtTime(200, t + duration);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.25, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + duration);
}

/** ターン通知音 — 2音の短いチャイム（ピンポン） */
export function playTurnNotify(): void {
  const ac = getContext();
  const t = ac.currentTime;

  // 1音目: 高い音
  const osc1 = ac.createOscillator();
  osc1.type = "sine";
  osc1.frequency.value = 880;
  const g1 = ac.createGain();
  g1.gain.setValueAtTime(0.25, t);
  g1.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc1.connect(g1).connect(ac.destination);
  osc1.start(t);
  osc1.stop(t + 0.12);

  // 2音目: さらに高い音（少し遅延）
  const osc2 = ac.createOscillator();
  osc2.type = "sine";
  osc2.frequency.value = 1100;
  const g2 = ac.createGain();
  g2.gain.setValueAtTime(0.25, t + 0.13);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  osc2.connect(g2).connect(ac.destination);
  osc2.start(t + 0.13);
  osc2.stop(t + 0.28);
}

/** 鳴き音 — 派手な和風チャイム（ジャラン！） */
export function playNaki(): void {
  const ac = getContext();
  const t = ac.currentTime;

  // 低音ベース（ドン）
  const bass = ac.createOscillator();
  bass.type = "sine";
  bass.frequency.setValueAtTime(150, t);
  bass.frequency.exponentialRampToValueAtTime(80, t + 0.3);
  const bg = ac.createGain();
  bg.gain.setValueAtTime(0.3, t);
  bg.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  bass.connect(bg).connect(ac.destination);
  bass.start(t);
  bass.stop(t + 0.3);

  // 和音3連打（ジャラン）
  const notes = [523, 659, 784]; // C5, E5, G5
  notes.forEach((freq, i) => {
    const delay = i * 0.06;
    const osc = ac.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.3, t + delay);
    g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.4);
    osc.connect(g).connect(ac.destination);
    osc.start(t + delay);
    osc.stop(t + delay + 0.4);
  });

  // 高音キラキラ
  const sparkle = ac.createOscillator();
  sparkle.type = "sine";
  sparkle.frequency.value = 1568; // G6
  const sg = ac.createGain();
  sg.gain.setValueAtTime(0.2, t + 0.15);
  sg.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  sparkle.connect(sg).connect(ac.destination);
  sparkle.start(t + 0.15);
  sparkle.stop(t + 0.55);
}

/** 革命音 — ジャジャーン！ドラマチックなファンファーレ */
export function playRevolution(): void {
  const ac = getContext();
  const t = ac.currentTime;

  // 第1打: 低い不協和音（ジャッ）
  [130, 156, 185].forEach((freq) => {
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(g).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  });

  // 第2打: さらに低く（ジャッ）
  [110, 139, 165].forEach((freq) => {
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.25, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(g).connect(ac.destination);
    osc.start(t + 0.25);
    osc.stop(t + 0.5);
  });

  // 第3打: ジャーン！（メジャーコード長め）
  [220, 277, 330, 440].forEach((freq) => {
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2000;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.25, t + 0.55);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    osc.connect(lp).connect(g).connect(ac.destination);
    osc.start(t + 0.55);
    osc.stop(t + 1.4);
  });
}

/** 都落ち音 — じゃらーん！下降感のある没落サウンド */
export function playMiyakoOchi(): void {
  const ac = getContext();
  const t = ac.currentTime;

  // 第1打: 高めの不協和音（ジャッ）
  [330, 392, 466].forEach((freq) => {
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(g).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  });

  // 第2打: 下降（ジャッ）
  [260, 311, 370].forEach((freq) => {
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.25, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(g).connect(ac.destination);
    osc.start(t + 0.25);
    osc.stop(t + 0.5);
  });

  // 第3打: じゃらーん（マイナーコード、長く下降して没落感）
  [196, 233, 277, 330].forEach((freq) => {
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, t + 0.55);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 1.6);
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1500;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.25, t + 0.55);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    osc.connect(lp).connect(g).connect(ac.destination);
    osc.start(t + 0.55);
    osc.stop(t + 1.6);
  });
}

/** チャット通知音 — 低めの柔らかいトーン（ポコン） */
export function playChat(): void {
  const ac = getContext();
  const t = ac.currentTime;
  const duration = 0.12;

  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(440, t);
  osc.frequency.exponentialRampToValueAtTime(330, t + duration);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + duration);
}

/** カード出し音 — 短いノイズバースト（シュッ） */
export function playCard(): void {
  const ac = getContext();
  const t = ac.currentTime;
  const duration = 0.06;

  const buf = ac.createBuffer(1, ac.sampleRate * duration, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.4;
  }

  const src = ac.createBufferSource();
  src.buffer = buf;

  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 4000;
  bp.Q.value = 1.5;

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.35, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

  src.connect(bp).connect(gain).connect(ac.destination);
  src.start(t);
  src.stop(t + duration);
}
