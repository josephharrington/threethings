import * as log from 'loglevel';

import { App } from './common';
import { Spiro } from './spiro';
import { Growth } from "./growth";
import { Sandbox } from "./sandbox";

function main() {
    log.setLevel('debug');
    const app = new App([
        new Sandbox(),
        new Spiro(),
        new Growth(),
    ]);
    app.startAnimating(20);
}

main();
