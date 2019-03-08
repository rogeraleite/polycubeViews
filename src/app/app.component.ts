import { Component, ViewChild, ElementRef } from '@angular/core';
import * as THREE from 'three-full';
import * as TWEEN from '@tweenjs/tween.js';
import * as D3 from 'd3';
import { PolyCube } from './classes/polycube.interface';
import { GeoCube } from './classes/geocube';
import { SetCube } from './classes/setcube';
import { NetCube } from './classes/netcube';
import { Camera } from './classes/camera';
import { GoogleDriveProvider } from './services/google.drive.service';
import { VIEW_STATES } from './classes/viewStates';
import { GUI } from './classes/gui';
import { DataManager } from './classes/datamanager';
import { CUBE_CONFIG } from './cube.config';
@Component({
   selector: 'app-root',
   templateUrl: './app.component.html',
   styleUrls: ['./app.component.css', './bootstrap.min.css']
})

export class AppComponent {
   @ViewChild('spreadsheetInput') spreadsheetId: ElementRef;
   @ViewChild('webGLCanvas') webGLContainer: ElementRef;
   @ViewChild('cssCanvas') cssContainer: ElementRef;
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
   controls: THREE.OrbitControls;
   webGLRenderer: THREE.WebGLRenderer;
   css3DRenderer: any;
   // Cubes
   gCube: PolyCube; sCube: PolyCube; nCube: PolyCube;

   // set default view to display all cubes
   currentViewState: VIEW_STATES = VIEW_STATES.POLY_CUBE;
   dataManager: DataManager;

   loadingDataset: boolean = false;
   errorOccurred: boolean = false;
   errorMessage: string;

   // inject google
   constructor(private google: GoogleDriveProvider) {}

   ngAfterViewInit() {
      setTimeout(() => {
         this.initDataset();
      })
   }

   initScene = () => {
      this.webGLScene = new THREE.Scene();
      this.cssScene = new THREE.Scene();
      const WIDTH = this.webGLContainer.nativeElement.offsetWidth;
      const HEIGHT = this.webGLContainer.nativeElement.offsetHeight;

      this.webGLRenderer = new THREE.WebGLRenderer({ canvas: this.webGLContainer.nativeElement as HTMLCanvasElement, alpha: true });
      this.webGLRenderer.setSize(WIDTH, HEIGHT);
      this.webGLRenderer.setClearColor(0xffffff, 0);

      this.css3DRenderer = new THREE.CSS3DRenderer();
      this.css3DRenderer.setSize(WIDTH, HEIGHT);

      this.cssContainer.nativeElement.appendChild(this.css3DRenderer.domElement);
      this.cssContainer.nativeElement.style.position = 'absolute';
      this.cssContainer.nativeElement.style.top = '0em';

      this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 100000);
      this.camera.position.set(0, 0, -10);

      this.controls = new THREE.OrbitControls(this.camera);

      this.controls.enableZoom = true;
      this.controls.enablePan = true;
      this.controls.update();

      let axis = new THREE.AxesHelper(10);
      this.webGLScene.add(axis);
   
      this.light = new THREE.DirectionalLight(0xffffff, 1.0);
      this.light.position.set(100, 100, 100);
      this.webGLScene.add(this.light);

      this.camera.position.x = 0;
      this.camera.position.y = 0;
      this.camera.position.z = 1000;

      this.camera.lookAt(this.webGLScene.position);
      
      this.animate();
   }

   initDataset(): void {
      this.loadingDataset = true;
      let _id = '1j-FnypM3zD2fjWWoZUa_X6ENh4LosKF627fZoXKSxpY'; // Cushman dataset ID
      this.dataManager = new DataManager();
      // perform request to get spreadsheet json 
      // parse it when done and pass to datamanager
      this.google.load(_id).then((success: any) => {
         this.dataManager.data = success;
         this.loadingDataset = false;
         this.initScene();
         this.initCubes();
         this.initGUI();
      });
   }
   
   updateDataset(): void {
      this.loadingDataset = true;
      let id = this.spreadsheetId.nativeElement.value;
      if(!id) {
         console.error('No spredsheet id provided.'); 
         this.loadingDataset = false;
         this.errorOccurred = true;
         this.errorMessage = 'No spreadsheet id provided.';
         return;
      }
      this.google.load(id).then((success: any) => {
         this.dataManager.data = success;
         this.loadingDataset = false;
         console.log(success);
      });
   }

   /**
    *
    */
   initCubes = () => {
      this.gCube = new GeoCube(this.dataManager, this.webGLScene, this.cssScene);
      this.sCube = new SetCube(this.dataManager, this.webGLScene, this.cssScene);
      this.nCube = new NetCube(this.dataManager, this.webGLScene, this.cssScene);
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

      targetVector.set(cubePos.x + CUBE_CONFIG.WIDTH/2, this.camera.position.y, this.camera.position.z);
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
