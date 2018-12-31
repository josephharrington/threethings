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


const MAX_BRANCHES = 100;


function pin(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}


class Branch {
    points: Array<Vector3> = [];
    path: CurvePath<Vector3> = new CurvePath();
    level: number;

    readonly dSegments = 2;
    segments = this.dSegments;

    p = 0; // 0-1 probability of branching
    vx = 0;
    vz = 0;
    dy = 5;
    maxV = 0.3 * this.dy;  // todo: specify as angle
    // maxA = 45;
    k = 1;

    constructor(public parent: Branch) {
        if (this.parent) {
            this.addPt(parent.points[parent.points.length-2]);
            this.addPt(parent.points[parent.points.length-1]);
            this.level = this.parent.level + 1;
            this.vx = parent.vx;
            this.vz = parent.vz;
        } else {
            this.addPt(new Vector3(0, -1, 0));
            this.addPt(new Vector3(0, 0, 0));
            this.level = 0;
        }
    }

    get lastPt(): Vector3 { return this.points[this.points.length - 1]; }
    get x() { return this.lastPt.x; }
    get y() { return this.lastPt.y; }
    get z() { return this.lastPt.z; }

    addPt(pt: Vector3) {
        this.points.push(pt);
        if (this.points.length >= 2) {
            this.path.add(new LineCurve3(
                this.points[this.points.length-2],
                this.points[this.points.length-1]
            ))
        }
    }
}

class Tree {
    trunk: Branch;
    branches: Branch[];
    height = 400;

    constructor() {
        this.trunk = new Branch(null);
        this.branches = [this.trunk];
    }

    grow(): boolean {
        let stillGrowing = false;
        const spawnedBranches = [];

        for (let branch of this.branches) {
            if (branch.y >= this.height * Math.pow(0.9, branch.level)) {
                continue;
            } else {
                stillGrowing = true;
            }

            branch.vx = pin(branch.vx + 2*branch.k*Math.random()-branch.k, -branch.maxV, branch.maxV);
            branch.vz = pin(branch.vz + 2*branch.k*Math.random()-branch.k, -branch.maxV, branch.maxV);
            branch.addPt(new Vector3(
                branch.x + branch.vx,
                branch.y + branch.dy,
                branch.z + branch.vz));
            branch.segments += branch.dSegments;

            branch.p += 0.01;
            const numBranchesToSpawn = this.numBranchesToSpawn(branch);
            if (numBranchesToSpawn > 0 && this.branches.length < MAX_BRANCHES) {
                for (let i = 0; i < numBranchesToSpawn; i++) {
                    const newBranch = new Branch(branch);
                    spawnedBranches.push(newBranch);
                    branch.p -= 0.5;
                }
            }
        }

        this.branches = this.branches.concat(spawnedBranches);
        return stillGrowing;
    }

    numBranchesToSpawn(branch: Branch) { // todo: different random instances for each thing
        return Math.random() < branch.p ? 1 : 0;
    }
}


export class Growth implements AppPlugin {
    // gui parameters - defaults
    showWireframe = false;
    heightOffGround = 300;
    intId: number = 0;

    extrusionSegments = 1;
    radiusSegments = 16;
    radius = 10;
    branchChildRadius = 0.7;

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
        gui.add(this, 'branchChildRadius', 0, 1).onChange(reset);
        gui.add(this, 'showWireframe').onChange(reset);

        const growthFolder = gui.addFolder('growth params');
        growthFolder.open();

        growthFolder.add(this, 'replant');
    }

    replant() {
        log.info('growth.replant');

        this.group.remove(...this.group.children);

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
                        const oldGeom = child.geometry;
                        child.geometry = geom;
                        if (oldGeom) oldGeom.dispose();
                    }
                    const nextChild = this.group.children[i+1];
                    if (this.showWireframe && isGeometric(nextChild)) {
                        const oldGeom = nextChild.geometry;
                        nextChild.geometry = geom;
                        if (oldGeom) oldGeom.dispose();
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
        }, 30);
    }

    update(): Group {
        log.info('growth.update');

        this.group = new Group();
        if (!this.tree) {
            this.replant();
        }
        for (let geom of this.getTreeGeoms()) {  // todo: share logic with similar in replant()
            const mesh = new Mesh(geom, this.meshMaterial);
            this.group.add(mesh);

            if (this.showWireframe) {
                const wireframe = new LineSegments(geom, this.lineMaterial);
                this.group.add(wireframe);
            }
        }

        // position should be centererd in draw area
        this.group.position.set(0, this.heightOffGround, 0);
        this.group.matrixAutoUpdate = false;
        this.group.matrix.makeTranslation(0, this.heightOffGround-this.tree.height/2, 0);
        return this.group;
    }

    *getTreeGeoms() {
        for (let branch of this.tree.branches) {
            yield new TubeBufferGeometry(
                branch.path, this.extrusionSegments + branch.segments,
                this.radius * Math.pow(this.branchChildRadius, branch.level),
                this.radiusSegments);
        }
    }
}
