import { CurvePath, LineCurve3, Vector3 } from 'three';
import { Random } from './util/random';


const TREE_HEIGHT = 400;
const MAX_BRANCHES = 100;


export class Tree {
    static seed = 12345;
    private static branchDP = 9990;
    private static branchShrink = 0.9;
    private static maxLevel = 5;

    trunk: Branch;
    branches: Branch[];
    height = 400;
    rand: Random;

    constructor() {
        this.rand = new Random(Tree.seed.toString());
        this.trunk = new Branch(this);
        this.branches = [this.trunk];
    }

    grow(): boolean {
        let stillGrowing = false;
        let spawnedBranches: Branch[] = [];
        const maxD = Branch.maxV * Branch.dy;

        for (let branch of this.branches) {
            if (branch.y >= TREE_HEIGHT * Math.pow(Tree.branchShrink, branch.level)) {
                continue;
            } else {
                stillGrowing = true;
            }

            branch.vx = pin(branch.vx + this.rand.inRange(-Branch.k, Branch.k), -maxD, maxD);
            branch.vz = pin(branch.vz + this.rand.inRange(-Branch.k, Branch.k), -maxD, maxD);
            branch.addPt(new Vector3(
                branch.x + branch.vx,
                branch.y + Branch.dy,
                branch.z + branch.vz));
            branch.segments += branch.dSegments;
            branch.p = 1 - ((1-branch.p) * Math.pow(Tree.branchDP/10000, Branch.dy));

            if (this.branches.length < MAX_BRANCHES && branch.level < Tree.maxLevel) {
                // todo: limit branches added to <= MAX
                spawnedBranches = spawnedBranches.concat(branch.spawn());
            }
        }

        this.branches = this.branches.concat(spawnedBranches);
        return stillGrowing;
    }
}


export class Branch {
    static initialP = 0.4;  // starting probability of branching
    static dy = 10;
    static maxV = 0.3;  // todo: specify as angle
    static k = 1;

    parent: Tree|Branch;
    rand: Random;
    points: Array<Vector3> = [];
    path: CurvePath<Vector3> = new CurvePath();
    level: number;

    readonly dSegments = 2;
    segments = this.dSegments;

    p = Branch.initialP;  // current probability of branching
    vx = 0;
    vz = 0;

    constructor(parent: Tree|Branch) {
        this.parent = parent;
        this.rand = parent.rand;
        if (parent instanceof Branch) {
            this.addPt(parent.points[parent.points.length-2]);
            this.addPt(parent.points[parent.points.length-1]);
            this.level = parent.level + 1;
            // this.vx = parent.vx;
            // this.vz = parent.vz;
            this.vx = parent.vx + this.rand.inRange(-Branch.k, Branch.k);
            this.vz = parent.vx + this.rand.inRange(-Branch.k, Branch.k);
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
                // this.p = Branch.initialP;
                this.p = 0;
            }
        }
        return spawnedBranches;
    }

    private numBranchesToSpawn() { // todo: different random instances for each thing
        return this.rand.next() < this.p ? 1 : 0;
    }
}


function pin(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}
