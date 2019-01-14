import * as dat from 'dat.gui'
import * as Three from 'three';
import * as log from 'loglevel';

import { OrbitControls, STLExporter } from './three';
import {Object3D} from "three";
import {collectEntries} from "./util/collections";


export abstract class AppPlugin {
    createGui(gui: dat.GUI, refreshWith: Function): void { }
    abstract update(): Three.Group;
}

export interface Geometric extends Three.Object3D {
    geometry: Three.Geometry | Three.BufferGeometry;
}

export function isGeometric(obj: Three.Object3D): obj is Geometric {
    return obj != null && (<Geometric>obj).geometry !== undefined;
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
    gui: dat.GUI = null;
    group: Three.Group = null;
    pluginsMap: {[key: string]: AppPlugin};

    constructor(plugins: AppPlugin[]) {
        this._initDownload();
        this._initScene();

        this.pluginsMap = collectEntries(plugins, plugin => plugin.constructor.name);
        if (localStorage.getItem('selectedPlugin')) {
            params.selectedPlugin = localStorage.getItem('selectedPlugin');
        } else {
            params.selectedPlugin = Object.keys(this.pluginsMap)[0];
        }
        this._setPlugin();
    }

    _setPlugin() {
        this.initGui(this.pluginsMap[params.selectedPlugin]);
        this.refreshGroup(() => this.pluginsMap[params.selectedPlugin].update());
        localStorage.setItem('selectedPlugin', params.selectedPlugin);
    };

    initGui(plugin: AppPlugin) {
        this.gui && this.gui.destroy();
        this.gui = new dat.GUI();
        const setPlugin = () => this._setPlugin();

        plugin.createGui(this.gui,
            (getNewGroup: any) => () => this.refreshGroup(getNewGroup));  // todo: something better

        const sceneGui = this.gui.addFolder('Scene');
        sceneGui.add(params, 'enableFog').onChange(this._updateScene);
        sceneGui.add(params, 'enableShadows').onChange(this._updateScene);
        sceneGui.add(params, 'selectedPlugin', Object.keys(this.pluginsMap)).onChange(setPlugin);
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

    _setGroup(group: Three.Group) {
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
        camera = new Three.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 10000);
        if (localStorage.getItem('camPos') !== null) {
            const camPos = JSON.parse(localStorage.getItem('camPos'));
            camera.position.set(camPos.x, camPos.y, camPos.z);
        } else {
            camera.position.set(0, CAM_HEIGHT * 1.4, CAM_HEIGHT * 1.7);
        }

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
        controls.addEventListener('change', () => {
            localStorage.setItem('camPos', JSON.stringify(camera.position));
        });

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
    fpsInterval: number;
    startTime: number;
    now: number;
    then: number;
    elapsed: number;

    constructor(private renderFn: Function) { }

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
