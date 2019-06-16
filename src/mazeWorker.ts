import {quadtree} from "d3-quadtree";
import {Vector2} from "three";

import {WorkerRequest, WorkerResponse} from "./mazer";
import {closestPointOnSegment} from "./util/geometry";
import {BoundingBox, isLeafNode, RectQuadtree, RectQuadtreeInternalNode, RectQuadtreeLeaf} from "./util/quadtree";
import {Random} from "./util/random";

const ctx: Worker = self as any;
const rand = new Random();  // todo: seed

ctx.addEventListener('message', (event: {data: WorkerRequest}) => {
    const {
        numSteps,
        params,
    } = event.data;

    let points = event.data.points;
    points = points.map(p => new Vector2(p.x, p.y));
    const calc = new MazeCalc(params);

    for (let i = 0; i < numSteps; i++) {
        const nextPoints: Vector2[] = [];
        const segmentQuadtree = calc.initQuadtree(points);
        for (let i = 0; i < points.length; i++) {
            const pt = points[i];
            const leftPt = points[i-1] || points[points.length-1];
            const rightPt = points[i+1] || points[0];
            const newPt = pt.clone()
                .add(calc.brownian(pt))
                .add(calc.fairing(pt, leftPt, rightPt))
                .add(calc.attractRepel(i, points, segmentQuadtree));
            nextPoints.push(newPt);
        }
        calc.resample(nextPoints);
        points = nextPoints;
    }

    const response: WorkerResponse = {
        points,
    };
    ctx.postMessage(response);
});

class MazeCalc {
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

    constructor(params: WorkerRequest['params']) {
        this.N_MIN = params.N_MIN;
        this.R1 = params.R1;
        this.SIGMA = params.SIGMA;
        this.DELTA = params.DELTA;
        this.BROWNING_AMP = params.BROWNING_AMP;
        this.SAMPLING_RATE = params.SAMPLING_RATE;
        this.FAIRING_AMPLITUDE = params.FAIRING_AMPLITUDE;
        this.ATTR_REPEL_AMPLITUDE = params.ATTR_REPEL_AMPLITUDE;
        this.kMin = params.kMin;
        this.kMax = params.kMax;
    }

    initQuadtree(points: Vector2[]): RectQuadtree<Segment> {  // todo pass in segments?
        const segments = [];
        for (let iB = 0; iB < points.length; iB++) {
            const iA = iB === 0 ? points.length-1 : iB-1;
            const p1 = points[iA];
            const p2 = points[iB];
            segments.push({
                p1,
                p2,
                indexA: iA,
                indexB: iB,
            });
        }
        const segmentQuadtree: RectQuadtree<Segment> = quadtree<Segment>()
            .x(s => (s.p1.x + s.p2.x)/2)
            .y(s => (s.p1.y + s.p2.y)/2)
            .addAll(segments);
        this.addSegmentBBoxes(segmentQuadtree.root());
        return segmentQuadtree
    }

    /**
     * "To control random structural variations, a random offset vector (chosen stochastically based on a Normal
     * Distribution with mean 0 and variance σ), zi, is added to each sample point, pi, using the equation:
     *     Bi = fB(pi) · zi · δ(pi) · D
     */
    brownian(pt: Vector2): Vector2 {
        return this.rand2dVector()
            .multiplyScalar(this.browningAmplitude(pt))
            .multiplyScalar(this.delta(pt))
            .multiplyScalar(this.samplingRate());
    }

    private rand2dVector(): Vector2 {
        const x = rand.nextNormal();
        const y = rand.nextNormal();
        const v = new Vector2(x, y);
        return v.normalize();
    }

    /** "To simulate local smoothness, a Laplacian term is added..." */
    fairing(pt: Vector2, leftPt: Vector2, rightPt: Vector2): Vector2 {
        const deltaR = this.delta(rightPt);
        const deltaL = this.delta(leftPt);
        const n1 = leftPt.clone().multiplyScalar(deltaR);
        const n2 = rightPt.clone().multiplyScalar(deltaL);
        const mid = n1.add(n2).divideScalar(deltaL + deltaR);

        return mid.sub(pt).multiplyScalar(this.fairingAmplitude(pt));
    }

    attractRepel(i: number, points: Vector2[], segmentQuadtree: RectQuadtree<Segment>): Vector2 {
        const pi = points[i];
        const segmentForceSum = new Vector2(0, 0);

        const closeSegments: Segment[] = [];
        const pad = this.R1;
        const left = pi.x - pad;
        const right = pi.x + pad;
        const top = pi.y - pad;
        const bottom = pi.y + pad;

        segmentQuadtree.visit((segmentNode) => {
            if (isLeafNode(segmentNode)) {  // leaf quad node
                do {
                    const bbox = segmentNode.bbox;
                    if (!!bbox && bbox.x1 >= left && bbox.x0 <= right
                        && bbox.y1 >= top && bbox.y0 <= bottom) {
                        closeSegments.push(segmentNode.data);
                    }
                    if (isLeafNode(segmentNode.next)) {
                        segmentNode = segmentNode.next;
                    } else {
                        break;
                    }
                } while (segmentNode);
                return false;  // shouldn't matter -- no children
            } else {
                const bbox = segmentNode.bbox;
                return !!bbox && (bbox.x0 > right || bbox.y0 > bottom || bbox.x1 < left || bbox.y1 < top);
            }
        });

        const len = points.length;
        for (let segment of closeSegments) {
            const j = segment.indexB;
            const segmentSeparation = Math.min(
                Math.max(
                    Math.abs(j-i),
                    Math.abs(j+1-i),
                ),
                Math.max(  // this handles when i and j span the segment connecting first and last indices
                    Math.abs(j-i+len),
                    Math.abs(j+1-i+len),
                ),
            );
            if (segmentSeparation <= this.N_MIN) {
                continue;
            }
            const pjA = points[segment.indexA];
            const pjB = points[segment.indexB];
            const {x: closestX, y: closestY} = closestPointOnSegment(pi, pjA, pjB);
            const xij = new Vector2(closestX, closestY);

            if (pi.clone().sub(xij).length() >= this.R1 * Math.min(this.delta(pi), this.delta(xij))) {
                continue;
            }
            segmentForceSum.add(
                this.forceFromSegment(pi, xij)
            )
        }

        return segmentForceSum.multiplyScalar(this.attractRepelAmplitude(pi));
    }

    private forceFromSegment(p: Vector2, x: Vector2): Vector2 {
        const diff = p.clone().sub(x);
        return diff.normalize().multiplyScalar(
            this.lennardJonesPotential(diff.length() / (this.samplingRate() * this.delta(p)))
        );
    }

    resample(points: Vector2[]) {
        if (points.length <= 1) return;
        let i = 1;
        while (points[i] !== undefined) {
            const [p1, p2] = [points[i],  points[i-1]];
            const len = p1.clone().sub(p2).length();
            if (len > this.dMax(p1, p2)) {  // split
                // console.log('a');
                const mid = p1.clone().add(p2).divideScalar(2);
                points.splice(i, 0, mid);
                // do not increment i since element i changed
            } else if (len < this.dMin(p1, p2)) {  // delete
                // console.log('b');
                points.splice(i, 1);
                // do not increment i since element i changed
            } else {
                // console.log('c');
                i++;
            }
        }
        // todo: last and first points
    }

    private addSegmentBBoxes(
        segmentNode: RectQuadtreeInternalNode<Segment> | RectQuadtreeLeaf<Segment> | undefined
    ): BoundingBox|undefined {
        if (!segmentNode) {
            return undefined;
        }
        if (isLeafNode(segmentNode)) {
            segmentNode.bbox = this.getSegmentBoundingBox(segmentNode.data);
            return segmentNode.bbox;
        }

        let linkNodeBBox: BoundingBox|undefined = undefined;
        for (let childNodeBBox of segmentNode.map((n) => this.addSegmentBBoxes(n))) {
            if (!childNodeBBox) {
                continue;
            }
            if (!linkNodeBBox) {
                linkNodeBBox = {...childNodeBBox};
            } else {
                linkNodeBBox.x0 = Math.min(linkNodeBBox.x0, childNodeBBox.x0);
                linkNodeBBox.y0 = Math.min(linkNodeBBox.y0, childNodeBBox.y0);
                linkNodeBBox.x1 = Math.max(linkNodeBBox.x1, childNodeBBox.x1);
                linkNodeBBox.y1 = Math.max(linkNodeBBox.y1, childNodeBBox.y1);
            }
        }
        segmentNode.bbox = linkNodeBBox;
        return linkNodeBBox;
    }

    private getSegmentBoundingBox(segment: Segment): BoundingBox {
        return {
            x0: Math.min(segment.p1.x, segment.p2.x),
            y0: Math.min(segment.p1.y, segment.p2.y),
            x1: Math.max(segment.p1.x, segment.p2.x),
            y1: Math.max(segment.p1.y, segment.p2.y),
        };
    }


    private dMax(p1: Vector2, p2: Vector2) {
        return this.kMax * this.samplingRate() * (this.delta(p1) + this.delta(p2)) / 2;
    }

    private dMin(p1: Vector2, p2: Vector2) {
        return this.kMin * this.samplingRate() * (this.delta(p1) + this.delta(p2)) / 2;
    }

    private lennardJonesPotential(r: number): number {
        const t = this.SIGMA / r;
        const t6 = t**6;
        return t6*t6 - t6;
    }

    /** "δ : R2→(0,1] is used to control the scale of the patterns and support self-similiarity" */
    private delta(pt: Vector2): number {
        return this.DELTA;  // todo: implement texture map
    }

    /** "fB : R2→R modulates the amplitude of the offset" */
    private browningAmplitude(pt: Vector2): number {
        return this.BROWNING_AMP;
    }

    /** "Note that the sampling rate can be controlled globally by changing D" */
    private samplingRate(): number {
        return this.SAMPLING_RATE;
    }

    /** "ff: R2→[0; 1] allows the fairing to vary spatially" */
    private fairingAmplitude(pt: Vector2): number {
        return this.FAIRING_AMPLITUDE;
        // return this.FAIRING_AMPLITUDE * ((pt.x)/9000 + 1);
    }

    private attractRepelAmplitude(pt: Vector2): number {
        return this.ATTR_REPEL_AMPLITUDE;
    }
}

interface Segment {
    p1: Vector2;
    p2: Vector2;
    indexA: number;
    indexB: number;
}

