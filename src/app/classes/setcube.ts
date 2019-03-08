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
        this.cubeGroupGL.add(boxHelper);
        this.cubeGroupGL.position.set(CUBE_CONFIG.WIDTH + CUBE_CONFIG.GUTTER, 0, 0);
        this.webGLScene.add(this.cubeGroupGL);

        // const sphere = new THREE.SphereGeometry();
        // const object = new THREE.Mesh( sphere, new THREE.MeshBasicMaterial( 0xff0000 ) );
        // const box = new THREE.BoxHelper( object, 0xffff00 );
        // this.sCubeGroup.add(box);
        // // this.webGLScene.add( box );

      // // HTML
      //   const element = document.createElement('button');
      //   element.innerHTML = 'Plain text inside a div.';
      //   element.id = 'button';
      //   element.style.background = '#0094ff';
      //   element.style.fontSize = '2em';
      //   element.style.color = 'white';
      //   element.style.padding = '2em';
      //
      // // CSS Object
      //   const div = new CSS3DObject(element);
      //   div.position.x = 8;
      //   div.position.y = 9;
      //   div.position.z = 15;
      //   this.cssScene.add(div);
    }


    update(currentViewState: VIEW_STATES): void {
        if (currentViewState.valueOf() === VIEW_STATES.SET_CUBE || currentViewState.valueOf() === VIEW_STATES.POLY_CUBE) {
            this.webGLScene.add(this.cubeGroupGL);
        }
    }

    getCubePosition(): THREE.Vector3 {
        const positionInWorld = new THREE.Vector3();
        this.cubeGroupGL.getWorldPosition(positionInWorld);
        return positionInWorld;
    }

    onClick($event: any): void {

    }
}
