import {
    BufferGeometry,
    CatmullRomCurve3, CircleGeometry,
    CurvePath, CylinderGeometry,
    DoubleSide, ExtrudeBufferGeometry, Geometry,
    Group,
    LineBasicMaterial,
    LineCurve3,
    LineSegments, Material,
    Mesh,
    MeshPhongMaterial, Shape, SphereBufferGeometry, TubeBufferGeometry,
    TubeGeometry,
    Vector3
} from "three";
import * as dat from 'dat.gui';
import * as log from 'loglevel';

import { AppPlugin, isGeometric, dispose, Geometric } from './common';


const TREE_HEIGHT = 400;
const MAX_BRANCHES = 100;
const GROWTH_INTERVAL = 30;


function pin(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function random(min: number, max: number): number {
    return (Math.random() * (max - min)) + min;
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
    dy = 10;
    maxV = 0.3 * this.dy;  // todo: specify as angle
    // maxA = 45;
    k = 1;

    constructor(public parent: Branch) {
        if (this.parent) {
            this.addPt(parent.points[parent.points.length-2]);
            this.addPt(parent.points[parent.points.length-1]);
            this.level = this.parent.level + 1;
            // this.vx = parent.vx;
            // this.vz = parent.vz;
            this.vx = parent.vx + random(-this.k, this.k);
            this.vz = parent.vx + random(-this.k, this.k);
            this.vz = parent.vz;
            // this.vx = random(-this.maxV, this.maxV);
            // this.vz = random(-this.maxV, this.maxV);
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
            if (branch.y >= TREE_HEIGHT * Math.pow(0.9, branch.level)) {
                continue;
            } else {
                stillGrowing = true;
            }

            branch.vx = pin(branch.vx + random(-branch.k, branch.k), -branch.maxV, branch.maxV);
            branch.vz = pin(branch.vz + random(-branch.k, branch.k), -branch.maxV, branch.maxV);
            branch.addPt(new Vector3(
                branch.x + branch.vx,
                branch.y + branch.dy,
                branch.z + branch.vz));
            branch.segments += branch.dSegments;

            branch.p += Math.pow(0.9, branch.dy);
            const numBranchesToSpawn = this.numBranchesToSpawn(branch);
            if (numBranchesToSpawn > 0 && this.branches.length < MAX_BRANCHES) {
                for (let i = 0; i < numBranchesToSpawn; i++) {
                    const newBranch = new Branch(branch);
                    spawnedBranches.push(newBranch);
                    branch.p -= 3;
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


export class Growth extends AppPlugin {
    // gui parameters - defaults
    showWireframe = false;
    heightOffGround = 300;
    intId: number = 0;

    useSplines = true;
    extrusionSegments = 1;
    radiusSegments = 16;
    radius = 20;
    branchChildRadius = 0.8;

    group: Group = null;
    tree: Tree = null;

    lineMaterial: Material;
    meshMaterial: Material;


    constructor() {
        super();
        this.lineMaterial = new LineBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0.5 });
        this.meshMaterial = new MeshPhongMaterial({
            color: 0x156289, emissive: 0x072534, side: DoubleSide, flatShading: true });
    }

    createGui(gui: dat.GUI, refreshWith: Function): void {
        log.debug('growth.createGui');
        const reset = refreshWith(() => this.update());

        gui.add(this, 'useSplines').onChange(reset);
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
                log.debug('done growing');
                clearInterval(this.intId);
                this.intId = 0;

                for (let branch of this.tree.branches) {
                    // const cap = new Mesh(
                    //     new SphereBufferGeometry(this.branchRadius(branch), this.radiusSegments, this.radiusSegments),
                    //     this.meshMaterial);
                    const br = this.branchRadius(branch);
                    const cap = new Mesh(
                        new CylinderGeometry(
                            br,
                            0,
                            br * 3,
                            this.radiusSegments,
                            this.radiusSegments),
                        this.meshMaterial);
                    cap.position.set(branch.x, branch.y, branch.z);
                    cap.lookAt(branch.points[branch.points.length-2]);
                    cap.rotateOnAxis(new Vector3(1,0,0), Math.PI/2);

                    cap.translateOnAxis(
                        new Vector3(0,-1,0),
                        br * 1.5
                    );
                    this.group.add(cap)


                }
                return;
            }

            let i = -1;
            // todo: this loop is jank -- decouple geometries and child indices
            for (let geom of this.getTreeGeoms()) {
                i++;
                if (i < this.group.children.length) {
                    const child = this.group.children[i];
                    if (isGeometric(child)) {
                        this.replaceMeshGeom(child, geom);
                    } else {

                    }
                } else {
                    this.group.add(this.newMesh(geom));
                }
            }
        }, GROWTH_INTERVAL);
    }

    newMesh(geom: Geometry | BufferGeometry): Mesh {
        const mesh = new Mesh(geom, this.meshMaterial);

        const wireframe = new LineSegments(geom, this.lineMaterial);
        wireframe.name = 'wireframe';
        wireframe.visible = this.showWireframe;
        mesh.add(wireframe);

        return mesh;
    }

    replaceMeshGeom(mesh: Geometric, geom: Geometry | BufferGeometry) {
        dispose(mesh);
        mesh.geometry = geom;

        const wireframeMesh = mesh.getObjectByName('wireframe');
        if (!isGeometric(wireframeMesh)) {
            throw new Error(`Nongeometric wireframe: ${wireframeMesh}`);
        }
        wireframeMesh.geometry = geom;
        wireframeMesh.visible = this.showWireframe;
    }

    update(): Group {
        log.info('growth.update');

        this.group = new Group();
        if (!this.tree) {
            this.replant();
        }
        for (let geom of this.getTreeGeoms()) {
            this.group.add(this.newMesh(geom));
        }

        // position should be centererd in draw area
        this.group.position.set(0, this.heightOffGround, 0);
        this.group.matrixAutoUpdate = false;
        this.group.matrix.makeTranslation(0, this.heightOffGround-this.tree.height/2, 0);
        return this.group;
    }

    branchRadius(branch: Branch): number {
        return this.radius * Math.pow(this.branchChildRadius, branch.level);
    }

    *getTreeGeoms() {
        for (let branch of this.tree.branches) {
            const spline = this.useSplines ? new CatmullRomCurve3(branch.points) : branch.path;
            yield new TubeBufferGeometry(
                spline,
                this.extrusionSegments + branch.segments,
                this.branchRadius(branch),
                this.radiusSegments);

            // const circleRadius = this.radius * Math.pow(this.branchChildRadius, branch.level);
            // const circleShape = new Shape();
            // circleShape.moveTo( 0, circleRadius );
            // circleShape.quadraticCurveTo( circleRadius, circleRadius, circleRadius, 0 );
            // circleShape.quadraticCurveTo( circleRadius, - circleRadius, 0, - circleRadius );
            // circleShape.quadraticCurveTo( - circleRadius, - circleRadius, - circleRadius, 0 );
            // circleShape.quadraticCurveTo( - circleRadius, circleRadius, 0, circleRadius );
            //
            // let extrudeSettings = {
            //     steps: this.extrusionSegments + branch.segments,
            //     // depth: 16,
            //     bevelEnabled: false,
            //     bevelThickness: 0,
            //     bevelSize: 0,
            //     bevelSegments: 1,
            //     extrudePath: branch.path,
            // };
            // yield new ExtrudeBufferGeometry( circleShape, extrudeSettings );
        }
    }
}
