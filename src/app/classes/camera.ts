import * as THREE from 'three';

export class Camera {
    perspectiveCamera: THREE.PerspectiveCamera;

    constructor() {
        console.log('creating new camera');
        this.perspectiveCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, .1, 10000);
    }


}