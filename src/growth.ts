import {
    CurvePath,
    DoubleSide,
    LineBasicMaterial,
    LineCurve3,
    LineSegments,
    Mesh,
    MeshLambertMaterial,
    MeshPhongMaterial,
    SphereGeometry,
    TubeBufferGeometry,
    Vector3
} from "three";
import * as dat from 'dat.gui';

import { AppPlugin } from './common';


export class Growth implements AppPlugin {
    // gui parameters - defaults
    extrusionSegments = 100;
    radiusSegments = 16;
    radius = 5;
    closed = true;
    showPts = false;
    showWireframe = true;

    heightOffGround = 300;
    height = 200;

    createGui(gui: dat.GUI, refreshWith: Function): void {
        const reset = refreshWith(() => this.update());

        gui.add(this, 'extrusionSegments', 5, 10000).step(5).onChange(reset);
        gui.add(this, 'radiusSegments', 1, 32).step(1).onChange(reset);
        gui.add(this, 'radius', 1, 100).step(1).onChange(reset);
        gui.add(this, 'closed').onChange(reset);
        gui.add(this, 'showPts').onChange(reset);

        gui.add(this, 'showWireframe').onChange(reset);
    }

    update(): Mesh {
        const points = [];
        for (let t = -this.height/2; t < this.height/2; t += 5) {
            points.push(new Vector3(0, t, 0));
        }

        const path: CurvePath<Vector3> = new CurvePath();
        for (let i = 1; i < points.length; i++) {
            path.add(new LineCurve3(points[i-1], points[i]));
        }

        const lineMaterial = new LineBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0.5 });
        const meshMaterial = new MeshPhongMaterial({
            color: 0x156289, emissive: 0x072534, side: DoubleSide, flatShading: true });
        const dotMaterial = new MeshLambertMaterial({
            color: 0xff00ff, transparent: true, opacity: 1 });

        const tubeGeometry = new TubeBufferGeometry(
            path, this.extrusionSegments, this.radius, this.radiusSegments, this.closed);
        const mesh = new Mesh(tubeGeometry, meshMaterial);
        mesh.position.set(0, this.heightOffGround, 0);
        if (this.showWireframe) {
            const wireframe = new LineSegments(tubeGeometry, lineMaterial);
            mesh.add(wireframe);
        }

        // points
        if (this.showPts) {
            for (let i = 0; i < points.length; i++) {
                const sphere = new SphereGeometry(this.radius * 1.2, 8, 8);
                sphere.translate(points[i].x, points[i].y, points[i].z);
                const sphereMesh = new Mesh(sphere, dotMaterial);
                mesh.add(sphereMesh);
            }
        }

        return mesh;
    }
}
