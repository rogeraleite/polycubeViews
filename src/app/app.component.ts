import { Component } from '@angular/core';
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from '../../node_modules/three-renderer-css3d';
import { OrbitControls } from '../../node_modules/three-orbitcontrols-ts/dist/index';
// FIXME: d3 integration
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

@Component({
   selector: 'app-root',
   templateUrl: './app.component.html',
   styleUrls: ['./app.component.css', './bootstrap.min.css']
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
   webGLScene: THREE.Scene;
   cssScene: THREE.Scene;
   //camera: Camera;
   camera: THREE.PerspectiveCamera;
   light: THREE.Light;
   controls: OrbitControls;
   webGLRenderer: THREE.WebGLRenderer;
   css3DRenderer: any;

   // Cubes
   gCube: PolyCube; sCube: PolyCube; nCube: PolyCube;

   // set default view to display all cubes
   currentViewState: VIEW_STATES = VIEW_STATES.POLY_CUBE;

   ngAfterViewInit() {
      this.initScene();
      this.initCubes();
      this.initGUI();
   }

   initScene = () => {
      this.webGLScene = new THREE.Scene();
      this.cssScene = new THREE.Scene();
      //this.camera = new Camera();
      let webGLCanvas: HTMLElement = document.getElementById('webgl-canvas');
      let cssCanvas: HTMLElement = document.getElementById('css-canvas');
      this.webGLRenderer = new THREE.WebGLRenderer({ canvas: webGLCanvas as HTMLCanvasElement, alpha: true });
      // set size
      this.webGLRenderer.setSize(window.innerWidth, window.innerHeight);
      this.webGLRenderer.setClearColor('#FFC0CB', 0.6);

      this.css3DRenderer = new CSS3DRenderer();
      this.css3DRenderer.setSize(window.innerWidth, window.innerHeight);
      this.css3DRenderer.setClearColor(0x00ff00, 1);

      cssCanvas.appendChild(this.css3DRenderer.domElement);

      this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
      this.camera.position.set(0, 0, -10);

      this.controls = new OrbitControls(this.camera);

      this.controls.enableZoom = true;
      this.controls.enablePan = true;
      this.controls.update();

      let axis = new THREE.AxesHelper(10);
      this.webGLScene.add(axis);

      this.light = new THREE.DirectionalLight(0xffffff, 1.0);
      this.light.position.set(100, 100, 100);
      this.webGLScene.add(this.light);

      this.camera.position.x = 5;
      this.camera.position.y = 5;
      this.camera.position.z = 5;

      this.camera.lookAt(this.webGLScene.position);
      //HTML
      let element = document.createElement('button');
      element.innerHTML = 'Plain text inside a div.';
      element.id = 'button';
      element.style.background = "#0094ff";
      element.style.fontSize = "2em";
      element.style.color = "white";
      element.style.padding = "2em";

      //CSS Object
      let div = new CSS3DObject(element);
      div.position.x = 8;
      div.position.y = 9;
      div.position.z = 185;
      this.cssScene.add(div);

      this.animate();
   }

   /**
    *
    */
   initCubes = () => {
      let dm = new DataManager(null);

      this.gCube = new GeoCube();
      this.gCube.init(dm, this.webGLScene, this.cssScene);
      this.sCube = new SetCube();
      this.sCube.init(dm, this.webGLScene, this.cssScene);
      this.nCube = new NetCube();
      this.nCube.init(dm, this.webGLScene, this.cssScene);
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
      this.webGLScene.remove(this.webGLScene.getObjectByName('GEO_CUBE'));
      this.webGLScene.remove(this.webGLScene.getObjectByName('SET_CUBE'));
      this.webGLScene.remove(this.webGLScene.getObjectByName('NET_CUBE'));
   }

   positionCamera = (): void => {
      let targetVector = new THREE.Vector3();
      let camLookAt = new THREE.Vector3(0, 0, -1);
      let cubePos: THREE.Vector3;

      let tweenPos = new TWEEN.Tween(this.camera.position);
      let tweenLookAt = new TWEEN.Tween(camLookAt.applyQuaternion(this.camera.quaternion));

      switch (this.currentViewState) {
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
      // FIXME: lookAt still buggy -> find how to fix or consider first person action cam
      tweenPos.start().onComplete(() => {
         tweenLookAt.start().onUpdate((target: THREE.Vector3) => {
            this.camera.lookAt(target);
         })
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
      this.webGLRenderer.render(this.webGLScene, this.camera);
      this.css3DRenderer.render(this.cssScene, this.camera);
   }

   setCubeView(view: string) {
      switch (view) {
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
