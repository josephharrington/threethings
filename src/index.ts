import { App } from './common';
import { Spiro } from './spiro';
import { Growth } from "./growth";

function main() {
    // const spiro = new Spiro();
    const growth = new Growth();
    const app = new App(growth);
    // app.initGui(spiro.createGui);
    // app.refreshMesh(spiro.update);
    app.startAnimating(20);
}

main();
