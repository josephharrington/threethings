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
    TubeBufferGeometry,
    Vector3
} from "three";
import * as dat from 'dat.gui';
import * as log from 'loglevel';

import { AppPlugin } from './common';

const ITERATION_DELAY = 30;

export class Mazer extends AppPlugin {
    heightOffGround = 300;
    intId: number = 0;
    points: Vector3[] = [];

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

        gui.add(this, 'extrusionSegments', 5, 10000).step(5).onChange(init);
        gui.add(this, 'radiusSegments', 1, 32).step(1).onChange(init);
        gui.add(this, 'radius', 1, 100).step(1).onChange(init);
        gui.add(this, 'closed').onChange(init);
        gui.add(this, 'showPts').onChange(init);
        gui.add(this, 'showWireframe').onChange(init);

        gui.add(this, 'bigR', 10, 500).step(1).onChange(init);
        gui.add(this, 'numPts', 1, 100).step(1).onChange(init);
        gui.add({init}, 'init');
        gui.add(this, 'startIteration');
    }

    init(): Group {
        if (this.intId) {
            clearInterval(this.intId);
        }
        this.group = new Group();
        this.group.position.set(0, this.heightOffGround, 0);

        this.maze = new Maze(this.initialPoints());
        const mesh = this.generateMesh(this.maze);
        this.group.add(mesh);

        return this.group;
    }

    private startIteration() {
        if (this.intId) {
            clearInterval(this.intId);
        }
        this.intId = setInterval(() => {
            if (!this.group) throw new Error('null group');
            if (!this.maze) throw new Error('null maze');

            this.maze.step();
            const mesh = this.generateMesh(this.maze);

            this.group.remove(...this.group.children);
            this.group.add(mesh);
        }, ITERATION_DELAY);
    }

    private generateMesh(maze: Maze): Mesh {
        const geom = this.createTubeGeometry(maze.points);
        return this.newMesh(geom, this.meshMaterial, this.lineMaterial, this.showWireframe);
    }

    private createTubeGeometry(points: Vector3[]): Geometry | BufferGeometry {
        const path: CurvePath<Vector3> = new CurvePath();
        for (let i = 1; i < points.length; i++) {
            path.add(new LineCurve3(points[i-1], points[i]));
        }
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


class Maze {
    points: Vector3[];

    constructor(initialPoints: Vector3[]) {
        this.points = initialPoints;
    }

    step(): Vector3[] {
        const nextPoints: Vector3[] = [];
        for (let i = 0; i < this.points.length; i++) {
            const prevPt = this.points[i];
            const newPt = prevPt.clone();
            newPt.x += 1;
            newPt.y += 1;
            newPt.z += 1;
            nextPoints.push(newPt);
        }
        this.points = nextPoints;
        return this.points;
    }
}
