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

/**
 * PolyCube main controller
 * - loads and parses data
 * - initializes threejs scene
 * - initializes cube components
 */
export class AppComponent implements AfterViewInit {
   // Canvases
   @ViewChild('webGLCanvas') webGLContainer: ElementRef;
   @ViewChild('cssCanvas') cssContainer: ElementRef;

   // spreadsheet input field
   @ViewChild('spreadsheetInput') spreadsheetId: ElementRef;

   // detail panel
   @ViewChild('modal') modalContainer: ElementRef;
   @ViewChild('img') imgContainer: ElementRef;
   @ViewChild('caption') captionContainer: ElementRef;
   // toggle buttons for cubes
   @ViewChild('geobtn') gBtn: ElementRef;
   @ViewChild('setbtn') sBtn: ElementRef;
   @ViewChild('netbtn') nBtn: ElementRef;

   // tooltip html element for d3
   @ViewChild('tooltip') tooltip: ElementRef;

   title = 'PolyCube';

   
   // processing & updating
   processingChange: boolean = true;
   processingMessage: string = 'Loading dataset...';
   
   previewPanel: boolean = false;
   previewItem: any;

   currentlySelectedCategory: string;
   currentlySelectedDateExtent: Array<Date>;

   // ThreeJS things
   gui: GUI;
   webGLScene: THREE.Scene;
   cssScene: THREE.Scene;
   camera: THREE.Camera; //PerspectiveCamera or OrthographicCamera;
   perspectiveCamera: THREE.PerspectiveCamera;
   orthographicCamera: THREE.OrthographicCamera;
   light: THREE.Light;
   controls: THREE.OrbitControls;
   webGLRenderer: THREE.WebGLRenderer;
   css3DRenderer: any;
   camToSave: any;
   
   // Cubes
   gCube: PolyCube; sCube: PolyCube; nCube: PolyCube;

   // set default view to display all cubes
   currentViewState: VIEW_STATES = VIEW_STATES.POLY_CUBE;
   dataManager: DataManager;

   // data management
   loadingDataset: boolean = true;
   dataLoaded: boolean = false;

   // error management
   errorOccurred: boolean = false;
   errorMessage: string;

   // animation duration
   duration: number;

   // frontend things
   categoriesAndColors: Map<string, string>;
   showColorCodingLegend: boolean = true;
   categories: Array<string>;

   // inject google
   constructor(private google: GoogleDriveProvider, private compRef: ElementRef) {
      this.previewItem = null;
      this.categories = new Array<string>();
      this.categoriesAndColors = new Map<string, string>();
      this.duration = CUBE_CONFIG.DURATION ? CUBE_CONFIG.DURATION : 2000;

      this.currentlySelectedCategory = '';
      this.currentlySelectedDateExtent = new Array<Date>();
   }

   /**
    * Lifecycle hook called when the DOM is initialized
    */
   ngAfterViewInit() {
      // set initial classses
      this.gBtn.nativeElement.className = 'btn  btn-secondary';
      this.sBtn.nativeElement.className = 'btn  btn-secondary';
      this.nBtn.nativeElement.className = 'btn  btn-secondary';
      
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
     
      this.orthographicCamera = new THREE.OrthographicCamera(WIDTH/-2, WIDTH/2, HEIGHT/2, HEIGHT/-2, -10000, 10000);
      this.perspectiveCamera = new THREE.PerspectiveCamera(20, WIDTH / HEIGHT, 1, 100000);

      this.camera = this.perspectiveCamera;
      // this.camera = this.orthographicCamera;

      this.camera.up.set(0, 1, 0);
      // this.camera.position.set(200, 200, 4800); // for orthocamera
      this.camera.position.set(803, 912, 4755)
      this.camera.lookAt(this.webGLScene.position.x, this.webGLScene.position.y, this.webGLScene.position.z);

      this.controls = new THREE.OrbitControls(this.camera, this.webGLRenderer.domElement);
      this.controls.target = new THREE.Vector3(1000, 0, 0);
      this.controls.enableZoom = true;
      this.controls.zoomSpeed = 1.2;

      //hold initial camera and position values
      this.camToSave = {};
      this.camToSave.position = this.camera.position.clone();
      this.camToSave.rotation = this.camera.rotation.clone();
      this.camToSave.controlCenter = this.controls.target.clone();
   }

   /**
    * Initializes the component with the default (Cushman) dataset
    * Once data is loaded initializes the scene, cubes, and GUI
    */
   initDataset(): void {
      this.loadingDataset = true;
      let _id = CUBE_CONFIG.DATA_SET.id; // Cushman dataset ID
      this.dataManager = new DataManager();
      // perform request to get spreadsheet json 
      // parse it when done and pass to datamanager
      this.google.load(_id).then((success: any) => {
         this.dataManager.data = success;

         this.processingChange = false;
         this.processingMessage = '';
         
         this.loadingDataset = false;
         this.dataLoaded = true;
         
         // default date extent for filtering
         this.currentlySelectedDateExtent.push(this.dataManager.getMinDate());
         this.currentlySelectedDateExtent.push(this.dataManager.getMaxDate());

         this.categories = Array.from(this.dataManager.categories.keys());

         this.categoriesAndColors = this.dataManager.categories;
         this.initScene();
         this.initCubes();
         this.initGUI();
         this.addEventListeners();
         this.animate();
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
      }).catch((err: any) => {
         this.errorOccurred = true;
         this.errorMessage = err;
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
               id: foundItem.id,
               mediaURL: foundItem.external_url,
               date: moment(foundItem.date_time).format('DD-MM-YYYY'),
               location: foundItem.location_name,
               description: foundItem.description,
               externalURL: foundItem.media_url,
               related: foundItem.target_nodes,
               categories: [foundItem.category_1, foundItem.category_2, foundItem.category_3, foundItem.category_4, foundItem.category_5]
            };

            this.openPreview();
         } else {
            this.previewItem = null;
            this.tooltip.nativeElement.style.display = 'none';
            this.tooltip.nativeElement.style.opacity = '0';
            this.closePreview();
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
    * Open / Close the preview panel (details on the side)
    */
   openPreview(): void {
      this.previewPanel = true;
   }

   closePreview(): void {
      this.previewPanel = false;
   }

   /**
    * Return details about related nodes
    * @param id Node ID
    */
   getRelatedNode(id: number): any {
      let found = this.dataManager.data.find((d: any) => {
         return d.id === id;
      });

      return found;
   }

   selectNode(id: number): void {
      let selected = this.dataManager.data.find((d: any) => {
         return d.id === id;
      });

      // update this.preview
      this.previewItem = {
         title: `Picture #${selected.id}`, // selected.title is empty so just use ID
         id: selected.id,
         mediaURL: selected.external_url,
         date: moment(selected.date_time).format('DD-MM-YYYY'),
         related: selected.target_nodes,
         location: selected.location_name,
         description: selected.description,
         externalURL: selected.media_url,
         categories: [selected.category_1, selected.category_2, selected.category_3, selected.category_4, selected.category_5]
      };

      // highlight in cubes
      this.gCube.highlightObject(selected.id);
      this.sCube.highlightObject(selected.id);
      this.nCube.highlightObject(selected.id);
   }
   getPrevious(): void {
      this.processingChange = true;
      this.processingMessage = 'Loading image...';
      let currentItem = this.previewItem;

      let foundIdx = this.dataManager.data.map((d: any) => { return d.id; }).indexOf(currentItem.id); 

      let foundItem = this.dataManager.data[(foundIdx - 1) % this.dataManager.data.length];

      this.previewItem = {
         title: `Picture #${foundItem.id}`, // foundItem.title is empty so just use ID
         id: foundItem.id,
         mediaURL: foundItem.external_url,
         date: moment(foundItem.date_time).format('DD-MM-YYYY'),
         location: foundItem.location_name,
         related: foundItem.target_nodes,
         description: foundItem.description,
         externalURL: foundItem.media_url,
         categories: [foundItem.category_1, foundItem.category_2, foundItem.category_3, foundItem.category_4, foundItem.category_5]
      };

      this.imgContainer.nativeElement.src = this.previewItem.mediaURL;
      this.captionContainer.nativeElement.innerHTML = this.previewItem.description;
   }

   getNext(): void {
      this.processingChange = true;
      this.processingMessage = 'Loading image...';
      let currentItem = this.previewItem;
      let foundIdx = this.dataManager.data.map((d: any) => { return d.id; }).indexOf(currentItem.id); 

      let foundItem = this.dataManager.data[(foundIdx + 1) % this.dataManager.data.length];

      this.previewItem = {
         title: `Picture #${foundItem.id}`, // foundItem.title is empty so just use ID
         id: foundItem.id,
         mediaURL: foundItem.external_url,
         date: moment(foundItem.date_time).format('DD-MM-YYYY'),
         related: foundItem.target_nodes,
         location: foundItem.location_name,
         description: foundItem.description,
         externalURL: foundItem.media_url,
         categories: [foundItem.category_1, foundItem.category_2, foundItem.category_3, foundItem.category_4, foundItem.category_5]
      };

      this.imgContainer.nativeElement.src = this.previewItem.mediaURL;
      this.captionContainer.nativeElement.innerHTML = this.previewItem.description;

   }

   imageLoaded(): void {
      this.processingChange = false;
      this.processingMessage = '';
      console.log('image loaded');
   }

   /**
    * Initializes the GUI elements including button event listeners
    */
   initGUI = () => {
      this.gui = new GUI();
      // general settings
      this.processingMessage = 'Processing new configuration...';
      this.gui.pCubeConfigEmitter.on('processing', (change: any) => {
         this.processingChange = change;
      });

      this.gui.pCubeConfigEmitter.on('change', (change: any) => {
         if(change.backgroundColor) {
            this.compRef.nativeElement.ownerDocument.body.style.backgroundColor = change.backgroundColor;
         }

         if(change.time) {
            this.gCube.updateTime(change.time);
            this.sCube.updateTime(change.time);
            this.nCube.updateTime(change.time);
         }

         if(change.numSlices) {
            this.dataManager.numSlices = change.numSlices;
            
            this.gCube.updateNumSlices(change.numSlices);
            this.sCube.updateNumSlices(change.numSlices);
            this.nCube.updateNumSlices(change.numSlices);
            // this.processingChange = false;
         }

         if(change.nodeSize) {
            this.gCube.updateNodeSize(change.nodeSize);
            this.sCube.updateNodeSize(change.nodeSize);
            this.nCube.updateNodeSize(change.nodeSize);
         }

         if(change.nodeColor) {
            this.showColorCodingLegend = change.nodeColor !== 'categorical' ? false : true;
            
            this.gCube.updateNodeColor(change.nodeColor);
            this.sCube.updateNodeColor(change.nodeColor);
            this.nCube.updateNodeColor(change.nodeColor);

            //update timeline color
            if(change.nodeColor === 'temporal'){
               this.timelineColor(true)
            }else{
               this.timelineColor(false)
            }
         }

         // camera switch 
         if(change.cameraType) {

            if(change.cameraType === 'Perspective'){
               this.usePerspectiveCamera();
            } else if (change.cameraType === 'Orthographic'){
               this.useOrthographicCamera();
            }
         }

         // reset scene
         if(change.reset) {
            this.resetScene()
         }



         // we should be done processing changes
         this.processingChange = false;
      });
      // geocube settings
      this.gui.gCubeConfigEmitter.on('change', (change: any) => {
         if(change.jitter) {
            (this.gCube as GeoCube).updateJitter(change.jitter)
         }
      });   

      // setcube settings
      this.gui.sCubeConfigEmitter.on('change', (change: any) => {
            if(change.sLayout) {
               (this.sCube as SetCube).updateLayout(change.sLayout)
            }

            //hull button
            if(change.hull == true){
               if(!(this.sCube as SetCube).getHullState()){
                  (this.sCube as SetCube).drawHull();
               }else{
                  (this.sCube as SetCube).showHull();
               }
            }else{
               (this.sCube as SetCube).hideHull()
            }
         });   

      // netcube settings
      this.gui.nCubeConfigEmitter.on('change', (change: any) => {
         if(change.nNodeSize) {
            (this.nCube as NetCube).changeNodeSizeEncode(change.nNodeSize)
         }
         if(change.nCharge) {
            (this.nCube as NetCube).changeChargeFactor(change.nCharge)
         }
      }); 
   

      // button event listeners
      this.gui.geoBtn.addEventListener('click', () => { this.setCubeView(VIEW_STATES.GEO_CUBE); });
      this.gui.setBtn.addEventListener('click', () => { this.setCubeView(VIEW_STATES.SET_CUBE); });
      this.gui.netBtn.addEventListener('click', () => { this.setCubeView(VIEW_STATES.NET_CUBE); });

      this.gui.stcBtn.addEventListener('click', () => {
         this.gCube.transitionSTC();
         this.sCube.transitionSTC();
         this.nCube.transitionSTC();


          //rotate camera to STC
          this.transitionSTCCamera();
      });

      this.gui.jpBtn.addEventListener('click', () => {
         this.gCube.transitionJP();
         this.sCube.transitionJP();
         this.nCube.transitionJP();


         //rotate camera to JP
         this.transitionJPCamera();

      });

      this.gui.siBtn.addEventListener('click', () => {
         this.gCube.updateNodeColor('temporal');
         this.nCube.updateNodeColor('temporal');
         this.gCube.transitionSI();
         this.sCube.transitionSI();
         this.nCube.transitionSI();
         //this.sCube.updateNodeColor('temporal'); //FIXME: need to be called after SI is finished in SCUBE


         //rotate camera to SI
         this.transitionSICamera();
      });
   }

  /**
    * Rotate Camera to SI view
    */
   transitionSICamera(): void{

      //update timeline color as true
      this.timelineColor(true);

      this.restoreCamera(this.camToSave.position, this.camToSave.rotation, this.camToSave.controlCenter);

      //stop rotation
      this.controls.enableRotate = false;

      let duration = 1000;
      let targetVector = new THREE.Vector3();
      let tweenPos = new TWEEN.Tween(this.camera.position);
      targetVector.set(1000, 4826, 428);
      tweenPos.to(targetVector, duration);
      tweenPos.start().onComplete(() => {
         this.controls.update();
         this.camera.lookAt(targetVector);
      });

      this.camera.zoom = 1;
      this.camera.updateProjectionMatrix();

   }

   /**
    * Rotate Camera to STC view
    */

   transitionSTCCamera(): void{
      //update timeline color as false
      this.timelineColor(false)
      this.restoreCamera(this.camToSave.position, this.camToSave.rotation, this.camToSave.controlCenter);

      //allow rotation
      this.controls.enableRotate = true;

      let duration = 1000;
      let targetVector = new THREE.Vector3();
      let tweenPos = new TWEEN.Tween(this.camera.position);
      targetVector.set(800, 912, 4755);
      tweenPos.to(targetVector, duration);
      tweenPos.start().onComplete(() => {
         this.controls.update();
         this.camera.lookAt(targetVector);
      });
      this.camera.zoom = 1;
      this.camera.updateProjectionMatrix();

   }

   transitionJPCamera(): void {
      // update timeline color
      this.timelineColor(false);
      this.restoreCamera(this.camToSave.position, this.camToSave.rotation, this.camToSave.controlCenter);

      // stop rotation
      this.controls.enableRotate = false;

      let duration = 1000;
      let targetVector = new THREE.Vector3();
      let targetVector2 = new THREE.Vector3();
      let tweenPos = new TWEEN.Tween(this.camera.position);
      let tweenRot = new TWEEN.Tween(this.camera.position);

      // targetVector.set(1000, 4826, 428);
      targetVector.set(1000, 10826, 428);
      tweenPos.to(targetVector, duration);
      tweenPos.start().onComplete(() => {
         this.controls.update();
         this.camera.lookAt(targetVector);
         //
         this.camera.zoom = 0.7;
         this.camera.updateProjectionMatrix();
         targetVector2.set(644.2056736616696, 9000.63192337427, -5.384615481310194);
         tweenRot.to(targetVector2, 2000);
         tweenRot.start().onComplete(() => {
            this.camera.lookAt(targetVector2);
            this.controls.update();
         });
      });
   }

   resetScene(): void {
      this.restoreCamera(this.camToSave.position, this.camToSave.rotation, this.camToSave.controlCenter);
      this.gCube.transitionSTC();
      this.sCube.transitionSTC();
      this.nCube.transitionSTC();

       //rotate camera to STC
      this.transitionSTCCamera();
   }

   restoreCamera(position:THREE.Vector3, rotation: THREE.Euler, controlCenter: THREE.Vector3) {
      let targetVector = new THREE.Vector3();
      let targetVector2 = new THREE.Vector3();
      let tweenPos = new TWEEN.Tween(this.camera.position);
      let tweenRot = new TWEEN.Tween(this.camera.position);

      // this.camera.position.set(position.x, position.y, position.z);
      targetVector.set(position.x, position.y, position.z);
      tweenPos.to(targetVector, 1000);
      tweenPos.start().onComplete(() => {
         this.controls.target.set(controlCenter.x, controlCenter.y, controlCenter.z);
         this.controls.update();
      });

      // this.camera.rotation.set(rotation.x, rotation.y, rotation.z);
      targetVector2.set(rotation.x, rotation.y, rotation.z);
      tweenRot.to(targetVector2, 1000);
      tweenRot.start().onComplete(() => {
         this.controls.target.set(controlCenter.x, controlCenter.y, controlCenter.z);
         this.controls.update();
      });

      // this.controls.target.set(controlCenter.x, controlCenter.y, controlCenter.z);
      // this.controls.update();  
  }

   /**
    * This function is used to update brush timeline color
    */
   timelineColor(visible: boolean):void{
      if(visible == true){
         // D3.select('#timeLegend').classed('hide', false)
         D3.select('#timeLegend').style('display','block')
      } else{
         // D3.select('#timeLegend').classed('hide', true)
         D3.select('#timeLegend').style('display','none')
      }
   }
   
   usePerspectiveCamera(): void {
      let cameraPosition = this.orthographicCamera.position.clone();
      let cameraZoom = this.orthographicCamera.zoom;

      this.camera = this.perspectiveCamera;

      this.camera.zoom = cameraZoom;
      this.camera.position.copy(cameraPosition);
      this.camera.updateProjectionMatrix();

      this.controls.object = this.camera;
   }

   useOrthographicCamera(): void {
      let cameraPosition = this.perspectiveCamera.position.clone();
      let cameraZoom = this.perspectiveCamera.zoom;

      this.camera = this.orthographicCamera;
      this.camera.zoom = cameraZoom;

      this.camera.position.copy(cameraPosition);
      this.camera.updateProjectionMatrix();


      this.controls.object = this.camera;
   }

   /**
    * Clears the current (webGL) scene from all cube groups
    */
   removeAllCubeViews = (): void => {
      this.gCube.hideCube();
      this.sCube.hideCube();
      this.nCube.hideCube();
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

      let currentXPos = 0;
      if(this.gCube.cubeToggle) {
         // pos gCube
         this.gCube.cubeGroupGL.position.set(currentXPos, 0, 0);
         this.gCube.cubeGroupCSS.position.set(currentXPos, 0, 0);
         currentXPos += CUBE_CONFIG.WIDTH + CUBE_CONFIG.GUTTER;
      }
      if(this.sCube.cubeToggle) {
         this.sCube.cubeGroupGL.position.set(currentXPos, 0, 0);
         this.sCube.cubeGroupCSS.position.set(currentXPos, 0, 0);
         currentXPos += CUBE_CONFIG.WIDTH + CUBE_CONFIG.GUTTER;
      }
      if(this.nCube) {
         this.nCube.cubeGroupGL.position.set(currentXPos, 0, 0);
         this.nCube.cubeGroupCSS.position.set(currentXPos, 0, 0);
      }

      // targetVector.set(cubePos.x + CUBE_CONFIG.WIDTH/2, this.camera.position.y, this.camera.position.z);
      // tweenPos.to(targetVector, 250);
      // tweenLookAt.to(cubePos, 250);
      // tweenPos.start().onComplete(() => {
      //    tweenLookAt.start().onUpdate((target: THREE.Vector3) => {
      //       this.camera.lookAt(target);
      //       this.controls.update();
      //    });
      // });
   };

   closePicture(): void {
      this.modalContainer.nativeElement.style.display = 'none';
      this.imgContainer.nativeElement.style.display = 'none';
      this.imgContainer.nativeElement.src = '';
      this.captionContainer.nativeElement.innerHTML = '';
   }

   openPicture(url: string, desc: string): void {
      this.modalContainer.nativeElement.style.display = 'block';
      this.imgContainer.nativeElement.style.display = 'block';
      this.imgContainer.nativeElement.src = url;
      this.captionContainer.nativeElement.innerHTML = desc;
   }

   /**
    * Updates which cubes are shown based on user selection
    */
   updateCubesView = (): void => {
      this.removeAllCubeViews();
      this.gCube.updateView(this.currentViewState);
      this.sCube.updateView(this.currentViewState);
      this.nCube.updateView(this.currentViewState);

      this.positionCamera();
   };

   /**
    * Starts the animation (rendering) loop
    */
   animate = () => {
      requestAnimationFrame(this.animate);
      this.render();
   }

   /**
    * Function called each iteration of the rendering loop
    * Renders the scene from the cameras PoV
    */
   render() {
      TWEEN.update();
      this.controls.update();
      this.webGLRenderer.render(this.webGLScene, this.camera);
      this.css3DRenderer.render(this.cssScene, this.camera);
   }

   /**
    * Updates the current view with the users section
    * @param view - string: user selection stating which cube should be displayed
    */
   setCubeView(view: string): void {
      switch (view) {
         case 'GEO_CUBE': 
            this.gCube.toggleDisplayCube(); 
            this.gBtn.nativeElement.className = this.gCube.cubeToggle ? 'btn  btn-secondary' : 'btn  btn-outline-secondary';
            break;
         case 'SET_CUBE': 
            this.sCube.toggleDisplayCube(); 
            this.sBtn.nativeElement.className = this.sCube.cubeToggle ? 'btn  btn-secondary' : 'btn  btn-outline-secondary';
            break;
         case 'NET_CUBE': 
            this.nCube.toggleDisplayCube(); 
            this.nBtn.nativeElement.className = this.nCube.cubeToggle ? 'btn  btn-secondary' : 'btn  btn-outline-secondary';
            break;
         // case 'POLY_CUBE': this.currentViewState = VIEW_STATES.POLY_CUBE; break; -- doesn't exist
         default:
            return;
      }

      this.updateCubesView();
   }

   filterDataWithTimeSlider($event: any): void {
     this.currentlySelectedDateExtent[0] = $event[0];
     this.currentlySelectedDateExtent[1] = $event[1];

     this.applyFilter();
   }

   clearCategoryFilter(): void {
      this.currentlySelectedCategory = "";
      this.applyFilter();
   }

   filterDataByCategory(category: string): void {
     this.currentlySelectedCategory = category;
     this.applyFilter();
   }

   applyFilter(): void {
      this.gCube.filterData(this.currentlySelectedCategory, this.currentlySelectedDateExtent[0], this.currentlySelectedDateExtent[1]);
      this.sCube.filterData(this.currentlySelectedCategory, this.currentlySelectedDateExtent[0], this.currentlySelectedDateExtent[1]);
      this.nCube.filterData(this.currentlySelectedCategory, this.currentlySelectedDateExtent[0], this.currentlySelectedDateExtent[1]);
   }

   formatDate(date: Date): string {
      return moment(date).format('DD/MM/YYYY');
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
