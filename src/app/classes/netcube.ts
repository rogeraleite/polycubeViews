import { PolyCube } from './polycube.interface';
import { DataManager } from './datamanager';
import * as THREE from 'three-full';
import { VIEW_STATES } from './viewStates';
import { CUBE_CONFIG } from '../cube.config';

import * as D3 from 'd3';
import * as moment from 'moment';

export class NetCube implements PolyCube {
    cubeGroupGL: THREE.Group;
    cubeGroupCSS: THREE.Group;

    private dm: DataManager;
    private webGLScene: THREE.Scene;
    private cssScene: THREE.Scene;
    private setMap: Set<string>;
    // THREEJS Objects
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;
    private objects: Array<any>;    

    private colors: D3.ScaleOrdinal<string, string>;
    private timeLinearScale: D3.ScaleLinear<number, number>;

    constructor(dm: DataManager, webGLScene: THREE.Scene, cssScene?: THREE.Scene) {
        this.dm = dm;
        this.webGLScene = webGLScene;
        if(cssScene) this.cssScene = cssScene;
        this.setMap = new Set<string>();

        this.createObjects();
        this.assembleData();
        this.render();    
        
        this.parsingCushmanPositionData();
    }

    createObjects(): void {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.cubeGroupGL = new THREE.Group();

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
            // sphere.position.x = Math.random()*CUBE_CONFIG.WIDTH;
            // sphere.position.z = Math.random()*CUBE_CONFIG.WIDTH;

            let position = this.getNormalizedPositionById(dataItem.id);
            sphere.position.x = position.x;
            sphere.position.z = position.y;

            this.cubeGroupGL.add(sphere);
        }

        console.log("netCube");
        console.log(this.cubeGroupGL);
    }
    
    render(): void {
        let boxHelper = new THREE.BoxHelper(this.cubeGroupGL, 0x000000);
        this.cubeGroupGL.name = 'NET_CUBE';
        this.cubeGroupGL.add(boxHelper);
        this.cubeGroupGL.position.set((CUBE_CONFIG.WIDTH + CUBE_CONFIG.GUTTER)*2, 0, 0);
        this.webGLScene.add(this.cubeGroupGL);
    }

    update(currentViewState: VIEW_STATES): void {
        if(currentViewState.valueOf() === VIEW_STATES.NET_CUBE || currentViewState.valueOf() === VIEW_STATES.POLY_CUBE) {
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
        let positionInWorld = new THREE.Vector3();
        this.cubeGroupGL.getWorldPosition(positionInWorld);
        return positionInWorld;
    }


    onClick($event: any): void {
        $event.preventDefault();

        this.mouse.x = ($event.clientX - window.innerWidth)*2 - 1;
        this.mouse.y = ($event.clientY - window.innerHeight)*-2 + 1

        let intersections = this.raycaster.intersectObjects(this.webGLScene.children);

        for(let i = 0; i < intersections.length; i++) {

        }
    }

    onDblClick($event: any): void {

    }

    getNormalizedPositionById(id){
        let pos_map = this.dm.getForcedDirectedCushmanPositionMap();
        let pos_dim = this.dm.getDataPositionDimensions()

        let normalized_x = pos_map[id].x * CUBE_CONFIG.WIDTH / Math.abs(pos_dim.max_x - pos_dim.min_x);
        let normalized_y = pos_map[id].y * CUBE_CONFIG.WIDTH / Math.abs(pos_dim.max_y - pos_dim.min_y);

        normalized_x = normalized_x + CUBE_CONFIG.WIDTH / 2;
        normalized_y = normalized_y + CUBE_CONFIG.WIDTH / 2;

        return {x: normalized_x, y: normalized_y};
    }


    //saving useful scripts for future usage
    parsingCushmanPositionData(){
        // let new_temp_data = [];
        // for(let i = 0; i < this.dm.data.length; i++) {
        //     let d = this.dm.data[i];
        //     let obj = {id: d.id, target: d.target_nodes.slice(0, 5)}
        //     new_temp_data.push(obj);
        // }
        // console.log(new_temp_data);

        // let nodes = [];
        // let links = [];
        // for(let i = 0; i < this.dm.data.length; i++) {
        //     let d = this.dm.data[i];
        //     let node = {id: ""+d.id, group: 1}
        //     nodes.push(node);

        //     for(let a = 0; a < 3; a++) {
        //         links.push({source: ""+d.id, target: ""+d.target_nodes[a], value:1})                
        //     }

        // }//end for
        
      
        // let new_cushman_position = [];
        // //console.log(cushman_positions);
        // cushman_positions.forEach((d:any)=>{
        //     new_cushman_position.push({id:d.textContent, x: d.__data__.x, y: d.__data__.y});
        // });
        // console.log(new_cushman_position);

        // let nodes4 = [];
        // $$( "circle" ).forEach(e=>{
        //         nodes4.push({id:e.textContent, x:e.__data__.x, y:e.__data__.y})
        //     }
        // )
        // console.log(nodes4);
    }
}