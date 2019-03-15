import { PolyCube } from './polycube.interface';
import { DataManager } from './datamanager';
import * as THREE from 'three-full';
import { VIEW_STATES } from './viewStates';
import { CUBE_CONFIG } from '../cube.config';
import { ElementRef } from '@angular/core';

import * as D3 from 'd3';
import * as moment from 'moment';

export class NetCube implements PolyCube {
    cubeGroupGL: THREE.Group;
    cubeGroupCSS: THREE.Group;

    private dm: DataManager;
    private camera: THREE.Camera;
    private webGLScene: THREE.Scene;
    private cssScene: THREE.Scene;
    private setMap: Set<string>;
    private boundingBox: THREE.BoxHelper;

    // THREEJS Objects
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;
    private objects: Array<any>;    
    private slices: Array<THREE.Group>;
    private colors: D3.ScaleOrdinal<string, string>;
    private timeLinearScale: D3.ScaleLinear<number, number>;

    private cubeLeftBoarder: number;

    constructor(dm: DataManager, camera: THREE.Camera, webGLScene: THREE.Scene, cssScene?: THREE.Scene) {
        this.dm = dm;
        this.webGLScene = webGLScene;
        if(cssScene) this.cssScene = cssScene;
        this.setMap = new Set<string>();
        this.camera = camera;
        this.cubeLeftBoarder = (CUBE_CONFIG.WIDTH + CUBE_CONFIG.GUTTER)*2;
        this.createObjects();
        this.assembleData();
        this.render();    
    }

    createObjects(): void {        
        this.cubeGroupGL = new THREE.Group();
        this.cubeGroupCSS = new THREE.Group();
        this.colors = D3.scaleOrdinal(D3.schemePaired);

        this.createSlices();

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.createBoundingBox();
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
            //sphere.position.y = this.timeLinearScale(dataItem.date_time);
            let position = this.getNormalizedPositionById(dataItem.id);
            sphere.position.x = position.x;
            sphere.position.z = position.y;

            sphere.data = dataItem;
            sphere.type = 'DATA_POINT';
            
            //console.log(this.findTimeSlice(dataItem.date_time));
            this.findTimeSlice(dataItem.date_time).add(sphere);
        }

        console.log("netCube ready");
        console.log(this.slices);

    }
    
    render(): void {
        // group holding all webGl objects
        this.cubeGroupGL.name = 'NET_CUBE';
        this.cubeGroupGL.position.set(this.cubeLeftBoarder, 0, 0);
        this.webGLScene.add(this.cubeGroupGL);
        // group holding all css objects
        this.cubeGroupCSS.name = 'NET_CUBE_CSS';
        this.cubeGroupCSS.position.set(this.cubeLeftBoarder, 0, 0);
        this.cssScene.add(this.cubeGroupCSS); // add group to css scene
    }

    update(currentViewState: VIEW_STATES): void {
        if(currentViewState.valueOf() === VIEW_STATES.NET_CUBE || currentViewState.valueOf() === VIEW_STATES.POLY_CUBE) {
            this.webGLScene.add(this.cubeGroupGL);
            this.cssScene.add(this.cubeGroupCSS);
            this.showBottomLayer();
        }
    }

    updateData(): void {
        
    }

    
    /**
     * Transitions from whatever temporal encoding to STC
     */
    transitionSTC(): void { 
        let vertOffset = CUBE_CONFIG.HEIGHT/this.dm.timeRange.length;
        this.cubeGroupGL.add(this.boundingBox);
        this.slices.forEach((slice: THREE.Group, i: number) => {
            slice.position.set(CUBE_CONFIG.WIDTH/2, (i*vertOffset) - (CUBE_CONFIG.WIDTH/2), CUBE_CONFIG.WIDTH/2);
        });
    }

    /**
     * Transitions from whatever temporal encoding to JP
     */
    transitionJP(): void {
        let vertOffset = CUBE_CONFIG.HEIGHT + 20;
        this.cubeGroupGL.remove(this.boundingBox);
        this.slices.forEach((slice: THREE.Group, i: number) => {
            slice.position.z = (i*vertOffset) - (CUBE_CONFIG.WIDTH/2);
            slice.position.y = 0;
        });

    }

    transitionSI(): void {}
    transitionANI(): void {}


    getCubePosition(): THREE.Vector3 {
        let positionInWorld = new THREE.Vector3();
        this.cubeGroupGL.getWorldPosition(positionInWorld);
        return positionInWorld;
    }


    onClick($event: any, tooltip: ElementRef, container: HTMLElement): any {
        $event.preventDefault();

        this.mouse.x= (($event.clientX - container.offsetLeft)/container.clientWidth) * 2 - 1;
        this.mouse.y= -(($event.clientY - container.offsetTop)/container.clientHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        let intersections = this.raycaster.intersectObjects(this.cubeGroupGL.children, true);
        let guideLine = this.cubeGroupGL.getObjectByName('GUIDE_LINE');

        if(guideLine) {
            this.cubeGroupGL.remove(guideLine);
        }

        for(let i = 0; i < intersections.length; i++) {
            let selectedObject = intersections[i].object;
            if(selectedObject.type !== 'DATA_POINT') continue;
            // get first intersect that is a data point
            selectedObject.material.color.setHex(0xffff00);
            selectedObject.scale.set(2, 2, 2);
            tooltip.nativeElement.style.opacity = '.9';
            tooltip.nativeElement.style.top = `${$event.pageY}px`;
            tooltip.nativeElement.style.left = `${$event.pageX}px`;
            tooltip.nativeElement.innerHTML = selectedObject.data.description;
            let lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 10 });
            let lineGeometry = new THREE.Geometry();
            
            lineGeometry.vertices.push(selectedObject.position);  // x y z 
            lineGeometry.vertices.push(new THREE.Vector3(selectedObject.position.x, -CUBE_CONFIG.WIDTH/2, selectedObject.position.z)); 

            let line = new THREE.Line(lineGeometry, lineMaterial);
            line.name = 'GUIDE_LINE';
            this.cubeGroupGL.add(line);
            return selectedObject.data;
        }

        return null;
    }

    /**
     * Returns the corresponding timeslice to a given objects date (date_time property)
     * @param date Date object
     */
    findTimeSlice(date: Date): THREE.Group {
        let correspondingSlice;
        this.slices.forEach((slice: THREE.Group) => {
            if(slice.name === this.dm.getTimeQuantile(date)) {
                correspondingSlice = slice;
                return;
            }
        });
        return correspondingSlice;
    }

    onDblClick($event: any): void {

    }

    getNormalizedPositionById(id){
        let pos_map = this.dm.getForcedDirectedCushmanPositionMap();
        let pos_dim = this.dm.getDataPositionDimensions()

        let normalized_x = pos_map[id].x * CUBE_CONFIG.WIDTH / Math.abs(pos_dim.max_x - pos_dim.min_x);
        let normalized_y = pos_map[id].y * CUBE_CONFIG.WIDTH / Math.abs(pos_dim.max_y - pos_dim.min_y);

        return {x: normalized_x, y: normalized_y};
    }

    createSlices(): void {
        this.slices = new Array<THREE.Group>();
        let vertOffset = CUBE_CONFIG.WIDTH / this.dm.timeRange.length;
        for(let i = 0; i < this.dm.timeRange.length; i++) {
            // TIME SLICES
            let slice = new THREE.Group();

            // name set to year -> we can now map objects to certain layers by checking their
            // this.dm.getTimeQuantile(date) and the slices name.
            slice.name = this.dm.timeRange[i].getFullYear();

            let geometry = new THREE.PlaneGeometry(CUBE_CONFIG.WIDTH, CUBE_CONFIG.HEIGHT, 32 );
            let edgeGeometry = new THREE.EdgesGeometry(geometry);
            let material = new THREE.LineBasicMaterial( {color: 0x000000 } );
            let plane = new THREE.LineSegments( edgeGeometry, material );
            

            slice.position.set(CUBE_CONFIG.WIDTH/2, (i*vertOffset) - (CUBE_CONFIG.WIDTH/2), CUBE_CONFIG.WIDTH/2);
            plane.position.set(0, 0, 0);
            plane.rotation.set(Math.PI/2, 0, 0);
            slice.add(plane);
            //slice.yPos = (i*vertOffset) - (CUBE_CONFIG.WIDTH/2);
            this.slices.push(slice);
            
            // CSS 3D TIME SLICE LABELS
            let element = document.createElement('div');
            element.innerHTML = slice.name;
            element.className = 'time-slice-label';
        
            //CSS Object
            let label = new THREE.CSS3DObject(element);
            label.position.set(-20, (i*vertOffset) - (CUBE_CONFIG.WIDTH/2), CUBE_CONFIG.WIDTH/2);
            // label.rotation.set(Math.PI);
            this.cssScene.add(label);
        }

        let placeholderBox = new THREE.Mesh( 
            new THREE.BoxGeometry( CUBE_CONFIG.WIDTH, CUBE_CONFIG.WIDTH, CUBE_CONFIG.WIDTH ), 
            new THREE.MeshBasicMaterial( {color: 0x00ff00} ) 
        );

        placeholderBox.position.set(CUBE_CONFIG.WIDTH/2,0,CUBE_CONFIG.WIDTH/2);
        let boxHelper = new THREE.BoxHelper(placeholderBox, 0x000000);
        boxHelper.name = 'BOX_HELPER';
        this.cubeGroupGL.add(boxHelper);
        this.slices.forEach((slice: THREE.Group) => { this.cubeGroupGL.add(slice); });
    }

    createBoundingBox(){
        let placeholderBox = new THREE.Mesh( 
            new THREE.BoxGeometry( CUBE_CONFIG.WIDTH, CUBE_CONFIG.WIDTH, CUBE_CONFIG.WIDTH ), 
            new THREE.MeshBasicMaterial( {color: 0x00ff00} ) 
        );
        placeholderBox.position.set(CUBE_CONFIG.WIDTH/2,0,CUBE_CONFIG.WIDTH/2);
        this.boundingBox = new THREE.BoxHelper(placeholderBox, '#b5b5b5');
        this.boundingBox.name = 'BOX_HELPER';
        this.cubeGroupGL.add(this.boundingBox);
        this.slices.forEach((slice: THREE.Group) => { this.cubeGroupGL.add(slice); });
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

    showBottomLayer(): void {}

    hideBottomLayer(): void {}
}