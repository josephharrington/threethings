import * as THREE from 'three';
import * as dat from 'dat.gui';

window.THREE = THREE;
require('three/examples/js/controls/OrbitControls');
require('three/examples/js/exporters/STLExporter');


let mesh, 
    wireframe, 
    scene, 
    renderer, 
    camera, 
    exporter,
    ground,
    lights,
    controls
    ;

// defaults
const params = {
    resolution: 20,
    bigR: 252,
    lilR: 231,
    lilP: 60,
    // ell: 0.26,  // lilp/lilr = 60/231
    // kay: 0.912,  // lilR/bigR = 231/252
    extrusionSegments: 500,
    radiusSegments: 8,
    radius: 10,
    closed: false,
    showPts: false,
    oscMagnitude: 50,
    oscSpeed: 0.2,
    oscillations: 3,

    enableFog: true,
    enableShadows: false,
    showWireframe: true,

    saveStl: saveStl,

};

const vals = {
    numRots: -1,
    numPts: -1,
    dt: -1,
};

function initGui() {
    exporter = new THREE.STLExporter();

    const gui = new dat.GUI();
    gui.add(params, 'resolution', 1, 100).step(1).onChange(updateMath);
    gui.add(params, 'bigR', 10, 1000).step(1).onChange(updateMath);
    gui.add(params, 'lilR', 10, 1000).step(1).onChange(updateMath);
    gui.add(params, 'lilP', 10, 1000).step(1).onChange(updateModel);

    gui.add(params, 'extrusionSegments', 5, 10000).step(5).onChange(updateModel);
    gui.add(params, 'radiusSegments', 1, 32).step(1).onChange(updateModel);
    gui.add(params, 'radius', 1, 100).step(1).onChange(updateModel);
    gui.add(params, 'closed').onChange(updateModel);
    gui.add(params, 'showPts').onChange(updateModel);

    gui.add(params, 'oscMagnitude', -200, 200).onChange(updateModel);
    gui.add(params, 'oscSpeed', 0, Math.PI / 2).onChange(updateModel);
    gui.add(params, 'oscillations', 0, 30).step(1).onChange(updateModel);

    gui.add(params, 'enableFog').onChange(updateScene);
    gui.add(params, 'enableShadows').onChange(updateScene);
    gui.add(params, 'showWireframe').onChange(updateModel);

    gui.add(params, 'saveStl');

    gui.open();
}

function updateMath() {
    const { bigR, lilR, ell, kay, resolution } = params;
    const lcm = calcLcm(bigR, lilR);
    vals.numRots = lcm / bigR;
    vals.numPts = lcm / lilR;
    vals.dt = vals.numRots * 2 * Math.PI / (vals.numPts * resolution);
    console.log("number of rotations: " + vals.numRots);
    console.log("number of graph points: " + vals.numPts);
    updateModel();
}

function updateModel() {
    if (mesh !== undefined) {
        scene.remove(mesh);
        mesh.geometry.dispose();
    }

    const { bigR, lilR, lilP } = params;
    const points = [];
    for (let t = 0.0; t - vals.dt <= 2 * Math.PI * vals.numRots; t += vals.dt) {
        const x = (bigR - lilR) * Math.cos(t) + lilP * Math.cos(t * (bigR - lilR) / lilR);
        const y = (bigR - lilR) * Math.sin(t) - lilP * Math.sin(t * (bigR - lilR) / lilR);
        points.push(new THREE.Vector3(x, y, params.oscMagnitude * Math.cos( t * params.oscillations / vals.numRots )));
    }

    const path = new THREE.CurvePath();
    for (let i = 1; i < points.length; i++) {
        path.add(new THREE.LineCurve3(points[i-1], points[i]));
    }
    
    var lineMaterial = new THREE.LineBasicMaterial({ 
        color: 0xffffff, transparent: true, opacity: 0.5 });
    var meshMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x156289, emissive: 0x072534, side: THREE.DoubleSide, flatShading: true });
    var dotMaterial = new THREE.MeshLambertMaterial({ 
        color: 0xff00ff, transparent: true, opacity: 1 });

    const tubeGeometry = new THREE.TubeBufferGeometry( 
        path, params.extrusionSegments, params.radius, params.radiusSegments, params.closed);
    mesh = new THREE.Mesh(tubeGeometry, meshMaterial);
    mesh.position.set(0, 200, 0);
    if (params.showWireframe) {
        wireframe = new THREE.LineSegments(tubeGeometry, lineMaterial);
        mesh.add(wireframe);
    }
    scene.add(mesh);

    // points
    if (params.showPts) {
        for (let i = 0; i < points.length; i++) {
            const sphere = new THREE.SphereGeometry(params.radius * 1.2, 8, 8);
            sphere.translate(points[i].x, points[i].y, points[i].z);
            const sphereMesh = new THREE.Mesh(sphere, dotMaterial);
            mesh.add(sphereMesh);
        }
    }
}

function updateScene() {
    // fog
    scene.fog = params.enableFog ? new THREE.FogExp2( 0xa0a0a0, 0.001 ) : null;

    // shadow
    renderer.shadowMap.enabled = params.enableShadows;
    ground.receiveShadow = params.enableShadows;
    lights.forEach(light => light.castShadow = params.enableShadows);
    mesh && (mesh.castShadow = params.enableShadows);
}

function init() {
    // camera
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 10000);
    camera.position.set(0, 300, 300);
    camera.lookAt(0, 200, 0);

    // scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0xa0a0a0 );

    // light
    lights = [
        [0, 200, 0], 
        [100, 200, 100], 
        [-100, -200, -100],

    ].map(([x, y, z]) => {
        const light = new THREE.PointLight(0xffffff, 1, 0);
        light.position.set(x, y, z);
        scene.add(light);
        return light;
    });

    // renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target = new THREE.Vector3(0, 200, 0);
    // controls.autoRotate = true;
    // controls.autoRotateSpeed = 0.5;
    controls.update();

    // permanent objects
    ground = new THREE.Mesh( 
        new THREE.PlaneBufferGeometry( 10000, 10000 ), 
        new THREE.MeshPhongMaterial( { color: 0x999999, depthWrite: false } ) );
    ground.rotation.x = - Math.PI / 2;
    scene.add( ground );

    updateScene();
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    // controls.update();
}

function saveStl() {
    const result = exporter.parse(mesh);
    saveString(result, 'box.stl');
}

function saveString(text, filename) {
    save(new Blob([text], {type: 'text/plain'}), filename);
}

const link = document.createElement('a');
link.style.display = 'none';
document.body.appendChild(link);

function save( blob, filename ) {
    link.href = URL.createObjectURL( blob );
    link.download = filename;
    link.click();
}

function calcGcd(a, b) {
    while (b > 0) {
        var temp = b;
        b = a % b;
        a = temp;
    }
    return a;
}

function calcLcm(a, b) {
    return a * (b / calcGcd(a, b));
}

function main() {
    init();
    initGui();
    updateMath();
    animate();
}


main();
