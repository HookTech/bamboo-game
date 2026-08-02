declare const wx: { createWebAudioContext(): unknown } | undefined;

/** 程序化音效 —— 任何环境失败都静默降级(静音可玩)。 */
export class AudioFx {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ac: any = null;
  private failed = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ensure(): any {
    if (this.failed) return null;
    try {
      if (!this.ac) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = globalThis as Record<string, any>;
        if (typeof wx !== 'undefined' && wx && wx.createWebAudioContext) {
          this.ac = wx.createWebAudioContext();
        } else if (g.AudioContext || g.webkitAudioContext) {
          const AC = g.AudioContext ?? g.webkitAudioContext;
          this.ac = new AC();
        }
      }
      if (this.ac && this.ac.state === 'suspended') this.ac.resume();
      return this.ac;
    } catch {
      this.failed = true;
      return null;
    }
  }

  private tone(freq: number, dur: number, type: string, vol: number, when = 0, slide = 0): void {
    const ac = this.ensure();
    if (!ac) return;
    try {
      const o = ac.createOscillator(), g = ac.createGain();
      const t0 = ac.currentTime + when;
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(ac.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    } catch {
      this.failed = true;
    }
  }

  press(): void { this.tone(190 + Math.random() * 30, 0.09, 'triangle', 0.16, 0, -60); }
  bad(): void {
    this.tone(140, 0.18, 'sawtooth', 0.08, 0, -70);
    this.tone(98, 0.22, 'sawtooth', 0.07, 0.05, -40);
  }
  coin(combo: number): void {
    const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]; // C 大调五声音阶
    const i = Math.min(combo, PENTA.length - 1);
    this.tone(PENTA[i], 0.25, 'sine', 0.2);
    this.tone(PENTA[i] * 2, 0.18, 'sine', 0.06, 0.02);
  }

  /** 掉币:下行短音,区别拾币上行五声。 */
  coinDrop(): void {
    this.tone(320, 0.12, 'triangle', 0.14, 0, -180);
    this.tone(180, 0.16, 'sine', 0.1, 0.04, -80);
  }

  /** 撞飞动物。 */
  animalKnock(): void {
    this.tone(420, 0.1, 'square', 0.1, 0, -200);
    this.tone(260, 0.14, 'triangle', 0.08, 0.03, -120);
  }
}
