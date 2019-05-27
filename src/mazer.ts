import {
    BufferGeometry,
    CurvePath,
    DoubleSide, Geometry,
    Group,
    LineBasicMaterial,
    LineCurve3,
    Mesh,
    MeshLambertMaterial,
    MeshPhongMaterial,
    TubeBufferGeometry, Vector2,
    Vector3
} from "three";
import * as dat from 'dat.gui';
import * as log from 'loglevel';

import { AppPlugin } from './common';
import {randomNormal} from "./util/random";

const ITERATION_DELAY = 30;

export class Mazer extends AppPlugin {
    heightOffGround = 300;
    intId: number|undefined = undefined;
    isIterating = false;

    // gui parameters - defaults
    numPts = 90;
    bigR = 330;
    extrusionSegments = 140;
    radiusSegments = 5;
    radius = 10;
    closed = true;
    showPts = false;
    showWireframe = true;

    lineMaterial = new LineBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.5 });
    meshMaterial = new MeshPhongMaterial({
        color: 0x156289, emissive: 0x072534, side: DoubleSide, flatShading: true });
    dotMaterial = new MeshLambertMaterial({
        color: 0xff00ff, transparent: true, opacity: 1 });

    group: Group|null = null;
    maze: Maze|null = null;

    createGui(gui: dat.GUI, refreshWith: Function): void {
        const init = refreshWith(() => this.init());
        const regenMesh = refreshWith(() => this.regenMesh());

        gui.add(this, 'extrusionSegments', 5, 10000).step(5).onChange(regenMesh);
        gui.add(this, 'radiusSegments', 1, 32).step(1).onChange(regenMesh);
        gui.add(this, 'radius', 1, 100).step(1).onChange(regenMesh);
        gui.add(this, 'closed').onChange(regenMesh);
        gui.add(this, 'showPts').onChange(regenMesh);
        gui.add(this, 'showWireframe').onChange(regenMesh);

        gui.add(this, 'bigR', 10, 500).step(1).onChange(init);
        gui.add(this, 'numPts', 1, 100).step(1).onChange(init);
        gui.add({init}, 'init');
        gui.add(this, 'doOneIteration');
        gui.add(this, 'toggleIteration');
    }

    init(): Group {
        this.toggleIteration(false);
        this.group = new Group();
        this.group.position.set(0, this.heightOffGround, 0);

        this.maze = new Maze(this.initialPoints());
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

    private doOneIteration() {
        if (!this.maze) throw new Error('null maze');
        this.maze.step();
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
                this.doOneIteration()
            }, ITERATION_DELAY);
        }
    }

    private generateMesh(maze: Maze): Mesh {
        const geom = this.createTubeGeometry(maze.curves[0]);
        return this.newMesh(geom, this.meshMaterial, this.lineMaterial, this.showWireframe);
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
    curves: Vector3[][];

    constructor(initialPoints: Vector3[]) {
        this.curves = [initialPoints];
    }

    step(): Vector3[] {
        const currPoints = this.curves[0];
        const nextPoints: Vector3[] = [];
        for (let i = 0; i < currPoints.length; i++) {
            const pt = currPoints[i];
            const leftPt = currPoints[i-1] || currPoints[currPoints.length-1];
            const rightPt = currPoints[i+1] || currPoints[0];
            const newPt = pt.clone()
                // .add(this.brownian(pt))
                .add(this.fairing(leftPt, pt, rightPt))
                .add(this.attractRepel(pt));
            nextPoints.push(newPt);
        }
        this.curves[0] = nextPoints;
        return this.curves[0];
    }

    private randVectorXZ(): Vector3 {
        const x = randomNormal();  // todo: seed
        const z = randomNormal();
        const v = new Vector3(x, 0, z);
        return v.normalize();
    }

    /**
     * "To control random structural variations, a random offset vector (chosen stochastically based on a Normal
     * Distribution with mean 0 and variance σ), zi, is added to each sample point, pi, using the equation:
     *     Bi = fB(pi) · zi · δ(pi) · D
     */
    private brownian(pt: Vector3): Vector3 {
        return this.randVectorXZ()
            .multiplyScalar(this.browningAmplitude(pt))
            .multiplyScalar(this.delta(pt))
            .multiplyScalar(this.samplingRate());
    }

    /** "To simulate local smoothness, a Laplacian term is added..." */
    private fairing(leftPt: Vector3, pt: Vector3, rightPt: Vector3): Vector3 {
        const deltaR = this.delta(rightPt);
        const deltaL = this.delta(leftPt);
        const n1 = leftPt.multiplyScalar(deltaR);
        const n2 = rightPt.multiplyScalar(deltaL);
        const mid = n1.add(n2).divideScalar(deltaL + deltaR);

        return mid.sub(pt).multiplyScalar(this.fairingAmplitude(pt));
    }

    private attractRepel(pt: Vector3): Vector3 {
        return new Vector3();
    }

    /** "δ : R2→(0,1] is used to control the scale of the patterns and support self-similiarity" */
    private delta(pt: Vector3): number {
        return 1;  // todo: implement texture map
    }

    /** "fB : R2→R modulates the amplitude of the offset" */
    private browningAmplitude(pt: Vector3): number {
        return 1;
    }

    /** "Note that the sampling rate can be controlled globally by changing D" */
    private samplingRate(): number {
        return 1;
    }

    /** "ff: R2→[0; 1] allows the fairing to vary spatially" */
    private fairingAmplitude(pt: Vector3): number {
        return 1;
    }
}
