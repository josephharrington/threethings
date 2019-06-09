import * as dat from 'dat.gui'
import {
    BufferGeometry,
    Camera,
    Color,
    DirectionalLight,
    FogExp2,
    Geometry,
    Group,
    HemisphereLight, Light,
    LineSegments,
    Material,
    Mesh,
    MeshPhongMaterial,
    Object3D,
    PerspectiveCamera,
    PlaneBufferGeometry,
    PointLight,
    Scene,
    WebGLRenderer
} from 'three';
import * as log from 'loglevel';

import {OrbitControls, STLExporter} from './three';
import {collectEntries} from "./util/collections";


export abstract class AppPlugin {
    private readonly WIREFRAME = 'wireframe';

    createGui(gui: dat.GUI, refreshWith: Function): void { }
    abstract init(): Group;

    newMesh(
        geom: Geometry | BufferGeometry,
        meshMaterial: Material,
        lineMaterial: Material,
        showWireframe: boolean
    ): Mesh {
        const mesh = new Mesh(geom, meshMaterial);

        const wireframe = new LineSegments(geom, lineMaterial);
        wireframe.name = this.WIREFRAME;
        wireframe.visible = showWireframe;
        mesh.add(wireframe);

        return mesh;
    }

    replaceMeshGeom(
        mesh: Geometric, geom: Geometry | BufferGeometry,
        showWireframe: boolean
    ) {
        dispose(mesh);
        mesh.geometry = geom;

        const wireframeMesh = mesh.getObjectByName(this.WIREFRAME);
        if (!isGeometric(wireframeMesh)) {
            throw new Error(`Nongeometric wireframe: ${wireframeMesh}`);
        }
        wireframeMesh.geometry = geom;
        wireframeMesh.visible = showWireframe;
    }
}

export interface Geometric extends Object3D {
    geometry: Geometry | BufferGeometry;
}

export function isGeometric(obj: Object3D|null|undefined): obj is Geometric {
    return obj != null && (<Geometric>obj).geometry !== undefined;
}

// todo: move into class
let scene: Scene,
    renderer: WebGLRenderer,
    camera: Camera,
    ground: Mesh,
    lights: Array<Light>,
    controls: any  // couldn't get OrbitControls working
;

const params = {
    enableFog: false,
    enableShadows: false,
    selectedPlugin: 'none',
};

const CAM_HEIGHT = 300;

export function dispose(obj: Object3D) {
    if (obj == null) {
        return;
    }
    for (let child of obj.children) {
        dispose(child);
    }
    if (isGeometric(obj)) {
        obj.geometry.dispose();
    }
}

export class App {

    exporter: any = new STLExporter();  // couldn't get STLExporter type working
    gui: dat.GUI|null = null;
    group: Group|null = null;
    pluginsMap: {[key: string]: AppPlugin};

    constructor(plugins: AppPlugin[]) {
        this._initDownload();
        this._initScene();

        this.pluginsMap = collectEntries(plugins, plugin => plugin.constructor.name);
        const validValues = Object.keys(this.pluginsMap);
        if (localStorage.getItem('selectedPlugin')) {  // todo: abstract local storage saves
            const savedPlugin = localStorage.getItem('selectedPlugin') || 'none';
            if (validValues.includes(savedPlugin)) {
                params.selectedPlugin = savedPlugin;
            }
            log.debug(`Loaded saved plugin selection: ${params.selectedPlugin}`);
        }

        if (!validValues.includes(params.selectedPlugin)) {
            params.selectedPlugin = Object.keys(this.pluginsMap)[0];
            log.debug(`No saved plugin selection. Default: ${params.selectedPlugin}`);
        }
        this.initPlugin();
    }

    private initPlugin() {
        const plugin = this.pluginsMap[params.selectedPlugin];
        this.initGui(plugin);
        this.refreshGroup(() => plugin.init());
        localStorage.setItem('selectedPlugin', params.selectedPlugin);
        log.debug(`Saved plugin selection: ${params.selectedPlugin}`);
    };

    initGui(plugin: AppPlugin) {
        this.gui && this.gui.destroy();
        this.gui = new dat.GUI();

        plugin.createGui(this.gui,
            (getNewGroup: any) => () => this.refreshGroup(getNewGroup));  // todo: something better

        const sceneGui = this.gui.addFolder('Scene');
        sceneGui.add(params, 'enableFog').onChange(() => this._updateScene());
        sceneGui.add(params, 'enableShadows').onChange(() => this._updateScene());
        sceneGui.add(params, 'selectedPlugin', Object.keys(this.pluginsMap)).onChange(() => this.initPlugin());
        sceneGui.open();

        this.gui.add(this, 'saveStl');
    };

    refreshGroup(getNewGroup: Function) {
        console.group(`common.refreshGroup`);
        this._destroyGroup();
        this._setGroup(getNewGroup());
        console.groupEnd();
    };

    _destroyGroup() {
        log.debug(`common._destroyGroup [${this.group}]`);
        if (this.group) {
            scene.remove(this.group);
            dispose(this.group);
            this.group = null;
        }
    };

    _setGroup(group: Group) {
        log.debug(`common._setGroup [${group}]`);
        if (group) {
            scene.add(group);
            this.group = group;
            camera.lookAt(group.position);
            controls.target = group.position.clone();
            controls.update();
        }
    };


    _initScene() {
        log.debug('common._initScene');
        // camera
        camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 10000);
        const savedCamPos = localStorage.getItem('camPos');
        if (savedCamPos !== null) {
            const camPos = JSON.parse(savedCamPos);
            camera.position.set(camPos.x, camPos.y, camPos.z);
        } else {
            camera.position.set(0, CAM_HEIGHT * 1.4, CAM_HEIGHT * 1.7);
        }

        // renderer
        renderer = new WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        // controls
        controls = new OrbitControls(camera, renderer.domElement);
        controls.addEventListener('change', () => {
            localStorage.setItem('camPos', JSON.stringify(camera.position));
        });

        this._scene();
        this._updateScene();
    };

    _scene() {
        this._scene1();
        // this._scene2();
    }

    _updateScene() {
        this._updateScene1();
        // this._updateScene2();
    }

    _scene2() {
        scene = new Scene();
        scene.background = new Color( 0xAAAAAA );

        lights = [];
        let light;
        light = new HemisphereLight(0x94CB9C, 0x3EB9C3, 0.6);
        light.position.set(0, 10, 0);
        scene.add(light);
        lights.push(light);

        light = new DirectionalLight(0xFFFFFF, 0.25);
        light.position.set(5, 5, -7.5);
        light.shadow.mapSize.set(1024,1024);
        light.shadow.radius = 5;
        scene.add(light);
        lights.push(light);


    }

    _updateScene2() {
        renderer.shadowMap.enabled = params.enableShadows;
        lights.forEach(light => light.castShadow = params.enableShadows);
        this.group && (this.group.castShadow = params.enableShadows);
    }

    _scene1() {
        // scene
        scene = new Scene();
        scene.background = new Color( 0xa0a0a0 );

        // light
        lights = [
            [0, CAM_HEIGHT, 0, 1],
            [300, CAM_HEIGHT, 300, 1.1],
            [-300, CAM_HEIGHT, -300, 1.1],

        ].map(([x, y, z, intensity]) => {
            const light = new PointLight(0xffffff, intensity, 0);
            light.position.set(x, y, z);
            scene.add(light);
            return light;
        });

        // permanent objects
        ground = new Mesh(
            new PlaneBufferGeometry( 10000, 10000 ),
            new MeshPhongMaterial( { color: 0x999999, depthWrite: false } ) );
        ground.rotation.x = - Math.PI / 2;
        scene.add( ground );
    }

    _updateScene1() {
        // fog
        scene.fog = params.enableFog ? new FogExp2( 0xa0a0a0, 0.0002 ) : null;

        // shadow
        renderer.shadowMap.enabled = params.enableShadows;
        ground.receiveShadow = params.enableShadows;
        lights.forEach(light => light.castShadow = params.enableShadows);
        this.group && (this.group.castShadow = params.enableShadows);
    };

    saveStl() {
        const result = this.exporter.parse(this.group);
        this._saveString(result, 'box.stl');
    };

    startAnimating(fps: number) {
        const animator = new Animator(() => renderer.render(scene, camera));
        animator.start(fps);
    };

    _link: HTMLAnchorElement|null = null;

    _initDownload() {
        this._link = document.createElement('a');
        this._link.style.display = 'none';
        document.body.appendChild(this._link);
    };

    _saveString(text: string, filename: string) {
        this._save(new Blob([text], {type: 'text/plain'}), filename);
    };

    _save(blob: Blob, filename: string) {
        if (!this._link) {
            return;
        }
        this._link.href = URL.createObjectURL( blob );
        this._link.download = filename;
        this._link.click();
    };


}

class Animator {
    fpsInterval?: number;
    now?: number;
    then?: number;
    elapsed?: number;

    constructor(private renderFn: Function) { }

    start(fps: number) {
        this.fpsInterval = 1000 / fps;
        this.then = Date.now();
        this._animate();
    };

    _animate() {
        if (this.then == undefined || this.fpsInterval == undefined) {
            throw new Error('_animate() called without calling start() first')
        }
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
