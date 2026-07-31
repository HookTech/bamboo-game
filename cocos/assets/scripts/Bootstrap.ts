import { _decorator, Component, Node, Camera, DirectionalLight, Color, Vec3, view, ResolutionPolicy, resources, EffectAsset, Canvas } from 'cc';
import { GameState } from './core/GameState';
import { ScoreSystem } from './core/ScoreSystem';
import { InputAdapter } from './platform/InputAdapter';
import { Storage } from './platform/Storage';
import { CameraRig } from './view/CameraRig';
import { BambooMesh } from './view/BambooMesh';
import { PandaView } from './view/PandaView';
import { CoinView } from './view/CoinView';
import { SkyView } from './view/SkyView';
import { HUD } from './ui/HUD';
import { GameConfig as C, px2m } from './core/GameConfig';

const { ccclass } = _decorator;

/** 运行时构建全部节点 —— 场景里只需一个挂本脚本的空节点。 */
@ccclass('Bootstrap')
export class Bootstrap extends Component {
  protected state = new GameState();
  protected cam!: Camera;
  protected rig!: CameraRig;
  protected bamboo!: BambooMesh;
  protected panda!: PandaView;
  protected score!: ScoreSystem;
  private hud!: HUD;
  /** resources.loadDir 异步完成前 update 会先跑,未就绪时跳过。 */
  private ready = false;
  private lastBestCheck = 0;

  start(): void {
    // 先载入 resources/effects,再把 EffectAsset 引用交给材质。
    // 不能靠 effectName:'game-standard' —— 导入后注册名是路径形式,get 会 miss → 0 pass 材质。
    resources.loadDir('effects', EffectAsset, (err, assets) => {
      if (err) console.error('[Bootstrap] effect preload failed', err);
      if (!this.isValid) return;
      const list = assets ?? [];
      const effect = list.find((a) => a.name.includes('game-standard')) ?? list[0] ?? null;
      if (!effect) console.error('[Bootstrap] game-standard effect not found in resources/effects');
      this.buildScene(effect);
    });
  }

  private buildScene(effect: EffectAsset | null): void {
    view.setDesignResolutionSize(800, 600, ResolutionPolicy.FIXED_HEIGHT);

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
    this.rig.cam = this.cam;

    const skyNode = new Node('Sky');
    this.node.scene!.addChild(skyNode);
    const sky = skyNode.addComponent(SkyView);
    sky.state = this.state;
    sky.build(camNode, this.cam);

    const bambooRoot = new Node('BambooRoot');
    this.node.scene!.addChild(bambooRoot);
    bambooRoot.setPosition(px2m(C.BAMBOO_X_PX - C.DESIGN_W / 2), 0, 0);
    this.bamboo = bambooRoot.addComponent(BambooMesh);
    this.bamboo.state = this.state;
    this.bamboo.initMaterials(effect);

    const pandaNode = new Node('Panda');
    bambooRoot.addChild(pandaNode);
    this.panda = pandaNode.addComponent(PandaView);
    this.panda.bamboo = this.bamboo;
    this.panda.initMaterials(effect);
    this.panda.attach(this.state);

    this.score = new ScoreSystem(new Storage());

    const coinNode = new Node('Coins');
    this.node.scene!.addChild(coinNode);
    const coins = coinNode.addComponent(CoinView);
    coins.state = this.state;
    coins.rig = this.rig;
    coins.panda = this.panda;
    coins.initMaterials(effect);

    const canvasNode = new Node('Canvas');
    this.node.scene!.addChild(canvasNode);
    canvasNode.addComponent(Canvas);
    this.hud = canvasNode.addComponent(HUD);
    this.hud.build();
    this.hud.refresh(this.state, this.score);

    this.state.on('start', () => this.hud.showOverlay(false));
    this.state.on('grow', () => this.hud.refresh(this.state, this.score));
    this.state.on('stun', () => {
      this.rig.kick(14);
      this.hud.refresh(this.state, this.score);
    });

    coins.onPickup = (pos) => {
      const mult = this.score.pickup(this.state.combo);
      console.log(`[coin] +${mult} score=${this.score.score} coins=${this.score.coins}`);
      this.hud.floatText(`+${mult}`, pos, this.cam);
      this.hud.refresh(this.state, this.score);
    };

    new InputAdapter(() => {
      const r = this.state.press();
      if (r) console.log(`[press] combo=${r.combo} gain=${r.gainPx.toFixed(1)} stunned=${r.stunned}`);
      else console.log('[press] start/ignored');
      this.hud.refresh(this.state, this.score);
    }).attach();

    this.ready = true;
  }

  update(dt: number): void {
    if (!this.ready) return;
    dt = Math.min(dt, 0.05);
    this.state.update(dt);
    this.rig.follow(this.state.heightPx, dt);
    // 最高分每秒至多写一次;内存 bestMeters 由 HUD 每帧读 state 高度刷新
    if (this.state.t - this.lastBestCheck > 1) {
      this.lastBestCheck = this.state.t;
      this.score.updateBest(this.state.heightPx);
    }
    this.hud.refresh(this.state, this.score);
  }
}
