import { App } from './common';
import { Spiro } from './spiro';

function main() {
    const spiro = new Spiro();
    const app = new App(spiro);
    // app.initGui(spiro.createGui);
    // app.refreshMesh(spiro.update);
    app.startAnimating(20);
}

main();
