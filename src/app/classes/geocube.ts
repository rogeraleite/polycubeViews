import { PolyCube } from './polycube.interface';
import { DataManager } from './datamanager';
import * as THREE from 'three-full';
import { VIEW_STATES } from './viewStates';
import { CUBE_CONFIG } from '../cube.config';
import * as D3 from 'd3';
import * as moment from 'moment';
import * as mapboxgl from 'mapbox-gl';
import { environment }  from '../../environments/environment';

export class GeoCube implements PolyCube {
    cubeGroupGL: THREE.Group;
    cubeGroupCSS: THREE.Group;

    private dm: DataManager;
    private webGLScene: THREE.Scene;
    private cssScene: THREE.Scene;
    private setMap: Set<string>;
    
    private colors: D3.ScaleOrdinal<string, string>;
    private timeLinearScale: D3.ScaleLinear<number, number>;

    private map: mapboxgl.Map;

    constructor(dm: DataManager, webGLScene: THREE.Scene, cssScene?: THREE.Scene) {
        this.dm = dm;
        this.webGLScene = webGLScene;
        if (cssScene) { this.cssScene = cssScene; }
        this.setMap = new Set<string>();
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
    }

    assembleData(): void {
        this.dm.data.forEach((d: any) => { this.setMap.add(d.category_1); });
        this.createMap();
        // this.timeLinearScale(some_date) gives us the vertical axis coordinate of the point
        this.timeLinearScale = this.dm.getTimeLinearScale();
        let geometry = new THREE.SphereGeometry( 1, 32, 32 );
        let bounds = new mapboxgl.LngLatBounds();

        for(let i = 0; i < this.dm.data.length; i++) {
            let dataItem = this.dm.data[i];
            // TODO: consider just updating color property of material if you ever find out how to do it
            let material = new THREE.MeshBasicMaterial({ color: this.colors(dataItem.category_1) });
            
            let sphere = new THREE.Mesh( geometry, material );
            sphere.position.y = this.timeLinearScale(dataItem.date_time);
            sphere.position.x = Math.random()*CUBE_CONFIG.WIDTH;
            sphere.position.z = Math.random()*CUBE_CONFIG.WIDTH;
            // console.log(dataItem.longitude, dataItem.latitude);
            // let cubeCoords = this.map.project(new mapboxgl.LngLat(dataItem.longitude%90, dataItem.latitude%90));
            // console.log(cubeCoords);
            bounds.extend(new mapboxgl.LngLat(dataItem.longitude, dataItem.latitude));

            this.cubeGroupGL.add(sphere);
        }

        this.map.fitBounds(bounds);
      
    }

    private createMap(): void {
        let angle = Math.PI / 2;
        let distance = CUBE_CONFIG.WIDTH/2;
        let pos = [[distance, 0, 0], [-distance, 0, 0], [0, distance, 0], [0, -distance, 0], [0, 0, distance], [0, 0, -distance]];
        let rot = [[0, angle, 0], [0, -angle, 0], [-angle, 0, 0], [angle, 0, 0], [0, 0, 0], [0, 0, 0]];
       
        // Bottomside of cube
        let mapContainer = document.createElement('div');
        mapContainer.id = 'map-container';
        mapContainer.style.width = CUBE_CONFIG.WIDTH + "px";
        mapContainer.style.height = CUBE_CONFIG.WIDTH  + "px";
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
        mapObject.position.x = CUBE_CONFIG.WIDTH/2;
        mapObject.position.y = -CUBE_CONFIG.WIDTH/2;
        mapObject.position.z = CUBE_CONFIG.WIDTH/2;
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
        // create a box and add it to the scene
        let boxHelper = new THREE.BoxHelper(this.cubeGroupGL, 0x000000);
        this.cubeGroupGL.add(boxHelper);
    }

    update(currentViewState: VIEW_STATES): void {
        if (currentViewState.valueOf() === VIEW_STATES.GEO_CUBE || currentViewState.valueOf() === VIEW_STATES.POLY_CUBE) {
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
        console.log($event);
        console.log('geocube onclick');
    }

    onDblClick($event: any): void {

    }
}
