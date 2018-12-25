import { Three } from './common.js';
import * as math from './math.js';

// defaults
const params = {
    resolution: 20,
    bigR: 252,
    // lilR: 231,
    // lilP: 60,
    loopRatio: 60/231,  // lilp/lilr = 60/231
    // spinRatio: 231/252,  // lilR/bigR = 231/252
    spinNumer: 11,  // lilR/bigR = 231/252
    spinDenom: 12,  // lilR/bigR = 231/252
    extrusionSegments: 500,
    radiusSegments: 8,
    radius: 10,
    closed: false,
    showPts: false,
    oscMagnitude: 50,
    oscillations: 3,

    showWireframe: true,
};

const vals = {
    numRots: -1,
    numPts: -1,
    dt: -1,
};

export const HEIGHT_OFF_GROUND = 300;

export function createGui(gui, refreshWith) {
    const resetAll = refreshWith(update);
    const resetModel = refreshWith(updateModel);

    gui.add(params, 'resolution', 1, 100).step(1).onChange(resetAll);

    gui.add(params, 'bigR', 10, 1000).step(1).onChange(resetAll);
    gui.add(params, 'loopRatio', 0, 5).onChange(resetAll);
    gui.add(params, 'spinNumer', 0, 100).step(1).onChange(resetAll);
    gui.add(params, 'spinDenom', 1, 100).step(1).onChange(resetAll);

    gui.add(params, 'extrusionSegments', 5, 10000).step(5).onChange(resetModel);
    gui.add(params, 'radiusSegments', 1, 32).step(1).onChange(resetModel);
    gui.add(params, 'radius', 1, 100).step(1).onChange(resetModel);
    gui.add(params, 'closed').onChange(resetModel);
    gui.add(params, 'showPts').onChange(resetModel);

    gui.add(params, 'oscMagnitude', -200, 200).onChange(resetModel);
    gui.add(params, 'oscillations', 0, 30).step(1).onChange(resetModel);

    gui.add(params, 'showWireframe').onChange(resetModel);
}

export function update() {
    // const { bigR, lilR, resolution } = params;
    const { bigR, spinNumer, spinDenom, resolution } = params;
    const lilR = (spinNumer / spinDenom) * bigR;
    console.log(`lilR: ${lilR}`);
    const lcm = math.calcLcm(bigR, lilR);
    vals.numRots = lcm / bigR;
    vals.numPts = lcm / lilR;
    vals.dt = vals.numRots * 2 * Math.PI / (vals.numPts * resolution);
    console.log("number of rotations: " + vals.numRots);
    console.log("number of graph points: " + vals.numPts);
    return updateModel();
}

export function updateModel() {
    // const { bigR, lilR, lilP } = params;
    const { bigR, loopRatio, spinNumer, spinDenom } = params;
    const spinRatio = spinNumer / spinDenom;
    if (vals.numPts > 1000) {
        return;
    }
    const points = [];
    for (let t = 0.0; t - vals.dt <= 2 * Math.PI * vals.numRots; t += vals.dt) {
        // const x = (bigR - lilR) * Math.cos(t) + lilP * Math.cos(t * (bigR - lilR) / lilR);
        // const y = (bigR - lilR) * Math.sin(t) - lilP * Math.sin(t * (bigR - lilR) / lilR);
        const x = bigR * ((1 - spinRatio) * Math.cos(t) + loopRatio * spinRatio * Math.cos(t * (1 - spinRatio) / spinRatio));
        const y = bigR * ((1 - spinRatio) * Math.sin(t) - loopRatio * spinRatio * Math.sin(t * (1 - spinRatio) / spinRatio));
        points.push(new Three.Vector3(x, y, params.oscMagnitude * Math.cos( t * params.oscillations / vals.numRots )));
    }

    const path = new Three.CurvePath();
    for (let i = 1; i < points.length; i++) {
        path.add(new Three.LineCurve3(points[i-1], points[i]));
    }
    
    var lineMaterial = new Three.LineBasicMaterial({ 
        color: 0xffffff, transparent: true, opacity: 0.5 });
    var meshMaterial = new Three.MeshPhongMaterial({ 
        color: 0x156289, emissive: 0x072534, side: Three.DoubleSide, flatShading: true });
    var dotMaterial = new Three.MeshLambertMaterial({ 
        color: 0xff00ff, transparent: true, opacity: 1 });

    const tubeGeometry = new Three.TubeBufferGeometry( 
        path, params.extrusionSegments, params.radius, params.radiusSegments, params.closed);
    const mesh = new Three.Mesh(tubeGeometry, meshMaterial);
    mesh.position.set(0, HEIGHT_OFF_GROUND, 0);
    if (params.showWireframe) {
        const wireframe = new Three.LineSegments(tubeGeometry, lineMaterial);
        mesh.add(wireframe);
    }

    // points
    if (params.showPts) {
        for (let i = 0; i < points.length; i++) {
            const sphere = new Three.SphereGeometry(params.radius * 1.2, 8, 8);
            sphere.translate(points[i].x, points[i].y, points[i].z);
            const sphereMesh = new Three.Mesh(sphere, dotMaterial);
            mesh.add(sphereMesh);
        }
    }

    return mesh;
}

