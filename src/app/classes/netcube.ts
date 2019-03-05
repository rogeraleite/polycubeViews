import { PolyCube } from './polycube.interface';
import { DataManager } from './datamanager';
import * as THREE from 'three';
import { VIEW_STATES } from './viewStates';

export class NetCube implements PolyCube {
    private dm: DataManager;
    private scene: THREE.Scene;

    private color: string;
    private nCubeGroup: THREE.Group;
    init(dm: DataManager, scene: THREE.Scene): void {
        this.dm = dm;
        this.scene = scene;
        this.nCubeGroup = new THREE.Group();
        this.assembleData();
        this.render();
    }
    
    assembleData(): void {
        this.color = this.dm.getData()[0];
        console.log(this.color);
    }
    
    render(): void {
        console.log('rendering netcube');
        let material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(this.color),
            wireframe: true
        });
    
        // create a box and add it to the scene
        let box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
        
        this.nCubeGroup.name = 'NET_CUBE';
        this.nCubeGroup.position.set(6,0,0);
        this.nCubeGroup.add(box);

        this.scene.add(this.nCubeGroup);
        
    }

    update(currentViewState: VIEW_STATES): void {
        if(currentViewState.valueOf() === VIEW_STATES.NET_CUBE || currentViewState.valueOf() === VIEW_STATES.POLY_CUBE) {
            this.scene.add(this.nCubeGroup);
        }
    }

    getCubePosition(): THREE.Vector3 {
        let positionInWorld = new THREE.Vector3();
        this.nCubeGroup.getWorldPosition(positionInWorld);
        return positionInWorld;
    }


    onClick($event: any): void {

    }
}