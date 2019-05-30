
export interface Vector2D {
    x: number;
    y: number;
}

export function distSq(v: Vector2D, w: Vector2D) {
    return (v.x - w.x)**2 + (v.y - w.y)**2;
}

export function closestPointOnSegment(p: Vector2D, a: Vector2D, b: Vector2D): Vector2D {
    const l2 = distSq(a, b);
    if (l2 == 0) return a;
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return {
        x: a.x + t * (b.x - a.x),
        y: a.y + t * (b.y - a.y),
    };
}
