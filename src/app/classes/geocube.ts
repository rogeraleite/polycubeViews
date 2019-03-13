import { PolyCube } from './polycube.interface';
import { DataManager } from './datamanager';
import * as THREE from 'three-full';
import { VIEW_STATES } from './viewStates';
import { CUBE_CONFIG } from '../cube.config';
import * as D3 from 'd3';
import * as moment from 'moment';
import * as mapboxgl from 'mapbox-gl';
import { environment } from '../../environments/environment';
import { select } from 'd3';
import { Vector2 } from 'three';
import { ElementRef } from '@angular/core';

export class GeoCube implements PolyCube {
    cubeGroupGL: THREE.Group;
    cubeGroupCSS: THREE.Group;

    private dm: DataManager;
    private camera: THREE.Camera;
    private webGLScene: THREE.Scene;
    private cssScene: THREE.Scene;
    private setMap: Set<string>;

    // THREEJS Objects
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;
    private objects: Array<any>;

    private colors: D3.ScaleOrdinal<string, string>;
    private timeLinearScale: D3.ScaleLinear<number, number>;

    private map: mapboxgl.Map;

    constructor(dm: DataManager, camera: THREE.Camera, webGLScene: THREE.Scene, cssScene?: THREE.Scene) {
        this.dm = dm;
        this.webGLScene = webGLScene;
        if (cssScene) { this.cssScene = cssScene; }
        this.setMap = new Set<string>();
        this.camera = camera;
        // https://stackoverflow.com/questions/44332290/mapbox-gl-typing-wont-allow-accesstoken-assignment
        (mapboxgl as typeof mapboxgl).accessToken = environment.MAPBOX_KEY;
        this.createObjects();
        this.assembleData();
        this.render();
    }

    createObjects(): void {
        this.cubeGroupGL = new THREE.Group();
        this.cubeGroupCSS = new THREE.Group();
        this.colors = D3.scaleOrdinal(D3.schemePaired);

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
    
        let placeholderBox = new THREE.Mesh( 
                                new THREE.BoxGeometry( CUBE_CONFIG.WIDTH, CUBE_CONFIG.WIDTH, CUBE_CONFIG.WIDTH ), 
                                new THREE.MeshBasicMaterial( {color: 0x00ff00} ) 
                            );
        placeholderBox.position.set(CUBE_CONFIG.WIDTH/2,0,CUBE_CONFIG.WIDTH/2);
        let boxHelper = new THREE.BoxHelper(placeholderBox, 0x000000);
        boxHelper.name = 'BOX_HELPER';
        this.cubeGroupGL.add(boxHelper);
        // this.cubeGroupGL.add( placeholderBox );
    }

    assembleData(): void {
        this.dm.data.forEach((d: any) => { this.setMap.add(d.category_1); });
        this.createMap();
        // this.timeLinearScale(some_date) gives us the vertical axis coordinate of the point
        this.timeLinearScale = this.dm.getTimeLinearScale();
        let bounds = new mapboxgl.LngLatBounds();

        this.dm.data.forEach((d: any) => { bounds.extend(new mapboxgl.LngLat(d.longitude, d.latitude)); });

        this.map.fitBounds(bounds);

        this.map.on('moveend', () => {
            let geometry = new THREE.SphereGeometry(2, 32, 32);

            for (let i = 0; i < this.dm.data.length; i++) {
                let dataItem = this.dm.data[i];
                let material = new THREE.MeshBasicMaterial({ color: this.colors(dataItem.category_1) });

                let cubeCoords = this.map.project(new mapboxgl.LngLat(dataItem.longitude, dataItem.latitude));
                let sphere = new THREE.Mesh(geometry, material);
                sphere.position.y = this.timeLinearScale(dataItem.date_time);
                sphere.position.x = cubeCoords.x;
                sphere.position.z = cubeCoords.y;
                sphere.data = dataItem;
                sphere.type = 'DATA_POINT';
                this.cubeGroupGL.add(sphere);

            }

            // create a box and add it to the scene
         
        });
    }

    private convertLatLng(lat: number, lng: number, width: number, height: number): { x: number, y: number } {
        return {
            x: lat - width / 2,
            y: height / 2 - lng
        };
    }

    private createMap(): void {
        let angle = Math.PI / 2;
        let distance = CUBE_CONFIG.WIDTH / 2;
        let pos = [[distance, 0, 0], [-distance, 0, 0], [0, distance, 0], [0, -distance, 0], [0, 0, distance], [0, 0, -distance]];
        let rot = [[0, angle, 0], [0, -angle, 0], [-angle, 0, 0], [angle, 0, 0], [0, 0, 0], [0, 0, 0]];

        // Bottomside of cube
        let mapContainer = document.createElement('div');
        mapContainer.id = 'map-container';
        mapContainer.style.width = CUBE_CONFIG.WIDTH + "px";
        mapContainer.style.height = CUBE_CONFIG.WIDTH + "px";
        // need to add it to the DOM so mapbox can hook onto it
        document.getElementById('css-canvas').appendChild(mapContainer);

        this.map = new mapboxgl.Map({
            container: 'map-container',
            style: 'mapbox://styles/velitchko/cjefo9eu118qd2rodaoq3cpj1',
            zoom: 13,
            center: [0, 0]
        });

        // CSS Object
        let mapObject = new THREE.CSS3DObject(mapContainer);
        mapObject.name = 'MAP_CONTAINER';
        mapObject.position.x = CUBE_CONFIG.WIDTH / 2;
        mapObject.position.y = -CUBE_CONFIG.WIDTH / 2;
        mapObject.position.z = CUBE_CONFIG.WIDTH / 2;
        // mapObject.position.fromArray(pos[2]);
        mapObject.rotation.fromArray(rot[2]);

        this.cubeGroupCSS.add(mapObject);
    }

    render(): void {
        // group holding all webGl objects
        this.cubeGroupGL.name = 'GEO_CUBE';
        this.cubeGroupGL.position.set(0, 0, 0);
        this.webGLScene.add(this.cubeGroupGL); // add group to scene webgl scene
        // group holding all css objects
        this.cubeGroupCSS.name = 'GEO_CUBE_CSS';
        this.cubeGroupCSS.position.set(0, 0, 0);
        this.cssScene.add(this.cubeGroupCSS); // add group to css scene
        
    }

    update(currentViewState: VIEW_STATES): void {
        if (currentViewState.valueOf() === VIEW_STATES.GEO_CUBE || currentViewState.valueOf() === VIEW_STATES.POLY_CUBE) {
            this.webGLScene.add(this.cubeGroupGL);
            this.cssScene.add(this.cubeGroupCSS);
            this.showBottomLayer();
        }
    }

    updateData(): void {

    }

    transitionSTC(): void { }
    transitionJP(): void { }
    transitionSI(): void { }
    transitionANI(): void { }

    getCubePosition(): THREE.Vector3 {
        const positionInWorld = new THREE.Vector3();
        this.cubeGroupGL.getWorldPosition(positionInWorld);
        return positionInWorld;
    }

    onClick($event: any, tooltip: ElementRef): void {
        $event.preventDefault();

        this.mouse.x = ($event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -($event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        // let vec = new THREE.Vector3(this.mouse.x, this.mouse.y, 1);
        // vec.unproject(this.camera);
        let intersections = this.raycaster.intersectObjects(this.cubeGroupGL.children);
        
        let guideLine = this.cubeGroupGL.getObjectByName('GUIDE_LINE');
        if(guideLine) {
            this.cubeGroupGL.remove(guideLine);
        }

        if (intersections.length > 0) {
            let selectedObject = intersections[0].object;
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
        } else {
            tooltip.nativeElement.style.opacity = '0';
            tooltip.nativeElement.style.top = '0px';
            tooltip.nativeElement.style.left = '0px';
            tooltip.nativeElement.innerHTML = '';
        }
    }

    onDblClick($event: any): void {

    }

    showBottomLayer(): void {
        document.getElementById('map-container').style.opacity = '1';
    }

    hideBottomLayer(): void {
        document.getElementById('map-container').style.opacity = '0';
    }
}
