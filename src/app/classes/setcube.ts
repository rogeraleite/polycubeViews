import { PolyCube } from './polycube.interface';
import { DataManager } from './datamanager';
import * as THREE from 'three-full';
import { VIEW_STATES } from './viewStates';
import { CUBE_CONFIG } from '../cube.config';
import * as D3 from 'd3';
import * as moment from 'moment';

export class SetCube implements PolyCube {
    cubeGroupGL: THREE.Group;
    cubeGroupCSS: THREE.Group;
    
    // Data
    private dm: DataManager;
    private data: Array<any>;
    private setMap: Set<string>;

    private webGLScene: THREE.Scene;
    private cssScene: THREE.Scene;
    private colors: D3.ScaleOrdinal<string, string>;
    private timeLinearScale: D3.ScaleLinear<number, number>;



    constructor(dm: DataManager, webGLScene: THREE.Scene, cssScene: THREE.Scene) {
        this.dm = dm;
        this.webGLScene = webGLScene;
        if (cssScene) { this.cssScene = cssScene; }
        this.data = new Array<any>();
        this.setMap = new Set<string>();

        this.createObjects();
        this.assembleData();
        this.render();
    }

    createObjects(): void {
        this.cubeGroupGL = new THREE.Group();
        this.cubeGroupCSS = new THREE.Group();

        this.colors = D3.scaleOrdinal(D3.schemePaired);
    }

    assembleData(): void {
        this.dm.data.forEach((d: any) => { this.setMap.add(d.category_1); });
        // this.timeLinearScale(some_date) gives us the vertical axis coordinate of the point
        this.timeLinearScale = this.dm.getTimeLinearScale();
        let geometry = new THREE.SphereGeometry( 1, 32, 32 );
        
        for(let i = 0; i < this.dm.data.length; i++) {
            let dataItem = this.dm.data[i];
            // TODO: consider just updating color property of material if you ever find out how to do it
            let material = new THREE.MeshBasicMaterial({ color: this.colors(dataItem.category_1) });
            
            let sphere = new THREE.Mesh( geometry, material );
            sphere.position.y = this.timeLinearScale(dataItem.date_time);
            sphere.position.x = Math.random()*CUBE_CONFIG.WIDTH;
            sphere.position.z = Math.random()*CUBE_CONFIG.WIDTH;

            this.cubeGroupGL.add(sphere);
        }
    }

    render(): void {
        // create a box and add it to the scene
        let boxHelper = new THREE.BoxHelper(this.cubeGroupGL, 0x000000);
        this.cubeGroupGL.name = 'SET_CUBE';
        this.cubeGroupGL.add(boxHelper);
        this.cubeGroupGL.position.set(CUBE_CONFIG.WIDTH + CUBE_CONFIG.GUTTER, 0, 0);
        this.webGLScene.add(this.cubeGroupGL);
    }


    update(currentViewState: VIEW_STATES): void {
        if (currentViewState.valueOf() === VIEW_STATES.SET_CUBE || currentViewState.valueOf() === VIEW_STATES.POLY_CUBE) {
            this.webGLScene.add(this.cubeGroupGL);
        }
    }

    updateData(): void {
        
    }

    
    transitionSTC(): void {}
    transitionJP(): void {}
    transitionSI(): void {}
    transitionANI(): void {}


    getCubePosition(): THREE.Vector3 {
        const positionInWorld = new THREE.Vector3();
        this.cubeGroupGL.getWorldPosition(positionInWorld);
        return positionInWorld;
    }

    onClick($event: any): void {

    }

    onDblClick($event: any): void {

    }
}
