import { PolyCube } from './polycube.interface';
import { DataManager } from './datamanager';
import * as THREE from 'three-full';
import { VIEW_STATES } from './viewStates';
import { CUBE_CONFIG } from '../cube.config';
import * as D3 from 'd3';
import * as moment from 'moment';

export class GeoCube implements PolyCube {
    cubeGroupGL: THREE.Group;
    cubeGroupCSS: THREE.Group;

    private dm: DataManager;
    private webGLScene: THREE.Scene;
    private cssScene: THREE.Scene;
    private setMap: Set<string>;
    
    private colors: D3.ScaleOrdinal<string, string>;
    private timeLinearScale: D3.ScaleLinear<number, number>;

    constructor(dm: DataManager, webGLScene: THREE.Scene, cssScene?: THREE.Scene) {
        this.dm = dm;
        this.webGLScene = webGLScene;
        if (cssScene) { this.cssScene = cssScene; }
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

        /**
        * Array cube rotation and position css3d matrix
            * @type {*[]}
        */
        let r:number = Math.PI / 2;
        let d = 250;
        let pos = [[d, 0, 0], [-d, 0, 0], [0, d, 0], [0, -d, 0], [0, 0, d], [0, 0, -d]];
        let rot = [[0, r, 0], [0, -r, 0], [-r, 0, 0], [r, 0, 0], [0, 0, 0], [0, 0, 0]];

        

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


        // this.dm.data.forEach((d:any)=> {
        //     let div = new THREE.CSS3DObject(element);
        //     // div.position.x = 8;
        //     // div.position.y = 9;
        //     // div.position.z = 185;

        //     // div.position.y = this.timeLinearScale(d.date_time);
        //     // div.position.x = Math.random()*CUBE_CONFIG.WIDTH;
        //     // div.position.z = Math.random()*CUBE_CONFIG.WIDTH;
        //     // this.cubeGroupCSS.add(div)
        // })

        //flat layer
        //HTML
        let element = document.createElement('div');
        element.innerHTML = 'Map Holder';
        element.style.background = "#0094ff";
        element.style.width = CUBE_CONFIG.WIDTH + "px";
        element.style.height = CUBE_CONFIG.WIDTH  + "px";
        element.className = 'csspc' ;
        element.style.color = "white";
        // element.style.padding = "2em";

        // CSS Object
        let div = new THREE.CSS3DObject(element);
        div.position.x = CUBE_CONFIG.WIDTH/2;
        div.position.y = -CUBE_CONFIG.WIDTH/2;
        div.position.z = CUBE_CONFIG.WIDTH/2;
        // div.position.fromArray(pos[2]);
        div.rotation.fromArray(rot[2]);
        this.cubeGroupCSS.add(div)

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
