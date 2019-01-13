import * as log from 'loglevel';

import { App } from './common';
import { Spiro } from './spiro';
import { Growth } from "./growth";
import { Sandbox } from "./sandbox";

function main() {
    log.setLevel('debug');
    // const plugin = new Spiro();
    // const plugin = new Growth();
    const plugin = new Sandbox();
    const app = new App(plugin);
    app.startAnimating(20);
}

main();
