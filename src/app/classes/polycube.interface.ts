import * as THREE from 'three-full';

export interface PolyCube {
    // items
    cubeGroupGL: THREE.Group,
    cubeGroupCSS: THREE.Group,

    // cube management
    createObjects: Function,
    assembleData: Function,
    render: Function,
    filterData: Function,
    resetSelection: Function,
    resetCategorySelection: Function,
    toggleDisplayCube: Function,
    cubeToggle: Boolean,

    // updating settings / data
    updateView: Function,
    updateData: Function,
    updateNodeSize: Function,
    updateNodeColor: Function,
    updateNumSlices: Function,
    updateTime: Function,

    // hide cube
    hideCube: Function,

    hideLabels: Function,
    showLabels: Function,
    clearLabels: Function,

    // temporal encodings
    transitionSTC: Function,
    transitionSI: Function,
    transitionJP: Function,
    transitionANI: Function,

    // util
    getCubePosition: Function,
    hideBottomLayer: Function, 
    showBottomLayer: Function, 

    // interactions
    highlightObject: Function,

    // event handleers
    onClick: Function,
    onDblClick: Function
}