import './styles.css';

import * as log from 'loglevel';

import {App} from './common';
import {Spiro} from './spiro';
import {Growth} from './growth';
import {Sandbox} from './sandbox';
import {Mazer} from './mazer';

function main() {
    log.setLevel('debug');
    const app = new App([
        new Mazer(),
        new Growth(),
        new Spiro(),
        new Sandbox(),
    ]);
    app.startAnimating(20);
}

main();
