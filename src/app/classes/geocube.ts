import { PolyCube } from './polycube.interface';
import { DataManager } from './datamanager';
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from '../../../node_modules/three-renderer-css3d';
import { VIEW_STATES } from './viewStates';

export class GeoCube implements PolyCube {
    private dm: DataManager;
    private webGLScene: THREE.Scene;
    private cssScene: THREE.Scene;
    private color: string;
    private gCubeGroup: THREE.Group;

    

    init(dm: DataManager, webGLScene: THREE.Scene, cssScene?: THREE.Scene): void {
        this.dm = dm;
        this.webGLScene = webGLScene;
        if(cssScene) this.cssScene = cssScene;
        this.gCubeGroup = new THREE.Group();
        this.assembleData();
        this.render();
    }
    
    assembleData(): void {
        this.color = this.dm.getData()[2];
        console.log(this.color);
    }
    
    render(): void {
        console.log('rendering geocube');
        let material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(this.color),
            wireframe: true
        });
    
        // create a box and add it to the scene
        let box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
   
        this.gCubeGroup.name = 'GEO_CUBE';
        this.gCubeGroup.position.set(0,0,0);
        this.gCubeGroup.add(box);

        this.webGLScene.add(this.gCubeGroup);
    }

    update(currentViewState: VIEW_STATES): void {       
        if(currentViewState.valueOf() === VIEW_STATES.GEO_CUBE || currentViewState.valueOf() === VIEW_STATES.POLY_CUBE) {
            this.webGLScene.add(this.gCubeGroup);
        }
    }

    getCubePosition(): THREE.Vector3 {
        let positionInWorld = new THREE.Vector3();
        this.gCubeGroup.getWorldPosition(positionInWorld);
        return positionInWorld;
    }

    onClick($event: any): void {
        console.log($event);
        console.log('geocube onclick')
    }
}