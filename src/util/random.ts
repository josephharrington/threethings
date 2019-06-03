import seedrandom from 'seedrandom';


export class Random {
    seed: string;
    srandom: seedrandom.prng;

    constructor(seed?: string) {
        if (seed === undefined) {
            seed = Math.random().toString();
        }
        this.seed = seed;
        this.srandom = seedrandom(seed);
    }

    /**
     * Return a random number uniformly distributed in [0, 1)
     */
    next(): number {
        return this.srandom();
    }

    inRange(min: number, max: number): number {
        return (this.srandom() * (max - min)) + min;
    }

    /**
     * Standard Normal variate using Box-Muller transform
     * https://stackoverflow.com/a/36481059/10452774
     */
    nextNormal(): number {
        let u = 0, v = 0;
        while(u === 0) u = this.next();  //Converting [0,1) to (0,1)
        while(v === 0) v = this.next();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }
}
