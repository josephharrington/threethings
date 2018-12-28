import * as log from 'loglevel';

import { App } from './common';
import { Spiro } from './spiro';
import { Growth } from "./growth";

function main() {
    log.setLevel('debug');
    // const plugin = new Spiro();
    const plugin = new Growth();
    const app = new App(plugin);
    app.startAnimating(20);
}

main();
