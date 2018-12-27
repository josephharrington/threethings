
export function calcGcd(a: number, b: number) : number {
    while (b > 0) {
        let temp = b;
        b = a % b;
        a = temp;
    }
    return a;
}

export function calcLcm(a: number, b: number) : number {
    return a * (b / calcGcd(a, b));
}
