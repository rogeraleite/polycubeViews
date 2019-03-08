import { PolyCube } from './polycube.interface';
import { DataManager } from './datamanager';
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from '../../../node_modules/three-renderer-css3d';
import { VIEW_STATES } from './viewStates';

export class GeoCube implements PolyCube {
    private dm: DataManager;
    private webGLScene: THREE.Scene;
    private cssScene: THREE.Scene;
    private color: string;
    private gCubeGroup: THREE.Group;
    private gCubeGroupCSS: THREE.Group;


    init(dm: DataManager, webGLScene: THREE.Scene, cssScene?: THREE.Scene): void {
        this.dm = dm;
        this.webGLScene = webGLScene;
        if (cssScene) { this.cssScene = cssScene; }
        this.gCubeGroup = new THREE.Group();
        this.gCubeGroupCSS = new THREE.Group();
        this.assembleData();
        this.render();
    }

    assembleData(): void {
        this.color = this.dm.data[2];
        console.log(this.color);
    }

    render(): void {
        console.log('rendering geocube');
        const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(this.color),
            wireframe: true
        });

        // group holding all webGl objects
        this.gCubeGroup.name = 'GEO_CUBE';
        this.gCubeGroup.position.set(0, 0, 0);
        this.webGLScene.add(this.gCubeGroup); // add group to scene webgl scene
        // group holding all css objects
        this.gCubeGroupCSS.name = 'GEO_CUBE_CSS';
        this.gCubeGroupCSS.position.set(0, 0, 0);
        this.cssScene.add(this.gCubeGroupCSS); // add group to css scene
        // create a box and add it to the scene
// <<<<<<< HEAD
        const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
        this.gCubeGroup.add(box);
        // const sphere = new THREE.SphereGeometry();
        // const object = new THREE.Mesh( sphere, new THREE.MeshBasicMaterial( 0xff0000 ) );
        // const box = new THREE.BoxHelper( object, 0xffff00 );
        // // box.setFromObject(this.gCubeGroup)
        // this.gCubeGroup.add(box);

        console.log(this.dm);
        const box_mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
        this.gCubeGroup.add(box_mesh);

        const sphere = new THREE.SphereGeometry();
        const object = new THREE.Mesh( sphere, material );
        const box_helper = new THREE.BoxHelper( object, new THREE.Color(0xffff00) );
        this.gCubeGroup.add(box_helper);

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
        if (currentViewState.valueOf() === VIEW_STATES.GEO_CUBE || currentViewState.valueOf() === VIEW_STATES.POLY_CUBE) {
            this.webGLScene.add(this.gCubeGroup);
        }
    }

    getCubePosition(): THREE.Vector3 {
        const positionInWorld = new THREE.Vector3();
        this.gCubeGroup.getWorldPosition(positionInWorld);
        return positionInWorld;
    }

    onClick($event: any): void {
        console.log($event);
        console.log('geocube onclick');
    }
}
