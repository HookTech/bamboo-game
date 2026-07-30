declare const wx:
  | { getStorageSync(key: string): unknown; setStorageSync(key: string, value: string): void }
  | undefined;

/** wx.setStorageSync / localStorage 适配。任何后端异常都吞掉 —— 坏环境不崩游戏。 */
export class Storage {
  get(key: string): string | null {
    try {
      if (typeof wx !== 'undefined' && wx && wx.getStorageSync) {
        const v = wx.getStorageSync(key);
        return v === '' || v == null ? null : String(v);
      }
      const ls = (globalThis as { localStorage?: { getItem(k: string): string | null } }).localStorage;
      return ls ? ls.getItem(key) : null;
    } catch {
      return null;
    }
  }

  set(key: string, value: string): void {
    try {
      if (typeof wx !== 'undefined' && wx && wx.setStorageSync) {
        wx.setStorageSync(key, value);
        return;
      }
      const ls = (globalThis as { localStorage?: { setItem(k: string, v: string): void } }).localStorage;
      if (ls) ls.setItem(key, value);
    } catch {
      // 存储被拒/满 —— 最高分不持久化而已
    }
  }
}
