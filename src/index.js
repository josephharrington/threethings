import { App } from './common.js';
import * as spiro from './spiro.js';

function main() {
    const app = new App();
    app.initGui(spiro.createGui);
    app.refreshMesh(spiro.update);
    app.startAnimating(20);
}

main();
