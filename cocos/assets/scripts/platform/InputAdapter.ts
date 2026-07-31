import { input, Input, EventKeyboard, EventTouch, EventMouse, KeyCode, view } from 'cc';

/** 键盘空格 / 触摸 / 鼠标 → press(normX)。normX∈[-1,1]，中线=0；空格恒为 0。 */
export class InputAdapter {
  private lastFireMs = 0;

  constructor(private onPress: (normX: number) => void) {}

  attach(): void {
    input.on(Input.EventType.KEY_DOWN, this.keyDown, this);
    input.on(Input.EventType.TOUCH_START, this.touchStart, this);
    input.on(Input.EventType.MOUSE_DOWN, this.mouseDown, this);
  }

  detach(): void {
    input.off(Input.EventType.KEY_DOWN, this.keyDown, this);
    input.off(Input.EventType.TOUCH_START, this.touchStart, this);
    input.off(Input.EventType.MOUSE_DOWN, this.mouseDown, this);
  }

  private fire(normX: number): void {
    const now = Date.now();
    if (now - this.lastFireMs < 30) return;
    this.lastFireMs = now;
    this.onPress(normX);
  }

  private uiXToNormX(uiX: number): number {
    const w = view.getVisibleSize().width;
    if (w <= 0) return 0;
    const n = (uiX - w / 2) / (w / 2);
    return Math.max(-1, Math.min(1, n));
  }

  private keyDown(e: EventKeyboard): void {
    if (e.keyCode === KeyCode.SPACE) this.fire(0);
  }

  private touchStart(e: EventTouch): void {
    this.fire(this.uiXToNormX(e.getUILocation().x));
  }

  private mouseDown(e: EventMouse): void {
    this.fire(this.uiXToNormX(e.getUILocation().x));
  }
}
