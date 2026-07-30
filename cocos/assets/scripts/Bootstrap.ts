import { _decorator, Component, Node, Camera, DirectionalLight, Color, Vec3, view, ResolutionPolicy } from 'cc';
import { GameState } from './core/GameState';
import { InputAdapter } from './platform/InputAdapter';
import { CameraRig } from './view/CameraRig';
import { BambooMesh } from './view/BambooMesh';
import { GameConfig as C, px2m } from './core/GameConfig';

const { ccclass } = _decorator;

/** 运行时构建全部节点 —— 场景里只需一个挂本脚本的空节点。 */
@ccclass('Bootstrap')
export class Bootstrap extends Component {
  protected state = new GameState();
  protected cam!: Camera;
  protected rig!: CameraRig;
  protected bamboo!: BambooMesh;

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
    this.rig = camNode.addComponent(CameraRig);

    const bambooRoot = new Node('BambooRoot');
    this.node.scene!.addChild(bambooRoot);
    bambooRoot.setPosition(px2m(C.BAMBOO_X_PX - C.DESIGN_W / 2), 0, 0);
    this.bamboo = bambooRoot.addComponent(BambooMesh);
    this.bamboo.state = this.state;

    new InputAdapter(() => {
      const r = this.state.press();
      if (r) console.log(`[press] combo=${r.combo} gain=${r.gainPx.toFixed(1)} stunned=${r.stunned}`);
      else console.log('[press] start/ignored');
    }).attach();

    this.state.on('stun', () => this.rig.kick(14));
  }

  update(dt: number): void {
    dt = Math.min(dt, 0.05);
    this.state.update(dt);
    this.rig.follow(this.state.heightPx, dt);
  }
}
