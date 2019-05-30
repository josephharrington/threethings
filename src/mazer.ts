import {
    BufferGeometry,
    CurvePath,
    DoubleSide, ExtrudeBufferGeometry, Geometry,
    Group,
    LineBasicMaterial,
    LineCurve3,
    Mesh,
    MeshPhongMaterial, Shape, ShapeBufferGeometry,
    TubeBufferGeometry, Vector2,
    Vector3
} from "three";
import * as dat from 'dat.gui';

import { AppPlugin } from './common';
import {randomNormal} from "./util/random";
import {closestPointOnSegment} from "./util/geometry";

const ITERATION_DELAY = 30;

export class Mazer extends AppPlugin {
    private readonly MESH_TUBE = 'MESH_TUBE';
    private readonly MESH_SHAPE = 'MESH_SHAPE';
    private readonly MESH_TYPES = [this.MESH_TUBE, this.MESH_SHAPE];

    heightOffGround = 300;
    intId: number|undefined = undefined;
    isIterating = false;

    // gui parameters - defaults
    numPts = 300;
    bigR = 330;
    extrusionSegments = 500;
    radiusSegments = 5;
    radius = 10;
    closed = true;
    showPts = false;
    showWireframe = true;
    speed = 5;
    meshType = this.MESH_SHAPE;

    lineMaterial = new LineBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.5 });
    meshMaterial = new MeshPhongMaterial({
        color: 0x156289, emissive: 0x072534, side: DoubleSide, flatShading: true });
    // dotMaterial = new MeshLambertMaterial({
    //     color: 0xff00ff, transparent: true, opacity: 1 });

    group: Group|null = null;
    maze: Maze = new Maze();

    createGui(gui: dat.GUI, refreshWith: Function): void {
        const init = refreshWith(() => this.init());
        const regenMesh = refreshWith(() => this.regenMesh());

        gui.add(this, 'extrusionSegments', 5, 10000).step(5).onChange(regenMesh);
        gui.add(this, 'radiusSegments', 1, 32).step(1).onChange(regenMesh);
        gui.add(this, 'radius', 1, 100).step(1).onChange(regenMesh);
        gui.add(this, 'closed').onChange(regenMesh);
        gui.add(this, 'showPts').onChange(regenMesh);
        gui.add(this, 'showWireframe').onChange(regenMesh);
        gui.add(this, 'speed', 1, 20).step(1).onChange(regenMesh);
        gui.add(this, 'meshType', this.MESH_TYPES).onChange(regenMesh);

        const mazeGui = gui.addFolder('Maze');
        this.maze.createGui(mazeGui);
        mazeGui.__controllers.forEach(c => c.onChange(regenMesh));
        mazeGui.open();

        gui.add(this, 'bigR', 10, 500).step(1).onChange(init);
        gui.add(this, 'numPts', 1, 500).step(1).onChange(init);
        gui.add({init}, 'init');
        gui.add(this, 'iterate');
        gui.add(this, 'toggleIteration');
    }

    init(): Group {
        this.toggleIteration(false);
        this.group = new Group();
        this.group.position.set(0, this.heightOffGround, 0);

        this.maze.setCurves([this.initialPoints()]);
        const mesh = this.generateMesh(this.maze);
        this.group.add(mesh);

        return this.group;
    }

    private regenMesh() {
        if (!this.group) throw new Error('null group');
        if (!this.maze) throw new Error('null maze');
        const mesh = this.generateMesh(this.maze);
        this.group.remove(...this.group.children);
        this.group.add(mesh);
        return this.group;
    }

    private iterate(numSteps=1) {
        console.group();
        if (!this.maze) throw new Error('null maze');
        for (let i = 0; i < numSteps; i++) {
            this.maze.step();
            console.log({numPts: this.maze.getCurves()[0].length});
        }
        console.groupEnd();
        this.regenMesh();
    }

    private toggleIteration(targetState?: boolean) {
        this.isIterating = (targetState !== undefined) ? targetState : !this.isIterating;
        if (this.intId) {
            clearInterval(this.intId);
            this.intId = undefined;
        }
        if (this.isIterating) {
            this.intId = setInterval(() => {
                this.iterate(this.speed);
            }, ITERATION_DELAY);
        }
    }

    private generateMesh(maze: Maze): Mesh {
        const geom = this.createGeometry(maze.getCurves()[0]);
        return this.newMesh(geom, this.meshMaterial, this.lineMaterial, this.showWireframe);
    }

    private createGeometry(points: Vector3[]): Geometry | BufferGeometry {
        if (this.meshType === this.MESH_SHAPE) {
            return this.createShapeGeometry(points);
        } else if (this.meshType === this.MESH_TUBE) {
            return this.createTubeGeometry(points);
        }
        throw new Error('Invalid mesh type. Valid types are :' + this.MESH_TYPES);
    }

    private createShapeGeometry(points: Vector3[]): Geometry | BufferGeometry {
        const to2d = (v: Vector3): Vector2 => new Vector2(v.x, v.z);
        return (new ExtrudeBufferGeometry(new Shape(points.map(to2d)), {
            steps: 1,
            curveSegments: 20,
            depth: 20,
            bevelEnabled: true,
            bevelThickness: 6 ,
            bevelSegments: 3,
        })).rotateX(Math.PI/2);
    }

    private createTubeGeometry(points: Vector3[]): Geometry | BufferGeometry {
        const path: CurvePath<Vector3> = new CurvePath();
        for (let i = 1; i < points.length; i++) {
            path.add(new LineCurve3(points[i-1], points[i]));
        }
        path.add(new LineCurve3(points[points.length-1], points[0]));
        return new TubeBufferGeometry(
            path, this.extrusionSegments, this.radius, this.radiusSegments, this.closed)
    }

    private initialPoints(): Vector3[] {
        const points: Vector3[] = [];
        for (let i = 0; i < this.numPts; i++) {
            const t = 2*Math.PI * i/this.numPts;
            const x = this.bigR * Math.cos(t);
            const y = this.bigR * Math.sin(t);
            points.push(new Vector3(x, 0, y));
        }
        return points;
    }
}

/**
 * http://www.dgp.toronto.edu/~karan/artexhibit/mazes.pdf
 */
class Maze {
    private curves: Vector3[][] = [];

    private N_MIN = 3;
    private R1 = 100;
    private SIGMA = 1.1;
    private DELTA = 1;
    private BROWNING_AMP = 3;
    private SAMPLING_RATE = 1;
    private FAIRING_AMPLITUDE = 0.1;
    private ATTR_REPEL_AMPLITUDE = 1;
    private kMax = 70;
    private kMin = 5;

    createGui(gui: dat.GUI): void {
        gui.add(this, 'N_MIN', 0, 30).step(1);
        gui.add(this, 'R1', 1, 200).step(1);
        gui.add(this, 'DELTA', 0.9, 2).step(0.01);
        gui.add(this, 'SIGMA', 0, 3).step(0.01);
        gui.add(this, 'BROWNING_AMP', 0, 20);
        gui.add(this, 'SAMPLING_RATE', 0, 10);
        gui.add(this, 'FAIRING_AMPLITUDE', 0, 1).step(0.01);
        gui.add(this, 'ATTR_REPEL_AMPLITUDE', 0, 10);
        gui.add(this, 'kMax', 0, 200);
        gui.add(this, 'kMin', 0, 200);
    }

    setCurves(curves: Vector3[][]) {
        this.curves = curves;
    }

    getCurves(): Vector3[][] {
        return this.curves;
    }

    step(): Vector3[] {
        const currPoints = this.curves[0].map(this.to2d);
        const nextPoints: Vector2[] = [];
        for (let i = 0; i < currPoints.length; i++) {
            const pt = currPoints[i];
            const leftPt = currPoints[i-1] || currPoints[currPoints.length-1];
            const rightPt = currPoints[i+1] || currPoints[0];
            const newPt = pt.clone()
                .add(this.brownian(pt))
                .add(this.fairing(pt, leftPt, rightPt))
                .add(this.attractRepel(i, currPoints));
            nextPoints.push(newPt);
        }
        this.resample(nextPoints);
        this.curves[0] = nextPoints.map(this.to3d);
        return this.curves[0];
    }


    private resample(points: Vector2[]) {
        if (points.length <= 1) return;
        let i = 1;
        while (points[i] !== undefined) {
            const [p1, p2] = [points[i],  points[i-1]];
            const len = p1.clone().sub(p2).length();
            if (len > this.dMax(p1, p2)) {  // split
                // console.log('a');
                const mid = p1.clone().add(p2).divideScalar(2);
                points.splice(i, 0, mid);
                // do not increment i since element i changed
            } else if (len < this.dMin(p1, p2)) {  // delete
                // console.log('b');
                points.splice(i, 1);
                // do not increment i since element i changed
            } else {
                // console.log('c');
                i++;
            }
        }
        // todo: last and first points
    }

    private dMax(p1: Vector2, p2: Vector2) {
        return this.kMax * this.samplingRate() * (this.delta(p1) + this.delta(p2)) / 2;
    }

    private dMin(p1: Vector2, p2: Vector2) {
        return this.kMin * this.samplingRate() * (this.delta(p1) + this.delta(p2)) / 2;
    }



    private to2d(v: Vector3): Vector2 {
        return new Vector2(v.x, v.z);
    }

    private to3d(v: Vector2): Vector3 {
        return new Vector3(v.x, 0, v.y);
    }

    private rand2dVector(): Vector2 {
        const x = randomNormal();  // todo: seed
        const y = randomNormal();
        const v = new Vector2(x, y);
        return v.normalize();
    }

    /**
     * "To control random structural variations, a random offset vector (chosen stochastically based on a Normal
     * Distribution with mean 0 and variance σ), zi, is added to each sample point, pi, using the equation:
     *     Bi = fB(pi) · zi · δ(pi) · D
     */
    private brownian(pt: Vector2): Vector2 {
        return this.rand2dVector()
            .multiplyScalar(this.browningAmplitude(pt))
            .multiplyScalar(this.delta(pt))
            .multiplyScalar(this.samplingRate());
    }

    /** "To simulate local smoothness, a Laplacian term is added..." */
    private fairing(pt: Vector2, leftPt: Vector2, rightPt: Vector2): Vector2 {
        const deltaR = this.delta(rightPt);
        const deltaL = this.delta(leftPt);
        const n1 = leftPt.clone().multiplyScalar(deltaR);
        const n2 = rightPt.clone().multiplyScalar(deltaL);
        const mid = n1.add(n2).divideScalar(deltaL + deltaR);

        return mid.sub(pt).multiplyScalar(this.fairingAmplitude(pt));
    }

    private attractRepel(i: number, points: Vector2[]): Vector2 {
        const pi = points[i];
        const segmentForceSum = new Vector2(0, 0);
        for (let j = 1; j < points.length; j++) {  // todo: quadtree
            if (Math.max(Math.abs(j-i), Math.abs(j+1-i)) <= this.N_MIN) {
                continue;
            }

            // todo: fast checks to determine if segment is too far away

            const pjA = points[j-1];
            const pjB = points[j];
            const {x: closestX, y: closestY} = closestPointOnSegment(pi, pjA, pjB);
            const xij = new Vector2(closestX, closestY);

            if (pi.clone().sub(xij).length() >= this.R1 * Math.min(this.delta(pi), this.delta(xij))) {
                continue;
            }

            segmentForceSum.add(
                this.forceFromSegment(pi, xij)
            )
        }

        return segmentForceSum.multiplyScalar(this.attractRepelAmplitude(pi));
    }

    private forceFromSegment(p: Vector2, x: Vector2): Vector2 {
        const diff = p.clone().sub(x);
        return diff.normalize().multiplyScalar(
            this.lennardJonesPotential(diff.length() / (this.samplingRate() * this.delta(p)))
        );
    }

    private lennardJonesPotential(r: number): number {
        const t = this.SIGMA / r;
        const t6 = t**6;
        return t6*t6 - t6;
    }

    /** "δ : R2→(0,1] is used to control the scale of the patterns and support self-similiarity" */
    private delta(pt: Vector2): number {
        return this.DELTA;  // todo: implement texture map
    }

    /** "fB : R2→R modulates the amplitude of the offset" */
    private browningAmplitude(pt: Vector2): number {
        return this.BROWNING_AMP;
    }

    /** "Note that the sampling rate can be controlled globally by changing D" */
    private samplingRate(): number {
        return this.SAMPLING_RATE;
    }

    /** "ff: R2→[0; 1] allows the fairing to vary spatially" */
    private fairingAmplitude(pt: Vector2): number {
        return this.FAIRING_AMPLITUDE;
    }

    private attractRepelAmplitude(pt: Vector2): number {
        return this.ATTR_REPEL_AMPLITUDE;
    }
}
