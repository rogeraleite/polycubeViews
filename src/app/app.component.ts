import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
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
import * as moment from'moment';

@Component({
   selector: 'app-root',
   templateUrl: './app.component.html',
   styleUrls: ['./app.component.css', './bootstrap.min.css']
})

export class AppComponent implements AfterViewInit {
   @ViewChild('spreadsheetInput') spreadsheetId: ElementRef;
   @ViewChild('webGLCanvas') webGLContainer: ElementRef;
   @ViewChild('cssCanvas') cssContainer: ElementRef;

   @ViewChild('tooltip') tooltip: ElementRef;
   title = 'polycubeViews';
   previewItem: any;

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
   camera: THREE.Camera; //PerspectiveCamera or OrthographicCamera;
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
   dataLoaded: boolean = false;
   errorOccurred: boolean = false;
   errorMessage: string;

   // inject google
   constructor(private google: GoogleDriveProvider) {
      this.previewItem = null;
   }

   /**
    * Lifecycle hook called when the DOM is initialized
    */
   ngAfterViewInit() {
      setTimeout(() => {
         this.initDataset();
      })
   }

   /**
    * Initializes the THREEJS scene 
    * - creating renderers
    * - creating camera
    * - creating scenes
    * - creating controls
    * - creating lighting
    * - call the animation loop
    */
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
     
      this.camera = new THREE.OrthographicCamera(WIDTH/-2, WIDTH/2, HEIGHT/2, HEIGHT/-2, 1, 100000);
      // this.camera = new THREE.PerspectiveCamera(60, WIDTH / HEIGHT, 1, 100000);
      this.camera.up.set(0, 1, 0)
      this.camera.position.set(0, 0, 1000);
      this.camera.lookAt(this.webGLScene.position);

      this.controls = new THREE.OrbitControls(this.camera, this.webGLRenderer.domElement);
      
      this.light = new THREE.DirectionalLight(0xffffff, 1.0);
      this.light.position.set(100, 100, 100);
      this.webGLScene.add(this.light);

      this.animate();
   }

   /**
    * Initializes the component with the default (Cushman) dataset
    * Once data is loaded initializes the scene, cubes, and GUI
    */
   initDataset(): void {
      this.loadingDataset = true;
      let _id = '1j-FnypM3zD2fjWWoZUa_X6ENh4LosKF627fZoXKSxpY'; // Cushman dataset ID
      this.dataManager = new DataManager();
      // perform request to get spreadsheet json 
      // parse it when done and pass to datamanager
      this.google.load(_id).then((success: any) => {
         this.dataManager.data = success;
         this.loadingDataset = false;
         this.dataLoaded = true;
         this.initScene();
         this.initCubes();
         this.initGUI();
         this.addEventListeners();
      });
   }

   /**
    * Updates the data set with a new dataset
    * We get the ID from the text input
    */
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
      });
   }

   /**
    * Initializes the cubes, assigns the data manager and passes the 
    * webGL and css3D scenes so that the cubes can create their objects
    * and append themselves to the scene
    */
   initCubes = () => {
      this.gCube = new GeoCube(this.dataManager, this.camera, this.webGLScene, this.cssScene);
      this.sCube = new SetCube(this.dataManager, this.camera, this.webGLScene, this.cssScene);
      this.nCube = new NetCube(this.dataManager, this.camera, this.webGLScene, this.cssScene);
   };

   /**
    * This function is called when the dataset has been changed
    * to notify the cubes that they should update the dataset
    * and re-initialize themselves
    */
   updateCubes = () => {
      this.gCube.updateData();
      this.sCube.updateData();
      this.nCube.updateData();
   }

   addEventListeners = () => {
      this.webGLContainer.nativeElement.addEventListener('click', ($event) => {
         $event.preventDefault();
         let foundItem = this.getClickedItem($event);
         if(foundItem) {
            this.previewItem = {
               title: `Picture #${foundItem.id}`, // foundItem.title is empty so just use ID
               mediaURL: foundItem.external_url,
               date: moment(foundItem.date_time).format('DD-MM-YYYY'),
               location: foundItem.location_name,
               description: foundItem.description,
               externalURL: foundItem.media_url
            };
         } else {
            this.previewItem = null;
            this.tooltip.nativeElement.style.display = 'none';
            this.tooltip.nativeElement.style.opacity = '0';
         }
      });
   }

   getClickedItem = ($event) =>{
      // look for item across cubes
      let foundItem = this.gCube.onClick($event, this.tooltip, this.webGLContainer.nativeElement );
      if(!foundItem) foundItem = this.sCube.onClick($event, this.tooltip, this.webGLContainer.nativeElement );
      if(!foundItem) foundItem = this.nCube.onClick($event, this.tooltip, this.webGLContainer.nativeElement );
      
      // if item clicked highlight accross cubes
      if(foundItem) {
         this.gCube.highlightObject(foundItem.id);
         this.sCube.highlightObject(foundItem.id);
         this.nCube.highlightObject(foundItem.id);
      }
      return foundItem;
   }

   /**
    * Initializes the GUI elements including button event listeners
    */
   initGUI = () => {
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

      this.gui.stcBtn.addEventListener('click', () => {
         this.gCube.transitionSTC();
         this.sCube.transitionSTC();
         this.nCube.transitionSTC();
      });

      this.gui.jpBtn.addEventListener('click', () => {
         this.gCube.transitionJP();
         this.sCube.transitionJP();
         this.nCube.transitionJP();
      });

      this.gui.siBtn.addEventListener('click', () => {
         this.gCube.transitionSI();
         this.sCube.transitionSI();
         this.nCube.transitionSI();
      });
   }

   /**
    * Clears the current (webGL) scene from all cube groups
    */
   removeAllCubeViews = (): void => {
      this.webGLScene.remove(this.webGLScene.getObjectByName('GEO_CUBE'));
      this.cssScene.remove(this.cssScene.getObjectByName('GEO_CUBE_CSS'));
      this.gCube.hideBottomLayer();
      this.webGLScene.remove(this.webGLScene.getObjectByName('SET_CUBE'));
      this.cssScene.remove(this.cssScene.getObjectByName('SET_CUBE_CSS'));
      this.sCube.hideBottomLayer();
      this.webGLScene.remove(this.webGLScene.getObjectByName('NET_CUBE'));
      this.cssScene.remove(this.cssScene.getObjectByName('NET_CUBE_CSS'));
      this.nCube.hideBottomLayer();
   }

   /**
    * This function is used to position the camera 
    */
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
            this.controls.update();
         })
      });
   };

   /**
    * Updates which cubes are shown based on user selection
    */
   updateCubesView = (): void => {
      this.removeAllCubeViews();
      this.gCube.update(this.currentViewState);
      this.sCube.update(this.currentViewState);
      this.nCube.update(this.currentViewState);
      this.positionCamera();
   };

   /**
    * Starts the animation (rendering) loop
    */
   animate = () => {
      requestAnimationFrame(this.animate);
      TWEEN.update();
      this.render();
   }

   /**
    * Function called each iteration of the rendering loop
    * Renders the scene from the cameras PoV
    */
   render() {
      //this.webGLRenderer.render(this.scene, this.camera.perspectiveCamera);
      this.webGLRenderer.render(this.webGLScene, this.camera);
      this.css3DRenderer.render(this.cssScene, this.camera);
      this.controls.update();
   }

   /**
    * Updates the current view with the users section
    * @param view - string: user selection stating which cube should be displayed
    */
   setCubeView(view: string): void {
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

   filterDataWithTimeSlider($event: any): void {
      this.gCube.filterDataByDatePeriod($event[0], $event[1]);
      this.sCube.filterDataByDatePeriod($event[0], $event[1]);
      this.nCube.filterDataByDatePeriod($event[0], $event[1]);
   }

   /**
    * 
    */
   getMinDate(): Date { return this.dataManager.getMinDate(); }

   /**
    * 
    */
   getMaxDate(): Date { return this.dataManager.getMaxDate(); }

   /**
    * 
    */
   getWindowInnerHeight(): number { return window.innerHeight; }
}
