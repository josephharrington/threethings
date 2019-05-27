import {
    CurvePath,
    DoubleSide,
    Group,
    LineBasicMaterial,
    LineCurve3,
    LineSegments,
    Mesh,
    MeshLambertMaterial,
    MeshPhongMaterial,
    SphereGeometry,
    TubeBufferGeometry,
    Vector3
} from "three";
import * as dat from 'dat.gui';

import { AppPlugin } from './common';
import * as math from './math';


export class Spiro extends AppPlugin {
    // gui parameters - defaults
    resolution = 20;
    bigR = 252;
    // lilR = 231;
    // lilP = 60;
    loopRatio = 0.14; //60/231;  // lilp/lilr = 60/231
    // spinRatio = 231/252;  // lilR/bigR = 231/252
    spinNumer = 29; //11;  // lilR/bigR = 231/252
    spinDenom = 42; // 12;  // lilR/bigR = 231/252
    extrusionSegments = 1000;
    radiusSegments = 4;
    radius = 10;
    closed = true;
    showPts = false;
    oscMagnitude = -200;
    oscillations = 14;
    heightOffGround = 300;
    showWireframe = true;

    // calculated values
    private numRots = -1;
    private numPts = -1;
    private dt = -1;

    createGui(gui: dat.GUI, refreshWith: Function): void {
        const resetAll = refreshWith(() => this.init());
        const resetModel = refreshWith(() => this.updateModel());

        gui.add(this, 'resolution', 1, 100).step(1).onChange(resetAll);

        gui.add(this, 'bigR', 10, 500).step(1).onChange(resetAll);
        gui.add(this, 'loopRatio', 0, 5).onChange(resetAll);
        gui.add(this, 'spinNumer', 0, 100).step(1).onChange(resetAll);
        gui.add(this, 'spinDenom', 1, 100).step(1).onChange(resetAll);

        gui.add(this, 'extrusionSegments', 5, 10000).step(5).onChange(resetModel);
        gui.add(this, 'radiusSegments', 1, 32).step(1).onChange(resetModel);
        gui.add(this, 'radius', 1, 100).step(1).onChange(resetModel);
        gui.add(this, 'closed').onChange(resetModel);
        gui.add(this, 'showPts').onChange(resetModel);

        gui.add(this, 'oscMagnitude', -400, 400).onChange(resetModel);
        gui.add(this, 'oscillations', 0, 30).step(1).onChange(resetModel);

        gui.add(this, 'showWireframe').onChange(resetModel);
    }

    init(): Group {
        // const { bigR, lilR, resolution } = params;
        const { bigR, spinNumer, spinDenom, resolution } = this;
        const lilR = (spinNumer / spinDenom) * bigR;
        console.log(`lilR: ${lilR}`);
        const lcm = math.calcLcm(bigR, lilR);
        this.numRots = lcm / bigR;
        this.numPts = lcm / lilR;
        this.dt = this.numRots * 2 * Math.PI / (this.numPts * resolution);
        console.log("number of rotations: " + this.numRots);
        console.log("number of graph points: " + this.numPts);
        return this.updateModel();
    }

    updateModel(): Group {
        // const { bigR, lilR, lilP } = this.guiParams;
        const { bigR, loopRatio, spinNumer, spinDenom } = this;
        const spinRatio = spinNumer / spinDenom;
        if (this.numPts > 1000) {
            console.warn('cannot draw when numPts > 1000');
            return new Group();
        }
        const points = [];
        for (let t = 0.0; t - this.dt <= 2 * Math.PI * this.numRots; t += this.dt) {
            // const x = (bigR - lilR) * Math.cos(t) + lilP * Math.cos(t * (bigR - lilR) / lilR);
            // const y = (bigR - lilR) * Math.sin(t) - lilP * Math.sin(t * (bigR - lilR) / lilR);
            const x = bigR * ((1 - spinRatio) * Math.cos(t) + loopRatio * spinRatio * Math.cos(t * (1 - spinRatio) / spinRatio));
            const y = bigR * ((1 - spinRatio) * Math.sin(t) - loopRatio * spinRatio * Math.sin(t * (1 - spinRatio) / spinRatio));
            points.push(new Vector3(x, y, this.oscMagnitude * Math.cos( t * this.oscillations / this.numRots )));
        }

        const path: CurvePath<Vector3> = new CurvePath();
        for (let i = 1; i < points.length; i++) {
            path.add(new LineCurve3(points[i-1], points[i]));
        }

        const lineMaterial = new LineBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0.5 });
        const meshMaterial = new MeshPhongMaterial({
            color: 0x156289, emissive: 0x072534, side: DoubleSide, flatShading: true });
        const dotMaterial = new MeshLambertMaterial({
            color: 0xff00ff, transparent: true, opacity: 1 });

        const tubeGeometry = new TubeBufferGeometry(
            path, this.extrusionSegments, this.radius, this.radiusSegments, this.closed);

        const group = new Group();
        group.position.set(0, this.heightOffGround, 0);

        const mesh = new Mesh(tubeGeometry, meshMaterial);
        group.add(mesh);

        if (this.showWireframe) {
            const wireframe = new LineSegments(tubeGeometry, lineMaterial);
            group.add(wireframe);
        }

        if (this.showPts) {
            for (let i = 0; i < points.length; i++) {
                const sphere = new SphereGeometry(this.radius * 1.2, 8, 8);
                sphere.translate(points[i].x, points[i].y, points[i].z);
                const sphereMesh = new Mesh(sphere, dotMaterial);
                group.add(sphereMesh);
            }
        }

        return group;
    }
}
