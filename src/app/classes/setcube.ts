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
    private camera: THREE.Camera;
    private data: Array<any>;
    private setMap: Set<string>;

    private webGLScene: THREE.Scene;
    private cssScene: THREE.Scene;
    private colors: D3.ScaleOrdinal<string, string>;
    private timeLinearScale: D3.ScaleLinear<number, number>;



    constructor(dm: DataManager, camera: THREE.Camera, webGLScene: THREE.Scene, cssScene: THREE.Scene) {
        this.dm = dm;
        this.webGLScene = webGLScene;
        if (cssScene) { this.cssScene = cssScene; }
        this.data = new Array<any>();
        this.setMap = new Set<string>();
        this.camera = camera;   
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
        this.dm.data.forEach((d: any) => { 
            this.setMap.add(d.category_1); 
            //store quantized time 
            d.groupDate = moment((this.dm.getTimeQuantile(d.date_time)), 'YYYY').toDate()
        });
        // this.timeLinearScale(some_date) gives us the vertical axis coordinate of the point
        //this is currently not alligned with the geo time layers position
        this.timeLinearScale = this.dm.getTimeLinearScale();

        //group by time and then category
        // run layout simulations and store group positions for other time layers 
        let groupedData = D3.nest()
            .key((d: any) => {return d.groupDate })
            .key((d:any) => {return d.category_1})
            .entries(this.dm.data)
            .sort((a:any,b:any) => {return a.key == b.key ? 0 : +(a.key > b.key) || -1;})
            
        console.log(groupedData)

        //add gemorty points
        let geometry = new THREE.SphereGeometry( 1, 32, 32 );
        for(let i = 0; i < this.dm.data.length; i++) {
            let dataItem = this.dm.data[i];
            // TODO: consider just updating color property of material if you ever find out how to do it
            let material = new THREE.MeshBasicMaterial({ color: this.colors(dataItem.category_1) });

            let sphere = new THREE.Mesh( geometry, material );
            //deprecated
            sphere.position.y = this.timeLinearScale(dataItem.groupDate);

            // console.log(dataItem)

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

    hideBottomLayer(): void {}
    showBottomLayer(): void {}
}
