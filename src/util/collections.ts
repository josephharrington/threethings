

export function collectEntries<T>(items: T[], keyGetter: (item: T) => string): {[key: string]: T} {
    const mappedItems: {[key: string]: T} = {};
    items.reduce((map, item) => {
        map[keyGetter(item)] = item;
        return map;
    }, mappedItems);
    return mappedItems;
}