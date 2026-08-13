import { _decorator, Component, resources, EffectAsset } from 'cc';
import { GameApp } from './app/GameApp';

const { ccclass } = _decorator;

@ccclass('Bootstrap')
export class Bootstrap extends Component {
  private app: GameApp | null = null;

  start(): void {
    resources.loadDir('effects', EffectAsset, (err, assets) => {
      if (err) console.error('[Bootstrap] effect preload failed', err);
      if (!this.isValid) return;
      const list = assets ?? [];
      const effect = list.find((a) => a.name.includes('game-standard')) ?? list[0] ?? null;
      if (!effect) console.error('[Bootstrap] game-standard effect not found in resources/effects');
      this.app = new GameApp(this);
      this.app.start(effect);
    });
  }

  update(dt: number): void {
    this.app?.update(dt);
  }
}
