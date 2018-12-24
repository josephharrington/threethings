
export function calcGcd(a, b) {
    while (b > 0) {
        let temp = b;
        b = a % b;
        a = temp;
    }
    return a;
}

export function calcLcm(a, b) {
    return a * (b / calcGcd(a, b));
}
