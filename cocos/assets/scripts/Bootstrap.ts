import {
  _decorator, Component, Node, Camera, DirectionalLight, Color, Vec3, view,
  ResolutionPolicy, resources, EffectAsset, Canvas, Layers, assetManager, Prefab, instantiate,
} from 'cc';
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
import { AudioFx } from './fx/AudioFx';
import { ParticleFx } from './fx/ParticleFx';
import { GameConfig as C, px2m } from './core/GameConfig';

const { ccclass } = _decorator;

/** Kenney 植被 Prefab UUID(meta),预览比 bundle 路径更稳 */
const TREE_PREFAB_UUID = '5d39d5d5-0cd9-4c57-be37-b943946e6492@f7340';
const GRASS_PREFAB_UUID = '37d1b96d-7347-4bb7-9ba5-7ad22b2baca4@0a8bf';

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
  private audioFx = new AudioFx();
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
    // 3D 相机不要画 UI,否则 Canvas 会劫持透视相机 → 全屏糊成放大字体
    this.cam.visibility = Layers.Enum.DEFAULT;
    this.rig = camNode.addComponent(CameraRig);
    this.rig.cam = this.cam;

    const skyNode = new Node('Sky');
    this.node.scene!.addChild(skyNode);
    const sky = skyNode.addComponent(SkyView);
    sky.state = this.state;
    sky.build(camNode, this.cam);

    this.spawnVegetation();

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

    const fxNode = new Node('FX');
    this.node.scene!.addChild(fxNode);
    const fx = fxNode.addComponent(ParticleFx);
    fx.state = this.state;
    fx.panda = this.panda;
    fx.rig = this.rig;
    fx.initMaterials(effect);

    // 独立正交 UI 相机(只清深度,颜色留给 3D 相机)
    const uiCamNode = new Node('UICamera');
    this.node.scene!.addChild(uiCamNode);
    const uiCam = uiCamNode.addComponent(Camera);
    uiCam.projection = Camera.ProjectionType.ORTHO;
    uiCam.orthoHeight = C.DESIGN_H / 2;
    uiCam.near = 1;
    uiCam.far = 2000;
    uiCam.priority = 1;
    uiCam.clearFlags = Camera.ClearFlag.DEPTH_ONLY;
    uiCam.visibility = Layers.Enum.UI_2D;
    uiCamNode.setPosition(0, 0, 1000);

    const canvasNode = new Node('Canvas');
    this.node.scene!.addChild(canvasNode);
    canvasNode.layer = Layers.Enum.UI_2D;
    const canvas = canvasNode.addComponent(Canvas);
    canvas.cameraComponent = uiCam;
    canvas.alignCanvasWithScreen = true;
    this.hud = canvasNode.addComponent(HUD);
    this.hud.build();
    this.hud.refresh(this.state, this.score);

    this.state.on('start', () => this.hud.showOverlay(false));
    this.state.on('grow', () => {
      this.audioFx.press();
      fx.splashLeaves();
      this.hud.refresh(this.state, this.score);
    });
    this.state.on('stun', () => {
      this.audioFx.bad();
      this.rig.kick(14);
      this.hud.refresh(this.state, this.score);
    });

    coins.onPickup = (pos) => {
      const mult = this.score.pickup(this.state.combo);
      console.log(`[coin] +${mult} score=${this.score.score} coins=${this.score.coins}`);
      this.audioFx.coin(this.state.combo);
      fx.burst(pos);
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

  /** 地面树/草地:缺失模型时静默跳过,不影响可玩。 */
  private spawnVegetation(): void {
    const bg = new Node('BgVegetation');
    this.node.scene!.addChild(bg);

    const placeTrees = (prefab: Prefab): void => {
      if (!this.isValid || !bg.isValid) return;
      for (let i = 0; i < 6; i++) {
        const t = instantiate(prefab);
        bg.addChild(t);
        t.setPosition(-6 + i * 2.4, 0, -3 - (i % 3) * 2);
        const sc = 0.8 + (i % 3) * 0.4;
        t.setScale(sc, sc, sc);
      }
      console.log('[Bootstrap] trees ready: 6');
    };

    const placeGrass = (prefab: Prefab): void => {
      if (!this.isValid || !bg.isValid) return;
      for (let i = 0; i < 8; i++) {
        const g = instantiate(prefab);
        bg.addChild(g);
        g.setPosition(-5 + (i % 4) * 2.8, 0, -1.5 - Math.floor(i / 4) * 2.2);
        const sc = 2.2 + (i % 3) * 0.4;
        g.setScale(sc, 1, sc);
      }
      console.log('[Bootstrap] grass ready: 8');
    };

    assetManager.loadAny({ uuid: TREE_PREFAB_UUID }, (err, asset) => {
      if (!this.isValid) return;
      if (!err && asset instanceof Prefab) {
        placeTrees(asset);
        return;
      }
      assetManager.loadBundle('models', (e2, bundle) => {
        if (!this.isValid || e2 || !bundle) return;
        bundle.load('tree_a', Prefab, (e3, prefab) => {
          if (!e3 && prefab) placeTrees(prefab);
        });
      });
    });

    assetManager.loadAny({ uuid: GRASS_PREFAB_UUID }, (err, asset) => {
      if (!this.isValid) return;
      if (!err && asset instanceof Prefab) {
        placeGrass(asset);
        return;
      }
      assetManager.loadBundle('models', (e2, bundle) => {
        if (!this.isValid || e2 || !bundle) return;
        bundle.load('grass_a', Prefab, (e3, prefab) => {
          if (!e3 && prefab) placeGrass(prefab);
        });
      });
    });
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
