import {
    CurvePath,
    DoubleSide,
    Group,
    LineBasicMaterial,
    LineCurve3,
    LineSegments,
    Mesh,
    MeshLambertMaterial,
    MeshPhongMaterial,
    SphereGeometry,
    TubeBufferGeometry,
    TubeGeometry,
    Vector3
} from "three";
import * as dat from 'dat.gui';
import * as log from 'loglevel';

import { AppPlugin, isGeometric } from './common';


export class Growth implements AppPlugin {
    // gui parameters - defaults
    extrusionSegments = 1;
    radiusSegments = 16;
    radius = 5;
    closed = false;
    showPts = false;
    showWireframe = false;

    heightOffGround = 300;
    height = 300;

    _intId: number = null

    _points: Array<Vector3> = [];
    _path: CurvePath<Vector3> = new CurvePath();
    _t: number = -this.height/2;

    createGui(gui: dat.GUI, refreshWith: Function): void {
        log.debug('growth.createGui');
        const reset = refreshWith(() => this.update());

        gui.add(this, 'extrusionSegments', 5, 10000).step(5).onChange(reset);
        gui.add(this, 'radiusSegments', 1, 32).step(1).onChange(reset);
        gui.add(this, 'radius', 1, 100).step(1).onChange(reset);
        gui.add(this, 'closed').onChange(reset);
        gui.add(this, 'showPts').onChange(reset);

        gui.add(this, 'showWireframe').onChange(reset);
    }

    _vx = 0;
    _vz = 0;
    _dt = 5;
    _maxV = 0.4 * this._dt;
    _k = 1;

    _grow() {
        if (this._t >= this.height/2 && this._intId) {
            clearInterval(this._intId);
            return;
        }
        const lastPt = this._points[this._points.length - 1] || new Vector3(0, this._t, 0);
        this._points.push(new Vector3(
            lastPt.x + this._vx,
            this._t,
            lastPt.z + this._vz)
        );
        if (this._points.length >= 2) {
            this._path.add(new LineCurve3(this._points[this._points.length-2], this._points[this._points.length-1]));
        }
        this._vx = Math.min(Math.max(this._vx + 2*this._k*Math.random()-this._k, -this._maxV), this._maxV);
        this._vz = Math.min(Math.max(this._vz + 2*this._k*Math.random()-this._k, -this._maxV), this._maxV);
        this._t += this._dt;
        this.extrusionSegments += 2;
    }

    _getGeom() {
        return new TubeGeometry(
            this._path, this.extrusionSegments, this.radius, this.radiusSegments, this.closed);
    }

    update(): Group {
        log.info('growth.update');

        const lineMaterial = new LineBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0.5 });
        const meshMaterial = new MeshPhongMaterial({
            color: 0x156289, emissive: 0x072534, side: DoubleSide, flatShading: true });
        const dotMaterial = new MeshLambertMaterial({
            color: 0xff00ff, transparent: true, opacity: 1 });

        this._grow();
        this._grow();
        const geom = this._getGeom();
        const group = new Group();
        group.add(new Mesh(geom, meshMaterial));
        group.position.set(0, this.heightOffGround, 0);
        if (this.showWireframe) {
            const wireframe = new LineSegments(geom, lineMaterial);
            group.add(wireframe);
        }

        if (this._intId) {
            clearInterval(this._intId);
        }
        this._intId = setInterval(() => {
            log.debug('growing');
            this._grow();
            const geom = this._getGeom();
            for (let child of group.children) {
                if (isGeometric(child)) {
                    child.geometry.dispose();
                    child.geometry = geom;
                }
            }
        }, 50);

        return group;
    }
}



class Tree {

}
