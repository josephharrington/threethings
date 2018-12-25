import { App } from './common.js';
import * as spiro from './spiro.js';

function main() {
    const app = new App();
    app.HEIGHT_OFF_GROUND = spiro.HEIGHT_OFF_GROUND;
    spiro.initGui(app.gui, app);
    app.reset(spiro.updateMath);
    app.startAnimating(30);
}

main();
