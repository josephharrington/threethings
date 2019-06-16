import * as THREE from 'three';

window.THREE = THREE;  // The following libs require global THREE
require('three/examples/js/controls/OrbitControls');
require('three/examples/js/exporters/STLExporter');
require('three/examples/js/exporters/OBJExporter');

export const OrbitControls = THREE.OrbitControls;
export const STLExporter = THREE.STLExporter;
export const OBJExporter = THREE.OBJExporter;
