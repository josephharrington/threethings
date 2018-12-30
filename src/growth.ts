import {
    CurvePath,
    DoubleSide,
    Group,
    LineBasicMaterial,
    LineCurve3,
    LineSegments, Material,
    Mesh,
    MeshPhongMaterial, TubeBufferGeometry,
    TubeGeometry,
    Vector3
} from "three";
import * as dat from 'dat.gui';
import * as log from 'loglevel';

import { AppPlugin, isGeometric } from './common';

class Branch {
    points: Array<Vector3> = [];
    path: CurvePath<Vector3> = new CurvePath();

    readonly dSegments = 2;
    segments = this.dSegments;

    t = 0;
    vx = 0;
    vz = 0;
    dt = 5;
    maxV = 0.3 * this.dt;  // todo: specify as angle
    maxA = 45;
    k = 1;

    constructor(
        public h: number = 300,
    ) {
        this.t = -h/2;
    }
}

class Tree {
    trunk: Branch;
    branches: Branch[];

    constructor() {
        // create trunk
        this.trunk = new Branch();
        this.branches = [this.trunk, new Branch(), new Branch(), new Branch(), new Branch(),
            new Branch(), new Branch(), new Branch(), new Branch(), new Branch(), new Branch(), new Branch(),
            new Branch(), new Branch(), new Branch(), new Branch(), new Branch(), new Branch(), new Branch(),
            new Branch(), new Branch(), new Branch(), new Branch(), new Branch(), new Branch(), new Branch(),
        ];
    }

    grow(): boolean {
        for (let branch of this.branches) {
            if (branch.t >= branch.h/2) {
                return false;
            }
            const lastPt = branch.points[branch.points.length - 1] || new Vector3(0, branch.t, 0);
            branch.points.push(new Vector3(
                lastPt.x + branch.vx,
                branch.t,
                lastPt.z + branch.vz)
            );
            if (branch.points.length >= 2) {
                branch.path.add(new LineCurve3(branch.points[branch.points.length-2], branch.points[branch.points.length-1]));
            }
            branch.vx = Math.min(Math.max(branch.vx + 2*branch.k*Math.random()-branch.k, -branch.maxV), branch.maxV);
            branch.vz = Math.min(Math.max(branch.vz + 2*branch.k*Math.random()-branch.k, -branch.maxV), branch.maxV);  // todo: move v calcs before point add?
            branch.t += branch.dt;
            branch.segments += branch.dSegments;
        }

        return true;
    }
}


export class Growth implements AppPlugin {
    // gui parameters - defaults
    showWireframe = false;
    heightOffGround = 300;
    intId: number = 0;

    extrusionSegments = 1;
    radiusSegments = 16;
    radius = 5;
    closed = false;

    group: Group = null;
    tree: Tree = null;

    lineMaterial: Material;
    meshMaterial: Material;

    constructor() {
        this.lineMaterial = new LineBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0.5 });
        this.meshMaterial = new MeshPhongMaterial({
            color: 0x156289, emissive: 0x072534, side: DoubleSide, flatShading: true });
    }

    createGui(gui: dat.GUI, refreshWith: Function): void {
        log.debug('growth.createGui');
        const reset = refreshWith(() => this.update());

        gui.add(this, 'extrusionSegments', 5, 1000).step(5).onChange(reset);
        gui.add(this, 'radiusSegments', 1, 32).step(1).onChange(reset);
        gui.add(this, 'radius', 1, 100).step(1).onChange(reset);
        // gui.add(this, 'closed').onChange(reset);

        gui.add(this, 'regrow');

        gui.add(this, 'showWireframe').onChange(reset);
    }

    regrow() {
        log.info('growth.regrow');

        this.tree = new Tree();
        this.tree.grow();
        this.tree.grow();

        if (this.intId) {
            clearInterval(this.intId);
        }
        this.intId = setInterval(() => {
            log.debug('growing');
            const shouldContinue = this.tree.grow();
            if (!shouldContinue) {
                clearInterval(this.intId);
                this.intId = 0;
                return;
            }
            for (let child of this.group.children) {
                if (isGeometric(child)) {
                    child.geometry.dispose();  // needed since changes happen outside of common.ts
                }
            }
            let i = 0;
            for (let geom of this.getTreeGeoms()) {
                if (i < this.group.children.length) {
                    const child = this.group.children[i];
                    if (isGeometric(child)) {
                        child.geometry = geom;
                    }
                    const nextChild = this.group.children[i+1];
                    if (this.showWireframe && isGeometric(nextChild)) {
                        nextChild.geometry = geom;
                    }
                } else {
                    const mesh = new Mesh(geom, this.meshMaterial);
                    this.group.add(mesh);

                    if (this.showWireframe) {
                        const wireframe = new LineSegments(geom, this.lineMaterial);
                        this.group.add(wireframe);
                    }
                }
                i += this.showWireframe ? 2 : 1;
            }
        }, 50);
    }

    update(): Group {
        log.info('growth.update');

        this.group = new Group();
        if (!this.tree) {
            this.regrow();
        }
        for (let geom of this.getTreeGeoms()) {
            const mesh = new Mesh(geom, this.meshMaterial);
            this.group.add(mesh);

            if (this.showWireframe) {
                const wireframe = new LineSegments(geom, this.lineMaterial);
                this.group.add(wireframe);
            }
        }

        this.group.position.set(0, this.heightOffGround, 0);
        return this.group;
    }

    *getTreeGeoms() {
        for (let branch of this.tree.branches) {
            yield new TubeBufferGeometry(
                branch.path, this.extrusionSegments + branch.segments, this.radius,
                this.radiusSegments, this.closed);
        }
    }
}
