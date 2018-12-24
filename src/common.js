import * as THREE from 'three';
import * as dat from 'dat.gui';

window.THREE = THREE;  // The following two libs require global THREE
require('three/examples/js/controls/OrbitControls');
require('three/examples/js/exporters/STLExporter');
export const Three = THREE;

export function App() {
    this.exporter = new Three.STLExporter();
    this.gui = this._initGui();
    this.mesh = null;

    this._initDownload();
}

App.prototype.saveStl = function() {
    const result = this.exporter.parse(this.mesh);
    this._saveString(result, 'box.stl');
};


App.prototype._initGui = function() {
    const gui = new dat.GUI();
    gui.add(this, 'saveStl');  // todo: append to end?
    gui.open();
    return gui;
};

App.prototype._initDownload = function() {
    this._link = document.createElement('a');
    this._link.style.display = 'none';
    document.body.appendChild(this._link);

};

App.prototype._saveString = function(text, filename) {
    this._save(new Blob([text], {type: 'text/plain'}), filename);
};

App.prototype._save = function(blob, filename) {
    this._link.href = URL.createObjectURL( blob );
    this._link.download = filename;
    this._link.click();
};

