import * as dat from 'dat.gui'
import * as Three from 'three';

import { OrbitControls, STLExporter } from './three';


export interface AppPlugin {
    createGui(gui: dat.GUI, refreshWith: Function): void;
    update(): Three.Mesh;
}

// todo: move into class
let scene: Three.Scene,
    renderer: Three.WebGLRenderer,
    camera: Three.Camera,
    ground: Three.Mesh,
    lights: Array<Three.Light>,
    controls: any  // couldn't get OrbitControls working
;

const params = {
    enableFog: false,
    enableShadows: false
};

const CAM_HEIGHT = 300;

export class App {

    plugin: AppPlugin;
    exporter: any;  // couldn't get STLExporter type working
    gui: dat.GUI;
    mesh: Three.Mesh;

    constructor(plugin: AppPlugin) {
        this.plugin = plugin;

        this.exporter = new STLExporter();
        this.gui = null;
        this.mesh = null;

        this._initDownload();
        this._initScene();

        this.initGui(plugin);
        this.refreshMesh(() => plugin.update());
    }

    initGui(plugin: AppPlugin) {
        this.gui = new dat.GUI();

        plugin.createGui(this.gui,
            (genMesh: any) => () => this.refreshMesh(genMesh));  // todo: something better

        const sceneGui = this.gui.addFolder('Scene');
        sceneGui.add(params, 'enableFog').onChange(this._updateScene);
        sceneGui.add(params, 'enableShadows').onChange(this._updateScene);

        this.gui.add(this, 'saveStl');
    };


    refreshMesh(genNewMesh: Function) {
        this._destroyMesh();
        this._setMesh(genNewMesh());
    };

    _destroyMesh() {
        if (this.mesh) {
            scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh = null;
        }
    };

    _setMesh(mesh: Three.Mesh) {
        this._destroyMesh();
        if (mesh) {
            scene.add(mesh);
            this.mesh = mesh;
            camera.lookAt(mesh.position);
            controls.target = mesh.position;
            controls.update();
        }
    };


    _initScene() {
        // camera
        camera = new Three.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 10000);
        camera.position.set(0, CAM_HEIGHT, CAM_HEIGHT);

        // scene
        scene = new Three.Scene();
        scene.background = new Three.Color( 0xa0a0a0 );

        // light
        lights = [
            [0, CAM_HEIGHT, 0, 1],
            [300, CAM_HEIGHT, 300, 1.1],
            [-300, CAM_HEIGHT, -300, 1.1],

        ].map(([x, y, z, intensity]) => {
            const light = new Three.PointLight(0xffffff, intensity, 0);
            light.position.set(x, y, z);
            scene.add(light);
            return light;
        });

        // renderer
        renderer = new Three.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        // controls
        controls = new OrbitControls(camera, renderer.domElement);
        // controls.autoRotate = true;
        // controls.autoRotateSpeed = 0.5;
        // controls.update();

        // permanent objects
        ground = new Three.Mesh(
            new Three.PlaneBufferGeometry( 10000, 10000 ),
            new Three.MeshPhongMaterial( { color: 0x999999, depthWrite: false } ) );
        ground.rotation.x = - Math.PI / 2;
        scene.add( ground );

        this._updateScene();
    };

    _updateScene() {
        // fog
        scene.fog = params.enableFog ? new Three.FogExp2( 0xa0a0a0, 0.0005 ) : null;

        // shadow
        renderer.shadowMap.enabled = params.enableShadows;
        ground.receiveShadow = params.enableShadows;
        lights.forEach(light => light.castShadow = params.enableShadows);
        this.mesh && (this.mesh.castShadow = params.enableShadows);
    };

    saveStl() {
        const result = this.exporter.parse(this.mesh);
        this._saveString(result, 'box.stl');
    };

    startAnimating(fps: number) {
        const animator = new Animator(() => renderer.render(scene, camera));
        animator.start(fps);
    };

    _link: HTMLAnchorElement;

    _initDownload() {
        this._link = document.createElement('a');
        this._link.style.display = 'none';
        document.body.appendChild(this._link);
    };

    _saveString(text: string, filename: string) {
        this._save(new Blob([text], {type: 'text/plain'}), filename);
    };

    _save(blob: Blob, filename: string) {
        this._link.href = URL.createObjectURL( blob );
        this._link.download = filename;
        this._link.click();
    };


}

class Animator {
    renderFn: Function;
    fpsInterval: number;
    startTime: number;
    now: number;
    then: number;
    elapsed: number;

    constructor(renderFn: Function) {
        this.renderFn = renderFn;
    }

    start(fps: number) {
        this.fpsInterval = 1000 / fps;
        this.then = Date.now();
        this.startTime = this.then;
        this._animate();
    };

    _animate() {
        requestAnimationFrame(() => this._animate());

        this.now = Date.now();
        this.elapsed = this.now - this.then;

        if (this.elapsed > this.fpsInterval) {
            this.then = this.now - (this.elapsed % this.fpsInterval);
            this.renderFn();
            // controls.update();
        }
    }
}
