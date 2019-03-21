import { PolyCube } from './polycube.interface';
import { DataManager } from './datamanager';
import { environment } from '../../environments/environment';
import { ElementRef } from '@angular/core';
import { VIEW_STATES } from './viewStates';
import { CUBE_CONFIG } from '../cube.config';
import * as THREE from 'three-full';
import * as TWEEN from '@tweenjs/tween.js';
import * as D3 from 'd3';
import * as mapboxgl from 'mapbox-gl';
import * as moment from 'moment';

export class GeoCube implements PolyCube {
    cubeGroupGL: THREE.Group;
    cubeGroupCSS: THREE.Group;

    private dm: DataManager;
    private camera: THREE.Camera;
    private webGLScene: THREE.Scene;
    private cssScene: THREE.Scene;
    private setMap: Set<string>;
    private boundingBox: THREE.BoxHelper;

    // THREEJS Objects
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;
    private objects: Array<any>;
    private slices: Array<THREE.Group>;
    private colors: D3.ScaleOrdinal<string, string>;
    private timeLinearScale: D3.ScaleLinear<number, number>;

    private map: mapboxgl.Map;
    private mapBounds: mapboxgl.LngLatBounds;
    private mapCenter: { lat: number, lng: number };

    /**
     * 
     * @param dm DataManager
     * @param camera THREE.JS Camera (Perspective of Orthographic)
     * @param webGLScene THREE.JS GL Scene
     * @param cssScene  THREE.JS CSS Scene
     */
    constructor(dm: DataManager, camera: THREE.Camera, webGLScene: THREE.Scene, cssScene?: THREE.Scene) {
        this.dm = dm;
        this.webGLScene = webGLScene;
        if (cssScene) { this.cssScene = cssScene; }
        this.setMap = new Set<string>();
        this.mapBounds = new mapboxgl.LngLatBounds();
        this.camera = camera;
        // https://stackoverflow.com/questions/44332290/mapbox-gl-typing-wont-allow-accesstoken-assignment
        (mapboxgl as typeof mapboxgl).accessToken = environment.MAPBOX_KEY;
        this.createObjects();
        this.assembleData();
        this.render();
    }

    /**
     * Initialize all group objects 
     */
    createObjects(): void {
        this.cubeGroupGL = new THREE.Group();
        this.cubeGroupCSS = new THREE.Group();
        this.colors = D3.scaleOrdinal(D3.schemePaired);
        this.slices = new Array<THREE.Group>();

        let vertOffset = CUBE_CONFIG.WIDTH / this.dm.timeRange.length;
        for(let i = 0; i < this.dm.timeRange.length; i++) {
            // TIME SLICES
            let slice = new THREE.Group();

            // name set to year -> we can now map objects to certain layers by checking their
            // this.dm.getTimeQuantile(date) and the slices name.
            slice.name = this.dm.timeRange[i].getFullYear();

            let geometry = new THREE.PlaneGeometry(CUBE_CONFIG.WIDTH, CUBE_CONFIG.HEIGHT, 32 );
            let edgeGeometry = new THREE.EdgesGeometry(geometry);
            let material = new THREE.LineBasicMaterial( {color: '#b5b5b5' } );
            let plane = new THREE.LineSegments( edgeGeometry, material );

            slice.position.set(CUBE_CONFIG.WIDTH/2, (i*vertOffset) - (CUBE_CONFIG.WIDTH/2), CUBE_CONFIG.WIDTH/2);
            plane.position.set(0, 0, 0);
            plane.rotation.set(Math.PI/2, 0, 0);
            slice.add(plane);
            this.slices.push(slice);
            
            // CSS 3D TIME SLICE LABELS
            let element = document.createElement('div');
            element.innerHTML = slice.name;
            element.className = 'time-slice-label';
        
            //CSS Object
            let label = new THREE.CSS3DObject(element);
            label.position.set(-20, (i*vertOffset) - (CUBE_CONFIG.WIDTH/2), CUBE_CONFIG.WIDTH/2);
            // label.rotation.set(Math.PI);
            this.cssScene.add(label);
        }

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
    
        let placeholderBox = new THREE.Mesh( 
                                new THREE.BoxGeometry( CUBE_CONFIG.WIDTH, CUBE_CONFIG.WIDTH, CUBE_CONFIG.WIDTH ), 
                                new THREE.MeshBasicMaterial( {color: 0x00ff00} ) 
                            );
        placeholderBox.position.set(CUBE_CONFIG.WIDTH/2,0,CUBE_CONFIG.WIDTH/2);
        this.boundingBox = new THREE.BoxHelper(placeholderBox, '#b5b5b5');
        this.boundingBox.name = 'BOX_HELPER';
        this.cubeGroupGL.add(this.boundingBox);
        this.slices.forEach((slice: THREE.Group) => { this.cubeGroupGL.add(slice); });
    }

    /**
     * Creates the visual objects and organizes them after data has been loaded
     */
    assembleData(): void {
        this.dm.data.forEach((d: any) => { this.setMap.add(d.category_1); });
        this.cubeGroupCSS.add(this.createMap());
        // this.timeLinearScale(some_date) gives us the vertical axis coordinate of the point
        this.timeLinearScale = this.dm.getTimeLinearScale();
        let bounds = new mapboxgl.LngLatBounds();

        this.dm.data.forEach((d: any) => { bounds.extend(new mapboxgl.LngLat(d.longitude, d.latitude)); });

        this.map.fitBounds(bounds);
        this.mapBounds = bounds;

        this.map.on('moveend', () => {
            let center = this.map.getCenter();
            this.mapCenter = {
                lat: center.lat,
                lng: center.lng
            };

            let geometry = new THREE.SphereGeometry(CUBE_CONFIG.NODE_SIZE, 32, 32);

            for (let i = 0; i < this.dm.data.length; i++) {
                let dataItem = this.dm.data[i];
                let material = new THREE.MeshBasicMaterial({ color: this.colors(dataItem.category_1) });

                let cubeCoords = this.map.project(new mapboxgl.LngLat(dataItem.longitude, dataItem.latitude));
                let sphere = new THREE.Mesh(geometry, material);

                // need to offset the x,z coordinate so they overlap with cube
                sphere.position.x = cubeCoords.x - CUBE_CONFIG.WIDTH/2;
                // sphere.position.y = correspondingSlice.position.y; -- y coordinate is inherited from the slice positioning
                sphere.position.z = cubeCoords.y - CUBE_CONFIG.HEIGHT/2;

                sphere.data = dataItem;
                sphere.type = 'DATA_POINT';
                this.findTimeSlice(dataItem.date_time).add(sphere);
            }
        });
    }

    /**
     * Creates the map for the bottom slice of the cube (CSS3D)
     * @param position (optional) position vector (3D) for the css 3d object
     * @param bounds (optional) bounds that should be set for the map
     * @param name (optional) name/identifier of the css 3d object
     * @returns THREE.CSS3DObject the map object
     */
    private createMap(position?: THREE.Vector3, bounds?: mapboxgl.LngLatBounds, name?: string): THREE.CSS3DObject {
        // Bottomside of cube
        let mapContainer = document.createElement('div');
        mapContainer.id = name ? name.toLowerCase() : 'map_container';
        mapContainer.style.width = CUBE_CONFIG.WIDTH + "px";
        mapContainer.style.height = CUBE_CONFIG.WIDTH + "px";
        // need to add it to the DOM so mapbox can hook onto it
        document.getElementById('css-canvas').appendChild(mapContainer);

        this.map = new mapboxgl.Map({
            container: name ? name.toLowerCase() : 'map_container',
            style: 'mapbox://styles/velitchko/cjefo9eu118qd2rodaoq3cpj1',
            zoom: 13,
            center: this.mapCenter ? [this.mapCenter.lng, this.mapCenter.lat] : [0, 0]
        });

        if(bounds) this.map.fitBounds(bounds);

        // CSS Object
        let mapObject = new THREE.CSS3DObject(mapContainer);
        mapObject.name = name ? name : 'MAP_CONTAINER';

        if(!position) {
            mapObject.position.set(CUBE_CONFIG.WIDTH / 2, -CUBE_CONFIG.WIDTH / 2, CUBE_CONFIG.WIDTH / 2);
        } else {
            mapObject.position.set(position.x, position.y, position.z);
        }

        mapObject.rotation.set(-Math.PI/2, 0, 0);

        return mapObject;
    }

    /**
     * Set GL and CSS cube properties and add them to their 
     * respective scenes for rendering
     */
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

    /**
     * Updates current view (from controller)
     * @param currentViewState 
     */
    update(currentViewState: VIEW_STATES): void {
        if (currentViewState.valueOf() === VIEW_STATES.GEO_CUBE || currentViewState.valueOf() === VIEW_STATES.POLY_CUBE) {
            this.webGLScene.add(this.cubeGroupGL);
            this.cssScene.add(this.cubeGroupCSS);
            this.showBottomLayer();
        }
    }

    /**
     * TODO: Implement this function
     * Should be called when data has changed from the datamanager
     * Should reinitialize whole cube
     */
    updateData(): void {

    }

    /**
     * Transitions from whatever temporal encoding to STC
     */
    transitionSTC(): void { 
        let vertOffset = CUBE_CONFIG.HEIGHT/this.dm.timeRange.length;
        this.cubeGroupGL.add(this.boundingBox);
        this.slices.forEach((slice: THREE.Group, i: number) => {
            let mapClone = this.cubeGroupCSS.getObjectByName(`MAP_CONTAINER_${i}`);

            let sourceCoords = {
                x: slice.position.x,
                y: slice.position.y,
                z: slice.position.z
            };

            let targetCoords = {
                x: CUBE_CONFIG.WIDTH/2,
                y: (i*vertOffset) - (CUBE_CONFIG.WIDTH/2),
                z: CUBE_CONFIG.WIDTH/2
            }

            let tween = new TWEEN.Tween(sourceCoords)
                                 .to(targetCoords, 1000)
                                 .delay(i*300)
                                 .easing(TWEEN.Easing.Cubic.InOut)
                                 .onUpdate(() => {
                                    slice.position.x = sourceCoords.x;
                                    slice.position.y = sourceCoords.y,
                                    slice.position.z = sourceCoords.z;
                                    if(mapClone) {
                                        mapClone.position.x = sourceCoords.x;
                                        mapClone.position.y = sourceCoords.y;
                                        mapClone.position.z = sourceCoords.z;
                                    }
                                 })
                                 .onComplete(() => {
                                    this.cubeGroupCSS.remove(mapClone);
                                    this.showBottomLayer();
                                 })
                                 .start();

            // slice.position.set(CUBE_CONFIG.WIDTH/2, (i*vertOffset) - (CUBE_CONFIG.WIDTH/2), CUBE_CONFIG.WIDTH/2);
        });
    }

    /**
     * Transitions from whatever temporal encoding to JP
     */
    transitionJP(): void {
        let vertOffset = CUBE_CONFIG.HEIGHT + 20;
        this.cubeGroupGL.remove(this.boundingBox);
        this.hideBottomLayer();

        this.slices.forEach((slice: THREE.Group, i: number) => {
            let mapClone = this.createMap(new THREE.Vector3(slice.position.x, slice.position.y, slice.position.z), this.mapBounds,`MAP_CONTAINER_${i}`);
            this.cubeGroupCSS.add(mapClone);

            let sourceCoords = {
                x: slice.position.x,
                y: slice.position.y,
                z: slice.position.z
            };
           
            let targetCoords = {
                x: slice.position.x,
                y: -CUBE_CONFIG.HEIGHT/2,
                z: (i*vertOffset) - (CUBE_CONFIG.WIDTH/2)
            }

            let tween = new TWEEN.Tween(sourceCoords)
                                 .to(targetCoords, 1000)
                                 .delay(i*300)
                                 .easing(TWEEN.Easing.Cubic.InOut)
                                 .onUpdate(() => {
                                    slice.position.x = sourceCoords.x;
                                    slice.position.y = sourceCoords.y,
                                    slice.position.z = sourceCoords.z;

                                    mapClone.position.x = sourceCoords.x;
                                    mapClone.position.y = sourceCoords.y;
                                    mapClone.position.z = sourceCoords.z;
                                 })
                                 .start();
        });

    }

    /**
     * Transitions from whatever temporal encoding to SI
     */
    transitionSI(): void { 
        this.cubeGroupGL.remove(this.boundingBox);

        this.slices.forEach((slice: THREE.Group, i: number) => {
            let mapClone = this.cubeGroupCSS.getObjectByName(`MAP_CONTAINER_${i}`);
            if(mapClone) this.cubeGroupCSS.remove(mapClone);

            let sourceCoords = {
                x: slice.position.x,
                y: slice.position.y,
                z: slice.position.z
            };
           
            let targetCoords = {
                x: CUBE_CONFIG.WIDTH/2,
                y: -CUBE_CONFIG.HEIGHT/2,
                z: CUBE_CONFIG.WIDTH/2
            }

            let tween = new TWEEN.Tween(sourceCoords)
                                 .to(targetCoords, 1000)
                                 .delay(i*300)
                                 .easing(TWEEN.Easing.Cubic.InOut)
                                 .onUpdate(() => {
                                    slice.position.x = sourceCoords.x;
                                    slice.position.y = sourceCoords.y,
                                    slice.position.z = sourceCoords.z;
                                 }).onComplete(() => {
                                     this.showBottomLayer();
                                 })
                                 .start();
        });
    }

    /**
     * Transitions from whatever temporal encoding to ANI
     * TODO: Implement ANI
     */
    transitionANI(): void { 
        // call SI 
        // create an animation
        // loop through layers somehow
    }

    /**
     * Returns cube position in *world* coordinates
     */
    getCubePosition(): THREE.Vector3 {
        const positionInWorld = new THREE.Vector3();
        this.cubeGroupGL.getWorldPosition(positionInWorld);
        return positionInWorld;
    }

    /**
     * Iterates through all timeslices and all data points
     * Resets their position and color back to default
     */
    resetSelection(): void {
        this.cubeGroupGL.children.forEach((child: any) => {
            if(child.type !== 'Group') return;

            child.children.forEach((grandChild: any) => {
                if(grandChild.type !== 'DATA_POINT') return;

                grandChild.scale.set(1,1,1);
                grandChild.material.color.set(this.colors(grandChild.data.category_1));
            });
        });
    }

    /**
     * Onclick event handler for the geocube
     * @param $event event propagated from controller
     * @param tooltip tooltip item (ElementRef)
     * @param container canvas container (HTMLElement) used for calculating the raycasting
     */
    onClick($event: any, tooltip: ElementRef, container: HTMLElement): any {
        $event.preventDefault();
        this.resetSelection();
        this.mouse.x= (($event.clientX - container.offsetLeft)/container.clientWidth) * 2 - 1;
        this.mouse.y= -(($event.clientY - container.offsetTop)/container.clientHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        let intersections = this.raycaster.intersectObjects(this.cubeGroupGL.children, true);
        let guideLine = this.cubeGroupGL.getObjectByName('GUIDE_LINE');

        if(guideLine) {
            this.cubeGroupGL.remove(guideLine);
        }

        for(let i = 0; i < intersections.length; i++) {
            let selectedObject = intersections[i].object;
            if(selectedObject.type !== 'DATA_POINT') continue;
            // get first intersect that is a data point
            selectedObject.material.color.setHex(0xffff00);
            selectedObject.scale.set(2, 2, 2);
            tooltip.nativeElement.style.display = 'block';
            tooltip.nativeElement.style.opacity = '.9';
            tooltip.nativeElement.style.top = `${$event.pageY}px`;
            tooltip.nativeElement.style.left = `${$event.pageX}px`;
            tooltip.nativeElement.innerHTML = `
                                                <h2>${selectedObject.data.id}</h2>
                                                <p>${selectedObject.data.description}</p>
                                                <p>Photo taken on ${moment(selectedObject.data.date_time).format('DD/MM/YYYY')} @ ${selectedObject.data.location_name}</p>
                                              `;
            let lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
            let lineGeometry = new THREE.Geometry();
          
            lineGeometry.vertices.push(
                    new THREE.Vector3(
                        selectedObject.position.x + CUBE_CONFIG.WIDTH/2, 
                        this.findTimeSlice(selectedObject.data.date_time).position.y,
                        selectedObject.position.z + CUBE_CONFIG.WIDTH/2
                        )
                    ); 

            lineGeometry.vertices.push(
                new THREE.Vector3(
                    selectedObject.position.x + CUBE_CONFIG.WIDTH/2, 
                    -CUBE_CONFIG.WIDTH/2, 
                    selectedObject.position.z + CUBE_CONFIG.WIDTH/2
                    )
                ); 

            let line = new THREE.Line(lineGeometry, lineMaterial);
            line.name = 'GUIDE_LINE';
            this.cubeGroupGL.add(line);
            return selectedObject.data;
        }

        return null;
    }

    /**
     * Returns the corresponding timeslice to a given objects date (date_time property)
     * @param date Date object
     * @returns THREE.Group - the corresponding timeslice
     */
    findTimeSlice(date: Date): THREE.Group {
        let correspondingSlice;
        this.slices.forEach((slice: THREE.Group) => {
            if(slice.name === this.dm.getTimeQuantile(date)) {
                correspondingSlice = slice;
                return;
            }
        });
        return correspondingSlice;
    }

    /**
     * Double click event handler for the geocube
     * @param $event 
     */
    onDblClick($event: any): void {

    }

    /**
     * Shows the bottom layer of the geocube (map)
     */
    showBottomLayer(): void {
        document.getElementById('map_container').style.opacity = '1';
    }

    /**
     * Hides the bottom layer of the geocube (map)
     */
    hideBottomLayer(): void {
        document.getElementById('map_container').style.opacity = '0';
    }
}
