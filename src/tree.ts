import {CurvePath, LineCurve3, Vector3} from "three";


const TREE_HEIGHT = 400;
const MAX_BRANCHES = 100;


export class Tree {
    static branchDP = 9999;
    static branchShrink = 0.9;

    trunk: Branch;
    branches: Branch[];
    height = 400;

    constructor() {
        this.trunk = new Branch(null);
        this.branches = [this.trunk];
    }

    grow(): boolean {
        let stillGrowing = false;
        let spawnedBranches: Branch[] = [];

        for (let branch of this.branches) {
            if (branch.y >= TREE_HEIGHT * Math.pow(Tree.branchShrink, branch.level)) {
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
            branch.p = 1 - ((1-branch.p) * Math.pow(Tree.branchDP/10000, branch.dy));

            if (this.branches.length < MAX_BRANCHES) {
                // todo: limit branches added to <= MAX
                spawnedBranches = spawnedBranches.concat(branch.spawn());
            }
        }

        this.branches = this.branches.concat(spawnedBranches);
        return stillGrowing;
    }
}


export class Branch {


    static initialP = 0.2;  // starting probability of branching

    points: Array<Vector3> = [];
    path: CurvePath<Vector3> = new CurvePath();
    level: number;

    readonly dSegments = 2;
    segments = this.dSegments;

    p = Branch.initialP;  // current probability of branching
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

    spawn(): Branch[] {
        const spawnedBranches = [];
        const numBranchesToSpawn = this.numBranchesToSpawn();
        if (numBranchesToSpawn > 0) {
            for (let i = 0; i < numBranchesToSpawn; i++) {
                const newBranch = new Branch(this);
                spawnedBranches.push(newBranch);
                this.p = Branch.initialP;
            }
        }
        return spawnedBranches;
    }

    private numBranchesToSpawn() { // todo: different random instances for each thing
        return Math.random() < this.p ? 1 : 0;
    }
}


function pin(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}


function random(min: number, max: number): number {
    return (Math.random() * (max - min)) + min;
}
