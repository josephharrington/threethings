import * as THREE from 'three';
import * as dat from 'dat.gui';

window.THREE = THREE;  // The following two libs require global THREE
require('three/examples/js/controls/OrbitControls');
require('three/examples/js/exporters/STLExporter');
export const Three = THREE;

let scene,
    renderer,
    camera,
    ground,
    lights,
    controls
;

const params = {
    enableFog: false,
    enableShadows: false
};

const CAM_HEIGHT = 300;

export function App() {
    this.exporter = new Three.STLExporter();
    this.gui = this._initGui();
    this.mesh = null;

    this._initDownload();
    this._initScene();
}

App.prototype.reset = function(genNewMesh) {
    this._resetMesh();
    this._setMesh(genNewMesh());
};

App.prototype._resetMesh = function() {
    if (this.mesh) {
        scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh = null;
    }
};

App.prototype._setMesh = function(mesh) {
    this._resetMesh();
    if (mesh) {
        scene.add(mesh);
        this.mesh = mesh;
        camera.lookAt(mesh.position);
    }
};

App.prototype._initScene = function() {
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
    controls = new Three.OrbitControls(camera, renderer.domElement);
    controls.target = new Three.Vector3(0, CAM_HEIGHT, 0);
    // controls.autoRotate = true;
    // controls.autoRotateSpeed = 0.5;
    controls.update();

    // permanent objects
    ground = new Three.Mesh(
        new Three.PlaneBufferGeometry( 10000, 10000 ),
        new Three.MeshPhongMaterial( { color: 0x999999, depthWrite: false } ) );
    ground.rotation.x = - Math.PI / 2;
    scene.add( ground );

    this.updateScene();
};

App.prototype.updateScene = function() {
    console.log('updateScene');
    // fog
    scene.fog = params.enableFog ? new Three.FogExp2( 0xa0a0a0, 0.0005 ) : null;

    // shadow
    renderer.shadowMap.enabled = params.enableShadows;
    ground.receiveShadow = params.enableShadows;
    lights.forEach(light => light.castShadow = params.enableShadows);
    this.mesh && (this.mesh.castShadow = params.enableShadows);
};

App.prototype.saveStl = function() {
    const result = this.exporter.parse(this.mesh);
    this._saveString(result, 'box.stl');
};


let fpsInterval, startTime, now, then, elapsed;

App.prototype.startAnimating = function(fps) {
    fpsInterval = 1000 / fps;
    then = Date.now();
    startTime = then;
    this.animate();
};


function animate() {
    requestAnimationFrame(animate);

    now = Date.now();
    elapsed = now - then;

    if (elapsed > fpsInterval) {
        then = now - (elapsed % fpsInterval);
        renderer.render(scene, camera);
        // controls.update();
    }
}

App.prototype.animate = animate;


App.prototype._initGui = function() {
    const gui = new dat.GUI();

    // todo: append to end?
    gui.add(params, 'enableFog').onChange(this.updateScene);
    gui.add(params, 'enableShadows').onChange(this.updateScene);
    gui.add(this, 'saveStl');

    gui.open();
    return gui;
};

App.prototype._initDownload = function() {
    this._link = document.createElement('a');
    this._link.style.display = 'none';
    document.body.appendChild(this._link);

};

App.prototype._saveString = function(text, filename) {
    this._save(new Blob([text], {type: 'text/plain'}), filename);
};

App.prototype._save = function(blob, filename) {
    this._link.href = URL.createObjectURL( blob );
    this._link.download = filename;
    this._link.click();
};

