import {Quadtree, QuadtreeInternalNode, QuadtreeLeaf} from "d3-quadtree";

export function isLeafNode<T>(node: QuadtreeInternalNode<T>|QuadtreeLeaf<T>|undefined): node is QuadtreeLeaf<T> {
    return node !== undefined && node.length === undefined;
}

export interface RectQuadtreeLeaf<T> extends QuadtreeLeaf<T> {
    bbox?: BoundingBox;
}

export interface RectQuadtreeInternalNode<T> extends QuadtreeInternalNode<T> {
    bbox?: BoundingBox;
}

export interface BoundingBox {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}

export interface RectQuadtree<T> extends Quadtree<T> {
    root(): RectQuadtreeInternalNode<T> | RectQuadtreeLeaf<T>;
    visit(callback: (node: RectQuadtreeInternalNode<T> | RectQuadtreeLeaf<T>, x0: number, y0: number, x1: number, y1: number) => void | boolean): this;
    visitAfter(callback: (node: RectQuadtreeInternalNode<T> | RectQuadtreeLeaf<T>, x0: number, y0: number, x1: number, y1: number) => void): this;
}
