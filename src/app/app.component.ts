import { Component } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from '../../node_modules/three-orbitcontrols-ts/dist/index';
import * as D3 from 'd3';
import { PolyCube } from './classes/polycube.interface';
import { GeoCube } from './classes/geocube';
import { SetCube } from './classes/setcube';
import { NetCube } from './classes/netcube';
import { Camera } from './classes/camera';
import { DataManager } from './classes/datamanager';
import { VIEW_STATES } from './classes/viewStates';
import { GUI } from './classes/gui';
import * as TWEEN from '@tweenjs/tween.js';
import { Vector2 } from 'three';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css','./bootstrap.min.css']
})

export class AppComponent {
  title = 'polycubeViews';

  /**
 * PolyCube main controller
 * - loads and parses data
 * - initializes threejs scene
 * - initializes cube components
 */

  /**
   * init function 
   */
  gui: GUI;
  scene: THREE.Scene;
  //camera: Camera;
  camera: THREE.PerspectiveCamera;
  light: THREE.Light;
  controls: OrbitControls;  
  webGLRenderer: THREE.WebGLRenderer;
  //let css3DRenderer: THREE.CSS3DRenderer;

  // Cubes
  gCube: PolyCube; sCube: PolyCube; nCube: PolyCube;

  // set default view to display all cubes
  currentViewState: VIEW_STATES = VIEW_STATES.POLY_CUBE;

  ngAfterViewInit(){
    this.initScene();
    this.initCubes();
    this.initGUI();
  }

initScene = () => {
    this.scene = new THREE.Scene();
    //this.camera = new Camera();
    
    let canvas: HTMLElement  = document.getElementById('polycube-canvas');
    this.webGLRenderer = new THREE.WebGLRenderer({ canvas:  canvas as HTMLCanvasElement, alpha: true });
    // set size
    this.webGLRenderer.setSize(window.innerWidth, window.innerHeight);
    this.webGLRenderer.setClearColor(0xffffff, 0);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
    this.controls = new OrbitControls(this.camera, this.webGLRenderer.domElement);

    this.controls.enableZoom = true;
    this.controls.enablePan = true;
    
    let axis = new THREE.AxesHelper(10);
    this.scene.add(axis);

    this.light = new THREE.DirectionalLight(0xffffff, 1.0);
    this.light.position.set(100, 100, 100);
    this.scene.add(this.light);
    
    // this.camera.perspectiveCamera.position.x = 5;
    // this.camera.perspectiveCamera.position.y = 5;
    // this.camera.perspectiveCamera.position.z = 5;
    
    // this.camera.perspectiveCamera.lookAt(this.scene.position);

    this.camera.position.x = 5;
    this.camera.position.y = 5;
    this.camera.position.z = 5;
    
    this.camera.lookAt(this.scene.position);

    

    this.animate();
}

/**
 * 
 */
initCubes = () => {
    console.log('initializing PolyCube');
    let dm = new DataManager(null);

    this.gCube = new GeoCube();
    this.gCube.init(dm, this.scene);
    this.sCube = new SetCube();
    this.sCube.init(dm, this.scene);
    this.nCube = new NetCube();
    this.nCube.init(dm, this.scene);
};

initGUI = () => {
   // TODO: could possibly add events on click listeners
   this.gui = new GUI();
   this.gui.geoBtn.addEventListener('click', () => { 
      this.setCubeView(VIEW_STATES.GEO_CUBE);
   });

   this.gui.setBtn.addEventListener('click', () => { 
      this.setCubeView(VIEW_STATES.SET_CUBE);
   });

   this.gui.netBtn.addEventListener('click', () => { 
      this.setCubeView(VIEW_STATES.NET_CUBE);
   });

   this.gui.polyBtn.addEventListener('click', () => { 
      this.setCubeView(VIEW_STATES.POLY_CUBE);
   });
}

removeAllCubeViews = (): void => {
   this.scene.remove(this.scene.getObjectByName('GEO_CUBE'));
   this.scene.remove(this.scene.getObjectByName('SET_CUBE'));
   this.scene.remove(this.scene.getObjectByName('NET_CUBE'));
}

positionCamera = (): void => {
   let targetVector = new THREE.Vector3();
   let camLookAt = new THREE.Vector3(0, 0, -1);
   let cubePos: THREE.Vector3;

   let tweenPos = new TWEEN.Tween(this.camera.position);
   let tweenLookAt = new TWEEN.Tween(camLookAt.applyQuaternion(this.camera.quaternion));

   switch(this.currentViewState) {
      case 'GEO_CUBE': 
         cubePos = this.gCube.getCubePosition();
         break;
      case 'SET_CUBE': 
         cubePos = this.sCube.getCubePosition();
         break;
      case 'NET_CUBE': 
         cubePos = this.nCube.getCubePosition();
         break;
      case 'POLY_CUBE':
         cubePos = this.sCube.getCubePosition();
         break;
      default: break;
   }

   targetVector.set(cubePos.x, this.camera.position.y, this.camera.position.z);
   tweenPos.to(targetVector, 250); 
   tweenLookAt.to(cubePos, 250);   
   
   tweenPos.start();
   tweenLookAt.start().onUpdate((target: any) => {
      this.camera.lookAt(target.x, target.y, target.z);
   });
};

updateCubesView = (): void => {
   this.removeAllCubeViews();
   this.gCube.update(this.currentViewState);
   this.sCube.update(this.currentViewState);
   this.nCube.update(this.currentViewState);
   this.positionCamera();

};



parseData = (data: any) => {

};

/**
 * 
 */
animate = () => {
    requestAnimationFrame(this.animate);
    TWEEN.update();
    this.render();
}

/**
 * 
 */
render() {
   //this.webGLRenderer.render(this.scene, this.camera.perspectiveCamera);
   this.webGLRenderer.render(this.scene, this.camera);
}

setCubeView(view: string){
   switch(view) {
      case 'GEO_CUBE': this.currentViewState = VIEW_STATES.GEO_CUBE; break;
      case 'SET_CUBE': this.currentViewState = VIEW_STATES.SET_CUBE; break;
      case 'NET_CUBE': this.currentViewState = VIEW_STATES.NET_CUBE; break;
      case 'POLY_CUBE': this.currentViewState = VIEW_STATES.POLY_CUBE; break;
      default: 
         return;
   }
   
   this.updateCubesView();
}




}
