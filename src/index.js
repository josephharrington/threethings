import * as THREE from 'three';
import * as dat from 'dat.gui';

window.THREE = THREE;
require('three/examples/js/controls/OrbitControls');



const params = {
    resolution: 20,
    bigR: 300,
    lilR: 125,
    lilP: 90,
    extrusionSegments: 1000,
    radiusSegments: 16,
    radius: 20,
    closed: false,
    showPts: true,
};

const vals = {
    numRots: -1,
    numPts: -1,
    dt: -1,
};

var mesh, spheres, wireframe, scene, renderer, camera;

function initGui() {
    const gui = new dat.GUI();
    gui.add(params, 'resolution', 1, 50).step(1).onChange(updateMath);
    gui.add(params, 'bigR', 10, 1000).step(1).onChange(updateMath);
    gui.add(params, 'lilR', 10, 1000).step(1).onChange(updateMath);

    gui.add(params, 'lilP', 10, 1000).step(1).onChange(updateModel);
    gui.add(params, 'extrusionSegments', 5, 2000).step(5).onChange(updateModel);
    gui.add(params, 'radiusSegments', 1, 32).step(1).onChange(updateModel);
    gui.add(params, 'radius', 1, 100).step(1).onChange(updateModel);
    gui.add(params, 'closed').onChange(updateModel);
    gui.add(params, 'showPts').onChange(updateModel);
    gui.open();
}

function updateMath() {
    const { bigR, lilR, resolution } = params;
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
    if (spheres !== undefined) {
        spheres.forEach(sphere => {
            scene.remove(sphere);
            sphere.geometry.dispose();
        });
    }

    const { bigR, lilR, lilP } = params;
    const points = [];
    for (let t = 0.0; t + vals.dt/2 <= 2 * Math.PI * vals.numRots; t += vals.dt) {
        const x = (bigR - lilR) * Math.cos(t) + lilP * Math.cos(t * (bigR - lilR) / lilR);
        const y = (bigR - lilR) * Math.sin(t) - lilP * Math.sin(t * (bigR - lilR) / lilR);
        points.push(new THREE.Vector3(x, y, 50 * Math.cos( vals.numPts * t / (4 * vals.numRots))));
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
    
    spheres = [];
    if (params.showPts) {
        for (let i = 0; i < points.length; i++) {
            const sphere = new THREE.SphereGeometry(params.radius * 1.2, 8, 8);
            sphere.translate(points[i].x, points[i].y, points[i].z);
            const sphereMesh = new THREE.Mesh(sphere, dotMaterial);
            spheres.push(sphereMesh);
            scene.add(sphereMesh);
        }
    }

    const tubeGeometry = new THREE.TubeBufferGeometry( 
        path, params.extrusionSegments, params.radius, params.radiusSegments, params.closed);
    mesh = new THREE.Mesh(tubeGeometry, meshMaterial);
    wireframe = new THREE.LineSegments(tubeGeometry, lineMaterial);
    mesh.add(wireframe);
    scene.add(mesh);
}

function init() {
    // camera
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 10000);
    camera.position.set(0, 50, 500);

    // scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // light
    [
        [0, 200, 0], 
        [100, 200, 100], 
        [-100, -200, -100],

    ].forEach(([x, y, z]) => {
        const light = new THREE.PointLight(0xffffff, 1, 0);
        light.position.set(x, y, z);
        scene.add(light);
    });

    // renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // controls
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
}

function animate() {
    requestAnimationFrame(animate);
	renderer.render(scene, camera);
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
