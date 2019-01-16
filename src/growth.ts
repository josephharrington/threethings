import {
    BufferGeometry,
    CatmullRomCurve3, Curve,
    DoubleSide, Float32BufferAttribute, Geometry,
    Group,
    LineBasicMaterial,
    LineSegments, Material,
    Mesh,
    MeshPhongMaterial, TubeBufferGeometry,
    Vector3
} from "three";
import * as dat from 'dat.gui';
import * as log from 'loglevel';

import { AppPlugin, isGeometric, dispose, Geometric } from './common';
import { Branch, Tree } from "./tree";

import { easeOutQuart } from "./util/easing";


const GROWTH_INTERVAL = 30;


const params = {
    useSplines: true,
    extrusionSegments: 4,
    radiusSegments: 16,
    radius: 20,
    branchChildRadius: 0.8,
    showWireframe: false,
};


export class Growth extends AppPlugin {
    heightOffGround = 300;
    intId: number = 0;

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

        gui.add(params, 'useSplines').onChange(reset);
        gui.add(params, 'extrusionSegments', 0, 100).step(1).onChange(reset);
        gui.add(params, 'radiusSegments', 1, 32).step(1).onChange(reset);
        gui.add(params, 'radius', 1, 100).step(1).onChange(reset);
        gui.add(params, 'branchChildRadius', 0, 1).onChange(reset);
        gui.add(params, 'showWireframe').onChange(reset);

        gui.add(Tree, 'branchDP', 9400, 10000).step(1).onChange(reset);
        gui.add(Tree, 'branchShrink', 0, 1 ).step(0.05).onChange(reset);
        gui.add(Branch, 'initialP', 0, 1).step(0.05).onChange(reset);

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
                log.debug(`done growing, num branches: ${this.tree.branches.length}`);
                clearInterval(this.intId);
                this.intId = 0;
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
        wireframe.visible = params.showWireframe;
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
        wireframeMesh.visible = params.showWireframe;
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
        return params.radius * Math.pow(params.branchChildRadius, branch.level);
    }

    *getTreeGeoms() {
        for (let branch of this.tree.branches) {
            const spline = params.useSplines ? new CatmullRomCurve3(branch.points) : branch.path;

            // const radiusFn = (t: number) => 0.5 + 0.5*Math.sin(2 * Math.PI * (t-0.25));
            // const radiusFn = (t: number) => 0.5 + 0.5 * Math.cos(Math.PI * t);
            // const radiusFn = (t: number) => Math.min(0.4 + t, 1);

            const radiusFn = (t: number) => {
                const k = 0.7;
                if (t <= k) {
                    return 1;
                } else {
                    // return 0.5 + 0.5 * Math.cos(Math.PI * (t-k)/(1-k));
                    return easeOutQuart((1-t)/(1-k));
                }
            };

            yield new TaperedTubeBufferGeometry(
                spline,
                params.extrusionSegments + branch.segments,
                radiusFn,
                this.branchRadius(branch),
                params.radiusSegments);
        }
    }
}


class TaperedTubeBufferGeometry extends TubeBufferGeometry {
    constructor(
        path: Curve<Vector3>,
        tubularSegments?: number,
        radiusFn?: (t: number) => number,
        baseRadius?: number,
        radiusSegments?: number,
        closed?: boolean,
    ) {
        super(path, tubularSegments, baseRadius, radiusSegments, closed);

        const verts = Array.prototype.slice.call(this.getAttribute('position').array);
        const norms = Array.prototype.slice.call(this.getAttribute('normal').array);

        if (radiusFn != null) {
            this.scaleVerts(verts, radiusFn);
        }
        this.closeEnds(verts, norms);

        this.addAttribute('position', new Float32BufferAttribute(verts, 3));
        this.addAttribute('normal', new Float32BufferAttribute(norms, 3));
    }

    private scaleVerts(verts: number[], radiusFn: (t: number) => number) {
        const pt: Vector3 = new Vector3(),
            newPt: Vector3 = new Vector3(),
            pathPt: Vector3 = new Vector3();
        for (let i = 0; i <= this.parameters.tubularSegments; i++) {
            const t = i / this.parameters.tubularSegments;
            this.parameters.path.getPointAt(t, pathPt);

            for (let j = 0; j <= this.parameters.radialSegments; j++) {
                const vIdx = 3 * (i * (this.parameters.radialSegments+1) + j);
                pt.set(verts[vIdx], verts[vIdx+1], verts[vIdx+2]);
                // scale points of a tube towards its center
                newPt.copy(pt.sub(pathPt).multiplyScalar(radiusFn(t)).add(pathPt));  // k(B - A) + A
                verts[vIdx] = newPt.x;
                verts[vIdx+1] = newPt.y;
                verts[vIdx+2] = newPt.z;
            }
        }
    }

    private closeEnds(verts: number[], norms: number[]) {
        const { path, radialSegments, tubularSegments } = this.parameters;
        const lastVertIdx = verts.length/3 - 1;
        const firstPt = path.getPointAt(0);
        const lastPt = path.getPointAt(1);
        verts.push(firstPt.x, firstPt.y, firstPt.z);
        verts.push(lastPt.x, lastPt.y, lastPt.z);
        const firstPtIdx = lastVertIdx + 1;
        const lastPtIdx = lastVertIdx + 2;

        const indices = Array.prototype.slice.call(this.getIndex().array);

        for (let i = 0; i < radialSegments; i++) {
            indices.push(i, i+1, firstPtIdx);
        }
        for (let i = 0; i < radialSegments; i++) {
            indices.push(lastVertIdx-i, lastVertIdx-i-1, lastPtIdx);
        }

        const secondPt = path.getPointAt( 1 / tubularSegments);
        const secondToLastPt = path.getPointAt( (tubularSegments-1) / tubularSegments);

        const firstNorm = firstPt.sub(secondPt).normalize();
        const lastNorm = lastPt.sub(secondToLastPt).normalize();
        norms.push(firstNorm.x, firstPt.y, firstPt.z);
        norms.push(lastNorm.x, lastNorm.y, lastNorm.z);
        this.setIndex(indices);
    }
}
