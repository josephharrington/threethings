import {
    CurvePath,
    DoubleSide,
    Group,
    LineBasicMaterial,
    LineCurve3,
    LineSegments, Material,
    Mesh,
    MeshPhongMaterial,
    TubeGeometry,
    Vector3
} from "three";
import * as dat from 'dat.gui';
import * as log from 'loglevel';

import { AppPlugin, isGeometric } from './common';

class Tree {
    points: Array<Vector3> = [];
    path: CurvePath<Vector3> = new CurvePath();

    private readonly dSegments = 2;
    segments = this.dSegments;

    private t = 0;
    private vx = 0;
    private vz = 0;
    private dt = 5;
    private maxV = 0.4 * this.dt;  // todo: specify as angle
    private k = 1;

    constructor(
        public height: number = 300,
    ) {
        this.t = -height / 2;
    }

    grow(): boolean {
        if (this.t >= this.height/2) {
            return false;
        }
        const lastPt = this.points[this.points.length - 1] || new Vector3(0, this.t, 0);
        this.points.push(new Vector3(
            lastPt.x + this.vx,
            this.t,
            lastPt.z + this.vz)
        );
        if (this.points.length >= 2) {
            this.path.add(new LineCurve3(this.points[this.points.length-2], this.points[this.points.length-1]));
        }
        this.vx = Math.min(Math.max(this.vx + 2*this.k*Math.random()-this.k, -this.maxV), this.maxV);
        this.vz = Math.min(Math.max(this.vz + 2*this.k*Math.random()-this.k, -this.maxV), this.maxV);  // todo: move v calcs before point add?
        this.t += this.dt;
        this.segments += this.dSegments;
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
            const geom = this.getTreeGeom();
            for (let child of this.group.children) {
                if (isGeometric(child)) {
                    child.geometry.dispose();  // needed since changes happen outside of common.ts
                    child.geometry = geom;
                }
            }
        }, 50);
    }

    update(): Group {
        log.info('growth.update');

        this.group = new Group();
        if (!this.tree) {
            this.regrow();
        }
        const geom = this.getTreeGeom();

        this.group.add(new Mesh(geom, this.meshMaterial));
        this.group.position.set(0, this.heightOffGround, 0);

        if (this.showWireframe) {
            const wireframe = new LineSegments(geom, this.lineMaterial);
            this.group.add(wireframe);
        }

        return this.group;
    }

    getTreeGeom() {
        return new TubeGeometry(
            this.tree.path, this.extrusionSegments + this.tree.segments, this.radius,
            this.radiusSegments, this.closed);
    }
}
