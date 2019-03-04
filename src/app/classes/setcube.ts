import { PolyCube } from './polycube.interface';
import { DataManager } from './datamanager';
import * as THREE from 'three';
import { VIEW_STATES } from './viewStates';

export class SetCube implements PolyCube {
    private dm: DataManager;
    private scene: THREE.Scene;
    private color: string;
    private sCubeGroup: THREE.Group;

    init(dm: DataManager, scene: THREE.Scene): void {
        this.dm = dm;
        this.scene = scene;
        this.sCubeGroup = new THREE.Group();
        this.assembleData();
        this.render();
    }
    
    assembleData(): void {
        this.color = this.dm.getData()[1];
        console.log(this.color);
    }
    render(): void {
        console.log('rendering setcube');
        let material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(this.color),
            wireframe: true
        });
    
        // create a box and add it to the scene
        let box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
        box.position.x = 5;
        box.rotation.y = 0.5;

        this.sCubeGroup.name = 'SET_CUBE';
        this.sCubeGroup.add(box);

        this.scene.add(this.sCubeGroup);
    }

    
    update(currentViewState: VIEW_STATES): void {
        if(currentViewState.valueOf() === VIEW_STATES.SET_CUBE || currentViewState.valueOf() === VIEW_STATES.POLY_CUBE) {
            this.scene.add(this.sCubeGroup);
        }
    }

    onClick($event: any): void {

    }
}