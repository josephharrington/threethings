import * as three from "three";
import * as dat from 'dat.gui';

import { AppPlugin } from './common';
import { thing } from "./util/thing";


export class Sandbox extends AppPlugin {

    pointMaterial: three.Material;
    lineMaterial: three.Material;
    meshMaterial: three.Material;
    group: three.Group|null = null;

    showNormals = false;
    selectedThing = this.vine.name;

    constructor() {
        super();
        this.lineMaterial = new three.LineBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0.5 });
        this.meshMaterial = new three.MeshPhongMaterial({
            color: 0x156289, emissive: 0x072534,
            side: three.DoubleSide,
            flatShading: true });
        this.pointMaterial = new three.PointsMaterial({size: 8, vertexColors: three.VertexColors});
    }

    createGui(gui: dat.GUI, refreshWith: Function): void {
        const resetAll = refreshWith(() => this.init());
        gui.add(this, 'selectedThing', Object.keys(thing.things)).onChange(resetAll);
        gui.add(this, 'showNormals').onChange(resetAll);
    }

    init(): three.Group {

        this.group = new three.Group();
        this.group.position.set(0, 300, 0);

        const mesh = thing.things[this.selectedThing].bind(this)();
        this.group.add(mesh);

        if (this.showNormals) {
            this.group.add(new three.VertexNormalsHelper(mesh, 4));
        }

        return this.group;
    }

    @thing
    customBufferGeom(): three.Object3D {
        // from https://threejs.org/docs/#api/en/core/BufferGeometry
        const geometry = new three.BufferGeometry();
        // create a simple square shape. We duplicate the top left and bottom right
        // vertices because each vertex needs to appear once per triangle.
        const vertices = new Float32Array( [
            -1.0, -1.0,  1.0,
            1.0, -1.0,  1.0,
            1.0,  1.0,  1.0,

            1.0,  1.0,  1.0,
            -1.0,  1.0,  1.0,
            -1.0, -1.0,  1.0
        ].map(x => x * 30) );


        // itemSize = 3 because there are 3 values (components) per vertex
        geometry.addAttribute( 'position', new three.BufferAttribute( vertices, 3 ) );
        return new three.Mesh( geometry, this.meshMaterial );
    }

    @thing
    tubeGeom(): three.Object3D {
        const path = new CustomSinCurve(50);
        const tubularSegments = 10;
        const radius = 10;
        const radiusSegments = 8;
        let geometry = new three.TubeBufferGeometry(path, tubularSegments, radius, radiusSegments, false);

        return new three.Mesh(geometry, this.meshMaterial);
    }

    @thing
    closedTubeGeom(): three.Object3D {
        const path = new CustomSinCurve(50);
        const tubularSegments = 100;
        const radius = 10;
        const radiusSegments = 64;
        let geometry = new three.TubeBufferGeometry(path, tubularSegments, radius, radiusSegments, false);

        const verts = Array.prototype.slice.call(geometry.getAttribute('position').array);
        const norms = Array.prototype.slice.call(geometry.getAttribute('normal').array);

        const lastVertIdx = verts.length/3 - 1;

        const firstPt = path.getPointAt(0);
        const lastPt = path.getPointAt(1);
        verts.push(firstPt.x, firstPt.y, firstPt.z);
        verts.push(lastPt.x, lastPt.y, lastPt.z);
        const firstPtIdx = lastVertIdx + 1;
        const lastPtIdx = lastVertIdx + 2;

        const indices = Array.prototype.slice.call(geometry.getIndex().array);

        for (let i = 0; i < radiusSegments; i++) {
            indices.push(i, i+1, firstPtIdx);
        }
        for (let i = 0; i < radiusSegments; i++) {
            indices.push(lastVertIdx-i, lastVertIdx-i-1, lastPtIdx);
        }

        const secondPt = path.getPointAt( 1 / tubularSegments);
        const secondToLastPt = path.getPointAt( (tubularSegments-1) / tubularSegments);

        const firstNorm = firstPt.sub(secondPt).normalize();
        norms.push(firstNorm.x, firstPt.y, firstPt.z);
        const lastNorm = lastPt.sub(secondToLastPt).normalize();
        norms.push(lastNorm.x, lastNorm.y, lastNorm.z);

        geometry.addAttribute( 'position', new three.Float32BufferAttribute( verts, 3 ) );
        geometry.addAttribute( 'normal', new three.Float32BufferAttribute( norms, 3 ) );
        geometry.setIndex(indices);

        return new three.Mesh(geometry, this.meshMaterial);
    }

    @thing
    skelly(): three.Object3D {
        const group = new three.Group();

        const path = new CustomSinCurve(200);
        const tubularSegments = 16;
        const radius = 48;
        const radiusSegments = 16;
        let geometry = new three.TubeBufferGeometry(path, tubularSegments, radius, radiusSegments, false);

        let geo2 = new three.Geometry();

        const verts = Array.prototype.slice.call(geometry.getAttribute('position').array);

        const ptsToHilite = [];
        const colorsToHilite = [];

        let pt;
        for (let i = 0; i <= tubularSegments; i++) {
            pt = path.getPointAt( i / tubularSegments);

            ptsToHilite.push(pt.x, pt.y, pt.z);
            colorsToHilite.push(1, 0.5, 0);

            for (let j = 0; j <= radiusSegments; j++) {
                const vIdx = 3 * (i * (radiusSegments+1) + j);

                const vPt = new three.Vector3(verts[vIdx], verts[vIdx+1], verts[vIdx+2]);

                ptsToHilite.push(vPt.x, vPt.y, vPt.z);
                colorsToHilite.push(0, 1, 1);

                geo2.vertices.push(
                    pt,
                    vPt
                )
            }
            geo2.vertices.push(pt);
        }

        const material = new three.LineBasicMaterial({
            color: new three.Color(0.1, 0.2, 0.3)
        });

        group.add(new three.Line(geo2, material));

        // mark points
        const ptGeo = new three.BufferGeometry();
        ptGeo.addAttribute('position', new three.Float32BufferAttribute(ptsToHilite, 3));
        ptGeo.addAttribute('color', new three.Float32BufferAttribute(colorsToHilite, 3));
        ptGeo.computeBoundingSphere();
        const ptObj = new three.Points(ptGeo, this.pointMaterial);
        group.add(ptObj);

        return group;
    }

    @thing
    vine(): three.Object3D {
        console.log('vine');
        const path = new CustomSinCurve(50);
        const tubularSegments = 128;
        const radius = 4;
        const radiusSegments = 16;
        const geometry = new three.TubeBufferGeometry(path, tubularSegments, radius, radiusSegments, false);

        const radiusFn = (t: number) => 0.5 + 0.5*Math.sin(2 * Math.PI * (t-0.25));

        const verts = Array.prototype.slice.call(geometry.getAttribute('position').array);
        // const norms = Array.prototype.slice.call(geometry.getAttribute('normal').array);

        let pt: three.Vector3 = new three.Vector3(),
            newPt: three.Vector3 = new three.Vector3(),
            pathPt: three.Vector3;
        for (let i = 0; i <= tubularSegments; i++) {
            const t = i / tubularSegments;
            pathPt = path.getPointAt(t);

            for (let j = 0; j <= radiusSegments; j++) {
                const vIdx = 3 * (i * (radiusSegments+1) + j);
                pt.set(verts[vIdx], verts[vIdx+1], verts[vIdx+2]);
                // scale points of a tube towards its center
                newPt.copy(pt.sub(pathPt).multiplyScalar(radiusFn(t)).add(pathPt));
                verts[vIdx] = newPt.x;
                verts[vIdx+1] = newPt.y;
                verts[vIdx+2] = newPt.z;
            }
        }

        // todo: reimplement end caps
        geometry.addAttribute( 'position', new three.Float32BufferAttribute( verts, 3 ) );
        // geometry.addAttribute( 'normal', new three.Float32BufferAttribute( norms, 3 ) );
        // geometry.setIndex(indices);

        return new three.Mesh(geometry, this.meshMaterial);
    }

}

class CustomSinCurve extends three.Curve<three.Vector3> {
    constructor(
        public scale: number = 1
    ) {
        super();
    }

    getPoint(t: number) {
        const tx = t * 3 - 1.5;
        const ty = Math.sin( 2 * Math.PI * (t-0.25) );
        const tz = 0;

        return new three.Vector3(tx, ty, tz).multiplyScalar(this.scale);
    }
}
