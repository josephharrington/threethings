import * as three from "three";

const _things: {[k:string]: () => three.Object3D} = {};

const _thing = (
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<() => three.Object3D>
) => {
    if (descriptor.value) {
        _things[propertyKey] = descriptor.value;
    }
};

export const thing = Object.assign(_thing, { things: _things });
