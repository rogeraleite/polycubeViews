import * as THREE from 'three-full';

export class Camera {
    perspectiveCamera: THREE.Camera;
    orthographicCamera: THREE.Camera;

    _position: THREE.Vector3;
    _lookAt: THREE.Vector3;

    set position(pos: THREE.Vector3) {
        this._position.set(pos.x, pos.y, pos.z);
    }

    get position(): THREE.Vector3 {
        return this._position;
    }

    set lookAt(lookAt: THREE.Vector3) {
        this._lookAt.set(lookAt.x, lookAt.y, lookAt.z);
    }

    get lookAt(): THREE.Vector3 {
        return this._lookAt;
    }

    constructor(width: number, height: number) {
        this.perspectiveCamera = new THREE.PerspectiveCamera(75, width / height, .1, 10000);
        this.orthographicCamera = new THREE.OrthographicCamera(width/-2, width/2, height/2, height/-2, .1, 10000);
    }

    useOrthographicCamera(): void {

    }

    usePerspectiveCamera(): void {

    }


}