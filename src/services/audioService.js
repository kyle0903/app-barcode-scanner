class AudioService {
  constructor() {
    this.audioContext = null;
    this.master = null;
    this.currentVolume = 1;
    this.noiseBuffer = null;
    this.soundConfigs = {
      success: {
        gap: 0.09,
        sA: (t) =>
          this.tone(
            {
              freq: 660,
              dur: 0.18,
              wave: "triangle",
              gain: 0.9,
              overtones: [{ mul: 2, gain: 0.12 }],
              filter: { type: "lowpass", frequency: 4600, Q: 0.7 },
              env: { attack: 0.003, decay: 0.1, sustain: 0, release: 0.16 },
            },
            t
          ),
        sB: (t) =>
          this.tone(
            {
              freq: 990,
              dur: 0.24,
              wave: "triangle",
              gain: 0.95,
              overtones: [
                { mul: 2, gain: 0.1 },
                { mul: 3, gain: 0.05 },
              ],
              filter: { type: "lowpass", frequency: 5200, Q: 0.9 },
              env: { attack: 0.003, decay: 0.12, sustain: 0, release: 0.2 },
            },
            t
          ),
      },
      error: {
        gap: 0.12,
        eA: (t) =>
          this.tone(
            {
              freq: 330,
              dur: 0.25,
              wave: "square",
              gain: 0.9,
              filter: { type: "lowpass", frequency: 1000, Q: 0.5 },
              env: { attack: 0.002, decay: 0.1, sustain: 0, release: 0.1 },
            },
            t
          ),
        eB: (t) =>
          this.tone(
            {
              freq: 220,
              dur: 0.25,
              wave: "square",
              gain: 0.85,
              filter: { type: "lowpass", frequency: 800, Q: 0.5 },
              env: { attack: 0.002, decay: 0.1, sustain: 0, release: 0.1 },
            },
            t
          ),
      },
    };
  }

  // 初始化音效系統
  init() {
    try {
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      this.master = this.audioContext.createGain();
      this.master.gain.value = this.currentVolume;
      this.master.connect(this.audioContext.destination);
      this.noiseBuffer = this.#createNoiseBuffer();
    } catch (error) {
      console.warn("音效系統初始化失敗:", error);
    }
  }

  // 確保音效系統已啟動（處理瀏覽器自動播放限制）
  ensureAudioContext() {
    if (this.audioContext && this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }
  }

  // 產生音效 (舊版簡單方波)
  generateTone(frequency, duration, volume = this.currentVolume) {
    if (!this.audioContext) return;

    this.ensureAudioContext();

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = "square";

      gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + duration
      );

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch (error) {
      console.warn("音效播放失敗:", error);
    }
  }

  // 可疊加泛音/濾波/滑音的合成音
  tone(
    {
      freq = 440,
      dur = 0.2,
      wave = "sine",
      gain = 0.9,
      overtones = [],
      filter = null,
      glide = null,
      env = { attack: 0.004, decay: 0.08, sustain: 0.0, release: 0.08 },
    },
    when = this.#now()
  ) {
    if (!this.audioContext) return;
    this.ensureAudioContext();
    const fanOut = this.audioContext.createGain();
    fanOut.gain.value = 1.0;
    let last = fanOut;
    if (filter) {
      const biq = this.audioContext.createBiquadFilter();
      biq.type = filter.type || "lowpass";
      biq.frequency.setValueAtTime(filter.frequency ?? 4000, when);
      biq.Q.setValueAtTime(filter.Q ?? 0.7, when);
      fanOut.connect(biq);
      last = biq;
    }
    const g = this.audioContext.createGain();
    last.connect(g);
    g.connect(this.master);
    const peak = Math.max(0.0001, this.currentVolume * gain);
    const end = when + dur;
    const { attack, decay, sustain, release } = env;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peak, when + attack);
    g.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, peak * (sustain > 0 ? sustain : 0.35)),
      Math.min(end, when + attack + Math.max(0.02, decay))
    );
    g.gain.exponentialRampToValueAtTime(
      0.0001,
      Math.max(when + attack + decay + 0.01, end - Math.max(0.02, release))
    );
    // fundamental
    const osc = this.audioContext.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, when);
    if (glide) {
      const to = Math.max(1, glide.to);
      const t = Math.max(0.01, Math.min(dur - 0.02, glide.time ?? dur * 0.6));
      osc.frequency.linearRampToValueAtTime(to, when + t);
    }
    osc.connect(fanOut);
    osc.start(when);
    osc.stop(end);
    // overtones
    for (const ot of overtones) {
      const o = this.audioContext.createOscillator();
      o.type = wave;
      o.frequency.setValueAtTime(freq * (ot.mul ?? 2), when);
      if (glide) {
        const to = Math.max(1, glide.to * (ot.mul ?? 2));
        const t = Math.max(0.01, Math.min(dur - 0.02, glide.time ?? dur * 0.6));
        o.frequency.linearRampToValueAtTime(to, when + t);
      }
      const og = this.audioContext.createGain();
      og.gain.value = ot.gain ?? 0.1;
      o.connect(og).connect(fanOut);
      o.start(when);
      o.stop(end);
    }
  }

  // 低頻 thud（帶噪聲）
  thud(
    {
      baseFreq = 180,
      dur = 0.18,
      gain = 1.0,
      noiseGain = 0.35,
      cutoff = 450,
      q = 0.8,
      dropTo = 0.65,
    },
    when = this.#now()
  ) {
    if (!this.audioContext) return;
    this.ensureAudioContext();
    const end = when + dur;
    const o = this.audioContext.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(baseFreq, when);
    o.frequency.exponentialRampToValueAtTime(
      Math.max(30, baseFreq * dropTo),
      Math.min(end, when + dur * 0.75)
    );
    const og = this.audioContext.createGain();
    og.gain.setValueAtTime(this.currentVolume * gain, when);
    og.gain.exponentialRampToValueAtTime(
      0.0001,
      Math.max(when + 0.02, end - 0.02)
    );
    o.connect(og).connect(this.master);
    o.start(when);
    o.stop(end);
    // 噪聲
    const src = this.audioContext.createBufferSource();
    src.buffer = this.noiseBuffer;
    const biq = this.audioContext.createBiquadFilter();
    biq.type = "lowpass";
    biq.frequency.setValueAtTime(cutoff, when);
    biq.Q.setValueAtTime(q, when);
    const ng = this.audioContext.createGain();
    ng.gain.setValueAtTime(this.currentVolume * noiseGain, when);
    ng.gain.exponentialRampToValueAtTime(
      0.0001,
      Math.max(when + 0.02, end - 0.02)
    );
    src.connect(biq).connect(ng).connect(this.master);
    src.start(when);
    src.stop(end);
  }

  // 高頻/氣泡感噪聲（做「叮」的空氣感）
  noiseBurst(
    { dur = 0.12, gain = 0.25, type = "highpass", freq = 1800, Q = 0.7 },
    when = this.#now()
  ) {
    if (!this.audioContext) return;
    const end = when + dur;
    const src = this.audioContext.createBufferSource();
    src.buffer = this.noiseBuffer;
    const biq = this.audioContext.createBiquadFilter();
    biq.type = type;
    biq.frequency.setValueAtTime(freq, when);
    biq.Q.setValueAtTime(Q, when);
    const g = this.audioContext.createGain();
    g.gain.setValueAtTime(this.currentVolume * gain, when);
    g.gain.exponentialRampToValueAtTime(
      0.0001,
      Math.max(when + 0.02, end - 0.02)
    );
    src.connect(biq).connect(g).connect(this.master);
    src.start(when);
    src.stop(end);
  }

  pair(playA, playB, gap = 0.08) {
    if (!this.audioContext) return;
    const t0 = this.#now() + 0.01;
    playA(t0);
    playB(t0 + gap);
  }

  #createNoiseBuffer() {
    const sr = this.audioContext.sampleRate || 48000;
    const len = sr * 1.0;
    const buf = this.audioContext.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  #now() {
    return this.audioContext ? this.audioContext.currentTime : 0;
  }

  // 播放成功音效 (使用玻璃柔音)
  playSuccessSound() {
    this.pair(
      this.soundConfigs.success.sA,
      this.soundConfigs.success.sB,
      this.soundConfigs.success.gap
    );
  }

  // 播放錯誤音效 (使用 Retro buzz down)
  playErrorSound() {
    this.pair(
      this.soundConfigs.error.eA,
      this.soundConfigs.error.eB,
      this.soundConfigs.error.gap
    );
  }

  // 播放重複音效 (保持原版)
  playDuplicateSound() {
    this.generateTone(500, 0.3, this.currentVolume);
    setTimeout(() => this.generateTone(500, 0.3, this.currentVolume), 300);
  }

  // 設定音量
  setVolume(volume) {
    this.currentVolume = Math.max(0, Math.min(1, volume));
    if (this.master)
      this.master.gain.setTargetAtTime(
        this.currentVolume,
        this.audioContext.currentTime,
        0.01
      );
  }

  // 獲取當前音量
  getVolume() {
    return this.currentVolume;
  }
}

export const audioService = new AudioService();
