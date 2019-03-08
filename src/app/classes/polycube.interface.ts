import * as THREE from 'three-full';

export interface PolyCube {
    cubeGroupGL: THREE.Group,
    cubeGroupCSS: THREE.Group,

    createObjects: Function,
    assembleData: Function,
    render: Function,
    update: Function,
    getCubePosition: Function,
    onClick: Function
}