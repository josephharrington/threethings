import * as seedrandom from 'seedrandom';


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

    next(): number {
        return this.srandom();
    }

    inRange(min: number, max: number): number {
        return (this.srandom() * (max - min)) + min;
    }
}
