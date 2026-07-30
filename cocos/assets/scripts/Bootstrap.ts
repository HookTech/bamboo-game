import { _decorator, Component, Node, Camera, DirectionalLight, Color, Vec3, view, ResolutionPolicy } from 'cc';
import { GameState } from './core/GameState';
import { InputAdapter } from './platform/InputAdapter';

const { ccclass } = _decorator;

/** 运行时构建全部节点 —— 场景里只需一个挂本脚本的空节点。 */
@ccclass('Bootstrap')
export class Bootstrap extends Component {
  protected state = new GameState();
  protected cam!: Camera;

  start(): void {
    view.setDesignResolutionSize(800, 600, ResolutionPolicy.FIT_HEIGHT);

    const lightNode = new Node('Sun');
    this.node.scene!.addChild(lightNode);
    lightNode.addComponent(DirectionalLight);
    lightNode.eulerAngles = new Vec3(-50, -30, 0);

    const camNode = new Node('Camera3D');
    this.node.scene!.addChild(camNode);
    this.cam = camNode.addComponent(Camera);
    this.cam.projection = Camera.ProjectionType.PERSPECTIVE;
    this.cam.fov = 30;
    this.cam.near = 0.5;
    this.cam.far = 300;
    this.cam.clearFlags = Camera.ClearFlag.SOLID_COLOR;
    this.cam.clearColor = new Color(88, 176, 240, 255);
    camNode.setPosition(-1.28, 4.4, 22.4);

    new InputAdapter(() => {
      const r = this.state.press();
      if (r) console.log(`[press] combo=${r.combo} gain=${r.gainPx.toFixed(1)} stunned=${r.stunned}`);
      else console.log('[press] start/ignored');
    }).attach();
  }

  update(dt: number): void {
    this.state.update(Math.min(dt, 0.05));
  }
}
