import { input, Input, EventKeyboard, EventTouch, KeyCode } from 'cc';

/** 键盘空格 / 触摸点按 → 统一的 press 回调。 */
export class InputAdapter {
  constructor(private onPress: () => void) {}

  attach(): void {
    input.on(Input.EventType.KEY_DOWN, this.keyDown, this);
    input.on(Input.EventType.TOUCH_START, this.touchStart, this);
  }

  detach(): void {
    input.off(Input.EventType.KEY_DOWN, this.keyDown, this);
    input.off(Input.EventType.TOUCH_START, this.touchStart, this);
  }

  private keyDown(e: EventKeyboard): void {
    if (e.keyCode === KeyCode.SPACE) this.onPress();
  }

  private touchStart(_e: EventTouch): void {
    this.onPress();
  }
}
