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

import {AppPlugin} from './common';

const ITERATION_DELAY = 30;

export class Mazer extends AppPlugin {
    private readonly MESH_TUBE = 'MESH_TUBE';
    private readonly MESH_SHAPE = 'MESH_SHAPE';
    private readonly MESH_TYPES = [this.MESH_TUBE, this.MESH_SHAPE];

    heightOffGround = 300;
    isIterating = false;

    // gui parameters - defaults
    numPts = 75;
    bigR = 420;
    extrusionSegments = 500;
    radiusSegments = 5;
    radius = 10;
    closed = true;
    showPts = false;
    showWireframe = true;
    speed = 4;
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

        gui.add(this, 'extrusionSegments', 5, 100000).step(5).onChange(regenMesh);
        gui.add(this, 'radiusSegments', 1, 32).step(1).onChange(regenMesh);
        gui.add(this, 'radius', 1, 100).step(1).onChange(regenMesh);
        gui.add(this, 'closed').onChange(regenMesh);
        gui.add(this, 'showPts').onChange(regenMesh);
        gui.add(this, 'showWireframe').onChange(regenMesh);
        gui.add(this, 'speed', 1, 500).step(1).onChange(regenMesh);
        gui.add(this, 'meshType', this.MESH_TYPES).onChange(regenMesh);

        const mazeGui = gui.addFolder('Maze');
        this.maze.createGui(mazeGui);
        mazeGui.__controllers.forEach(c => c.onChange(regenMesh));
        mazeGui.open();

        gui.add(this, 'bigR', 10, 5000).step(1).onChange(init);
        gui.add(this, 'numPts', 1, 1000).step(1).onChange(init);
        gui.add({init}, 'init');
        gui.add(this, 'iterate');
        gui.add(this, 'iterateN');
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

    private iterate(numSteps=1, cb: Function = () => this.regenMesh()) {
        if (!this.maze) throw new Error('null maze');
        this.maze.step(numSteps, cb);
    }

    private iterateN() {
        this.iterate(this.speed);
    }

    private continueIteration() {
        this.regenMesh();
        if (this.isIterating) {
            setTimeout(() => {
                this.iterate(this.speed, () => this.continueIteration());
            }, ITERATION_DELAY);
        }
    }

    private toggleIteration(targetState?: boolean) {
        this.isIterating = (targetState !== undefined) ? targetState : !this.isIterating;
        if (this.isIterating) {
            this.continueIteration();
        }
    }

    private generateMesh(maze: Maze): Mesh {
        const geom = this.createGeometry(maze.getCurves()[0]);
        return this.newMesh(geom, this.meshMaterial, this.lineMaterial, this.showWireframe);
    }

    private createGeometry(points: Vector3[]): Geometry | BufferGeometry {
        // DebugText.appendDebugOutput(`numPoints:${points.length}`);
        if (this.meshType === this.MESH_SHAPE) {
            return this.createShapeGeometry(points);
        } else if (this.meshType === this.MESH_TUBE) {
            return this.createTubeGeometry(points);
        }
        throw new Error('Invalid mesh type. Valid types are :' + this.MESH_TYPES);
    }

    private createShapeGeometry(points: Vector3[]): Geometry | BufferGeometry {
        const to2d = (v: Vector3): Vector2 => new Vector2(v.x, v.z);
        // const totalThickness = 40;
        // const bevelRatio = 0.6;
        // return (new ExtrudeBufferGeometry(new Shape(points.map(to2d)), {
        //     steps: 1,
        //     curveSegments: 2,
        //     depth: totalThickness * (1-bevelRatio) / 2,
        //     bevelEnabled: true,
        //     bevelThickness: totalThickness * bevelRatio / 4,
        //     bevelSegments: 8,
        // })).rotateX(Math.PI/2);
        return (new ShapeBufferGeometry(new Shape(points.map(to2d)), this.extrusionSegments)).rotateX(Math.PI/2);
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
        return this.pointsCircle(this.bigR, this.numPts);
        // return this.pointsRectangle(this.bigR, this.bigR, this.numPts);
    }

    private pointsCircle(radius: number, numPts: number): Vector3[] {
        const points: Vector3[] = [];
        for (let i = 0; i < numPts; i++) {
            const t = 2*Math.PI * i/numPts;
            const x = radius * Math.cos(t);
            const y = radius * Math.sin(t);
            points.push(new Vector3(x, 0, y));
        }
        return points;
    }

    private pointsRectangle(width: number, height: number, numPts: number): Vector3[] {
        const points: Vector3[] = [];
        const pNW = new Vector3(-width/2, 0, -height/2);
        const pNE = new Vector3(width/2, 0, -height/2);
        const pSE = new Vector3(width/2, 0, height/2);
        const pSW = new Vector3(-width/2, 0, height/2);

        for (let i = 0; i < numPts; i++) {
            const t = i/numPts;
            if (t < 0.25) {
                points.push(pNW.clone().add(pNE.clone().multiplyScalar(t/0.25)));
            } else if (t >= 0.25 && t < 0.5) {
                points.push(pNE.clone().add(pSE.clone().multiplyScalar((t-0.25)/0.25)));
            } else if (t >= 0.5 && t < 0.75) {
                points.push(pSE.clone().add(pSW.clone().multiplyScalar((t-0.5)/0.25)));
            } else {
                points.push(pSW.clone().add(pNW.clone().multiplyScalar((t-0.75)/0.25)));
            }
        }
        return points;
    }
}

export interface WorkerRequest {
    points: Vector2[];
    numSteps: number;
    params: {
        N_MIN: number;
        R1: number;
        SIGMA: number;
        DELTA: number;
        BROWNING_AMP: number;
        SAMPLING_RATE: number;
        FAIRING_AMPLITUDE: number;
        ATTR_REPEL_AMPLITUDE: number;
        kMax: number;
        kMin: number;
    };
}

export interface WorkerResponse {
    points: Vector2[];
}

/**
 * http://www.dgp.toronto.edu/~karan/artexhibit/mazes.pdf
 */
class Maze {
    private curves: Vector3[][] = [];

    private worker = new Worker('mazeWorker.ts');

    private params = {
        N_MIN: 3,
        R1: 100,
        SIGMA: 1.1,
        DELTA: 1,
        BROWNING_AMP: 5,
        SAMPLING_RATE: 1,
        FAIRING_AMPLITUDE: 0.35,
        ATTR_REPEL_AMPLITUDE: 2.5,
        kMax: 50,
        kMin: 5,
    };

    createGui(gui: dat.GUI): void {
        gui.add(this.params, 'N_MIN', 0, 30).step(1);
        gui.add(this.params, 'R1', 1, 200).step(1);
        gui.add(this.params, 'DELTA', 0.9, 2).step(0.01);
        gui.add(this.params, 'SIGMA', 0, 3).step(0.01);
        gui.add(this.params, 'BROWNING_AMP', 0, 20);
        gui.add(this.params, 'SAMPLING_RATE', 0, 10);
        gui.add(this.params, 'FAIRING_AMPLITUDE', 0, 1).step(0.01);
        gui.add(this.params, 'ATTR_REPEL_AMPLITUDE', 0, 10);
        gui.add(this.params, 'kMax', 0, 200);
        gui.add(this.params, 'kMin', 0, 200);
    }

    setCurves(curves: Vector3[][]) {
        this.curves = curves;
    }

    getCurves(): Vector3[][] {
        return this.curves;
    }

    step(numSteps = 1, cb: Function|null = null) {
        const currPoints = this.curves[0].map(this.to2d);

        this.worker.onmessage = (event: {data: WorkerResponse}) => {
            this.curves[0] = event.data.points.map(this.to3d);
            if (cb) cb();
        };
        const request: WorkerRequest = {
            points: currPoints,
            numSteps,
            params: this.params,
        };
        this.worker.postMessage(request);
    }

    private to2d(v: Vector3): Vector2 {
        return new Vector2(v.x, v.z);
    }

    private to3d(v: Vector2): Vector3 {
        return new Vector3(v.x, 0, v.y);
    }
}
