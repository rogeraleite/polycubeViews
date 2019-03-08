import * as THREE from 'three-full';

export interface PolyCube {
    // items
    cubeGroupGL: THREE.Group,
    cubeGroupCSS: THREE.Group,

    // cube management
    createObjects: Function,
    assembleData: Function,
    render: Function,
    update: Function,
    updateData: Function,

    // temporal encodings
    transitionSTC: Function,
    transitionSI: Function,
    transitionJP: Function,
    transitionANI: Function,

    // util
    getCubePosition: Function,

    // event handleers
    onClick: Function,
    onDblClick: Function
}