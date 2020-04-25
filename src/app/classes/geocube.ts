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
    private slices: Array<THREE.Group>;
    private colors: any; //D3.Scale<string, string>;
    private timeLinearScale: D3.ScaleLinear<number, number>;

    private hiddenLabels: Array<THREE.CSS3DObject>;
    private hiddenMapImages: Array<THREE.CSS3DObject>;

    private map: mapboxgl.Map;
    private mapBounds: mapboxgl.LngLatBounds;
    private mapCenter: { lat: number, lng: number };

    private _jitter: number = 0;
    private colorCoding: string = 'categorical';

    private _cubeToggle: boolean = true;

    get cubeToggle(): boolean {
        return this._cubeToggle;
    }
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
        
        this.hiddenLabels = new Array<THREE.CSS3DObject>();
        this.hiddenMapImages = new Array<THREE.CSS3DObject>();

        this.setMap = new Set<string>();
        this.mapBounds = new mapboxgl.LngLatBounds();
        this.camera = camera;
        
        // https://stackoverflow.com/questions/44332290/mapbox-gl-typing-wont-allow-accesstoken-assignment
        (mapboxgl as typeof mapboxgl).accessToken = environment.MAPBOX_KEY;
        
        this.createObjects();
        this.assembleData();
        this.render();
    }

    hideCube(): void {
        this.webGLScene.remove(this.webGLScene.getObjectByName('GEO_CUBE'));
        this.cssScene.remove(this.cssScene.getObjectByName('GEO_CUBE_CSS'));
        this.hideBottomLayer();
        this.hideLabels();
        this.hideMapImages();
    }

    showMapImages(): void {
        this.hiddenLabels.forEach((image: THREE.CSS3DObject) => { this.cubeGroupCSS.add(image); });

        this.hiddenLabels = new Array<THREE.CSS3DObject>();
    }

    hideMapImages(): void {
        this.cubeGroupCSS.traverse((object: THREE.CSS3DObject) => {
            if(object.name.includes('MAP_CONTAINER')) this.hiddenMapImages.push(object);
        });
        
        // black voodooo magic.
        let mapImages = D3.selectAll('.map-object');
        mapImages.remove();

        this.hiddenLabels.forEach((image: THREE.CSS3DObject) => { this.cubeGroupCSS.remove(image); });
    }

    updateSlices(): void {
        this.slices.forEach((slice: THREE.Group) => { this.cubeGroupGL.remove(slice); });
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
            label.name = `GEO_LABEL_${i}`;
            // label.rotation.set(Math.PI);
            this.cubeGroupCSS.add(label);
        }

        this.slices.forEach((slice: THREE.Group) => { this.cubeGroupGL.add(slice); });
    }

    updateDataPoints(): void {
        // TODO: clear previous geometries from scene / cubeGroupGL
        let geometry = new THREE.SphereGeometry(CUBE_CONFIG.NODE_SIZE, 32, 32);

        for (let i = 0; i < this.dm.data.length; i++) {
            let dataItem = this.dm.data[i];
            let material = new THREE.MeshBasicMaterial({ color: this.colors(dataItem.category_1) });

            let cubeCoords = this.map.project(new mapboxgl.LngLat(dataItem.longitude, dataItem.latitude));
            let point = new THREE.Mesh(geometry, material);

            // need to offset the x,z coordinate so they overlap with cube
            point.position.x = cubeCoords.x - CUBE_CONFIG.WIDTH/2;
            // sphere.position.y = correspondingSlice.position.y; -- y coordinate is inherited from the slice positioning
            point.position.z = cubeCoords.y - CUBE_CONFIG.HEIGHT/2;
            point.name = dataItem.id;
            point.data = dataItem;
            point.type = 'DATA_POINT';
            this.findTimeSlice(dataItem.date_time).add(point);
        }
    }

    clearLabels(): void {
        let removed = new Array<THREE.CSS3DObject>();
        this.cubeGroupCSS.children.forEach((child: THREE.CSS3DObject) => {
            if(child.name.includes('LABEL')) removed.push(child);
        });
        removed.forEach((r: THREE.CSS3DObject) => this.cubeGroupCSS.remove(r) );
    }

    hideLabels(): void {
        this.cubeGroupCSS.traverse((object: THREE.Object3D) => {
            if (object.name.includes('GEO_LABEL')) {
                this.hiddenLabels.push(object);
            }
        });
        this.hiddenLabels.forEach((r: THREE.CSS3DObject) => {
            this.cubeGroupCSS.remove(r);
        });
    }

    showLabels(): void {
        this.hiddenLabels.forEach((object: THREE.CSS3DObject) => {
            this.cubeGroupCSS.add(object);
        });

        this.hiddenLabels = new Array<THREE.CSS3DObject>();
    }

    /**
     * Initialize all group objects 
     */
    createObjects(): void {
        this.cubeGroupGL = new THREE.Group();
        this.cubeGroupCSS = new THREE.Group();
        this.colors = this.dm.colors;
        this.timeLinearScale = this.dm.getTimeLinearScale();
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

            slice.position.set(CUBE_CONFIG.WIDTH/2, this.timeLinearScale(moment(`${slice.name}`).toDate()), CUBE_CONFIG.WIDTH/2);
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
            label.position.set(-20, this.timeLinearScale(moment(`${slice.name}`).toDate()), CUBE_CONFIG.WIDTH/2);
            label.name = `GEO_LABEL_${i}`;
            // label.rotation.set(Math.PI);
            this.cubeGroupCSS.add(label);
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

    get jitter(): number {
        return this._jitter;
    }

    set jitter(jitter: number) {
        this._jitter = jitter;
    }

    /**
     * Creates the visual objects and organizes them after data has been loaded
     */
    assembleData(): void {
        this.dm.data.forEach((d: any) => { this.setMap.add(d.category_1); });
        this.cubeGroupCSS.add(this.createMap());
        // this.timeLinearScale(some_date) gives us the vertical axis coordinate of the point
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
            // TODO: Consider adding an outline to the data points - makes them easier to separate 
            // https://stemkoski.github.io/Three.js/Outline.html 
            let geometry = new THREE.SphereGeometry(CUBE_CONFIG.NODE_SIZE, 32, 32);

            for (let i = 0; i < this.dm.data.length; i++) {
                let dataItem = this.dm.data[i];
                let material = new THREE.MeshBasicMaterial({ color: this.colors(dataItem.category_1) });

                let cubeCoords = this.map.project(new mapboxgl.LngLat(dataItem.longitude, dataItem.latitude));
                let point = new THREE.Mesh(geometry, material);

                // need to offset the x,z coordinate so they overlap with cube
                point.position.x = cubeCoords.x - CUBE_CONFIG.WIDTH/2;
                // sphere.position.y = correspondingSlice.position.y; -- y coordinate is inherited from the slice positioning
                point.position.z = cubeCoords.y - CUBE_CONFIG.HEIGHT/2;
                point.name = dataItem.id;
                point.data = dataItem;
                point.type = 'DATA_POINT';
                this.findTimeSlice(dataItem.date_time).add(point);
            }

            // for default settings (TODO: move to a better)
            this.updateTime('absolute');
            this.updateJitter(5);
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
            style: 'mapbox://styles/velitchko/cjx1tktdx18jt1cpv3sc35l0w',
            zoom: 13,
            center: this.mapCenter ? [this.mapCenter.lng, this.mapCenter.lat] : [0, 0],
            preserveDrawingBuffer: true // needed to use map.getCanvas().toDataURL();
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

    updateTime(time: string): void {
        this.cubeGroupGL.children.forEach((child: THREE.Group) => {
            if(child.type !== 'Group') return;
            child.children.forEach((grandChild: any) => {
                if(grandChild.type !== 'DATA_POINT') return;
                let sliceOffsetY = child.position.y;
                // console.log(sliceOffsetY);
                // console.log(grandChild.data.date_time, this.timeLinearScale(grandChild.data.date_time))
                grandChild.position.y = time === 'aggregated' ?  0 : this.timeLinearScale(grandChild.data.date_time) - sliceOffsetY;
            });
        });
    }

    /**
     * Updates current view (from controller)
     * @param currentViewState 
     */
    updateView(currentViewState: VIEW_STATES): void {
        if (this._cubeToggle) {
            this.webGLScene.add(this.cubeGroupGL);
            this.cssScene.add(this.cubeGroupCSS);
            this.showLabels();
            this.showBottomLayer();
            this.showMapImages();
        }
    }
    
    toggleDisplayCube(): void {
        this._cubeToggle = !this._cubeToggle;
    }

    updateColorCoding(encoding: string): void {
        this.colorCoding = encoding;
        switch(encoding) {
            case 'categorical' : 
                this.colors = this.dm.colors; //D3.scaleOrdinal(D3.schemePaired);
                break;
            case 'temporal' :
                this.colors = D3.scaleSequential(D3.interpolateViridis).domain([this.dm.getMinDate(), this.dm.getMaxDate()]);
                break;
            case 'monochrome' :
                this.colors = D3.scaleOrdinal(D3.schemeSet2);
                break;

            default:
                this.colors = this.dm.colors; //D3.scaleOrdinal(D3.schemePaired);
                break;
        }
    }

    updateJitter(jitter: number): void {
        this.jitter = jitter;

        this.jitterPoint();
    }

    updateNumSlices(): void {
        // TODO: Fix labels (remove and remake) -> would make it more fluid and less laggy (high effort)
        // TODO: instead of recreating eveverything try to update the items and transition? (low prio)
        // FIXME: D3 doesnt follow the user selection but returns the best way to split data
        this.timeLinearScale = this.dm.getTimeLinearScale();
        this.clearLabels();
        this.updateSlices();
        this.updateDataPoints();
    }

    updateNodeColor(encoding: string): void {
        this.updateColorCoding(encoding);
        this.cubeGroupGL.children.forEach((child: THREE.Group) => {
            if(child.type !== 'Group') return;

            child.children.forEach((grandChild: any) => {
                if(grandChild.type !== 'DATA_POINT') return;
                switch(encoding) {
                    case 'categorical' : 
                        grandChild.material.color.set(this.colors(grandChild.data.category_1));
                        break;
                    case 'temporal' :
                        grandChild.material.color.set(this.colors(grandChild.data.date_time));
                        break;
                    case 'monochrome' : 
                        grandChild.material.color.set('#cc1414');
                        break;
                    default: 
                        grandChild.material.color.set(this.colors(grandChild.data.category_1));
                        break;
                }
                                    
            });
        });
    }

    updateNodeSize(radius: number): void {
        let scale = 1 + radius * 0.1;

        let targetScale = {
            x: scale,
            y: scale,
            z: scale
        };

        this.cubeGroupGL.children.forEach((child: THREE.Group) => {
            if(child.type !== 'Group') return;

            child.children.forEach((grandChild: any) => {
                if(grandChild.type !== 'DATA_POINT') return;
              
                let sourceScale = {
                    x: grandChild.scale.x,
                    y: grandChild.scale.y,
                    z: grandChild.scale.z,
                };

                let tween = new TWEEN.Tween(sourceScale)
                                    .to(targetScale, 250)
                                    .easing(TWEEN.Easing.Cubic.InOut)
                                    .onUpdate(() => {
                                        grandChild.scale.x = sourceScale.x;
                                        grandChild.scale.y = sourceScale.y;
                                        grandChild.scale.z = sourceScale.z;
                                    })
                                    .start();
            });
        });
    }

    /**
     * Should be called when data has changed from the datamanager
     * Should reinitialize whole cube
     */
    updateData(): void {
        this.clearLabels();
        this.updateSlices();
        this.updateDataPoints();
    }

    dateWithinInterval(startDate: Date, endDate: Date, pointDate: Date): boolean {
        return moment(pointDate) >= moment(startDate) && moment(pointDate) <= moment(endDate);
    }

    getRandomInteger(min: number, max: number): number {
        return Math.floor((Math.random() * (max - min + 1)) + min);
    }

    jitterPoint(): void {
        this.cubeGroupGL.children.forEach((child: THREE.Group) => {
            if(child.type !== 'Group') return;

            child.children.forEach((grandChild: any) => {
                if(grandChild.type !== 'DATA_POINT') return;

                let xJitter = this.getRandomInteger(-1*this._jitter, this._jitter);
                let zJitter = this.getRandomInteger(-1*this._jitter, this._jitter);

                let sourceCoords = {
                    x: grandChild.originalCoordinates ? grandChild.originalCoordinates.x : grandChild.position.x,
                    y: grandChild.originalCoordinates ? grandChild.originalCoordinates.y : grandChild.position.y,
                    z: grandChild.originalCoordinates ? grandChild.originalCoordinates.z : grandChild.position.z
                };

                let targetCoords = {
                    x: grandChild.originalCoordinates ? grandChild.originalCoordinates.x + xJitter : grandChild.position.x + xJitter,
                    y: grandChild.originalCoordinates ? grandChild.originalCoordinates.y : grandChild.position.y,
                    z: grandChild.originalCoordinates ? grandChild.originalCoordinates.z + zJitter : grandChild.position.z + zJitter,
                }

                if(!grandChild.originalCoordinates) grandChild.originalCoordinates = new THREE.Vector3(sourceCoords.x, sourceCoords.y, sourceCoords.z);

                let tween = new TWEEN.Tween(sourceCoords)
                                    .to(targetCoords, 250)
                                    .easing(TWEEN.Easing.Cubic.InOut)
                                    .onUpdate(() => {
                                       grandChild.position.x = sourceCoords.x;
                                       grandChild.position.y = sourceCoords.y,
                                       grandChild.position.z = sourceCoords.z;
                                    })
                                    .start();
                                    
            });
        });
    }

    filterData(cat: string, start: Date, end: Date): void {
        this.cubeGroupGL.children.forEach((child: THREE.Group) => {
            if(child.type !== 'Group') return;

            child.children.forEach((grandChild: any) => {
                if(grandChild.type !== 'DATA_POINT') return;
                grandChild.visible = true;
                if(!(this.dateWithinInterval(start, end, grandChild.data.date_time) && (cat === "" ?  true : grandChild.data.category_1 === cat))) {
                    grandChild.visible = false;
                }
            });
        });
    }

    /**
     * Transitions from whatever temporal encoding to STC
     */
    transitionSTC(): void { 
        if(!this._cubeToggle) return;
        let vertOffset = CUBE_CONFIG.HEIGHT/this.dm.timeRange.length;
        this.boundingBox.visible = true;
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
            };

            let label = this.cubeGroupCSS.getObjectByName(`GEO_LABEL_${i}`);
            D3.selectAll('.time-slice-label').style('opacity', '1');
            label.position.x = targetCoords.x - CUBE_CONFIG.WIDTH/2 - 22;
            label.position.y = targetCoords.y;
            label.position.z = targetCoords.z;
            label.rotation.set(0, 0, 0);
            // label.position.set(-20, (i*vertOffset) - (CUBE_CONFIG.WIDTH/2), CUBE_CONFIG.WIDTH/2);
            
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
                                    if(mapClone) {
                                        this.cubeGroupCSS.remove(mapClone);
                                        mapClone.visible = false;
                                    }
                                    this.showBottomLayer();
                                 })
                                 .start();
        });
    }

    /**
     * Transitions from whatever temporal encoding to JP
     */
    transitionJP(): void {
        this.hideBottomLayer();
        if(!this._cubeToggle) return;
        let vertOffset = CUBE_CONFIG.HEIGHT + 20;
        let mapPic = this.map.getCanvas().toDataURL();
        let mapElem = document.createElement('img');
        
        this.boundingBox.visible = false;
        
        mapElem.className = 'map-object';
        mapElem.style.width = CUBE_CONFIG.WIDTH + 'px';
        mapElem.style.height = CUBE_CONFIG.WIDTH + 'px';
        mapElem.src = mapPic;
       

        this.slices.forEach((slice: THREE.Group, i: number) => {
            let mapClone = new THREE.CSS3DObject(mapElem.cloneNode());
            mapClone.name = `MAP_CONTAINER_${i}`;
            mapClone.position.set(new THREE.Vector3(slice.position.x, slice.position.y, slice.position.z));
            mapClone.rotation.set(-Math.PI/2, 0, 0);
            
            let sourceCoords = {
                x: slice.position.x,
                y: slice.position.y,
                z: slice.position.z
            };
           
            let targetCoords = {
                x: slice.position.x,
                y: -CUBE_CONFIG.HEIGHT/2,
                z: (i*vertOffset) - (CUBE_CONFIG.WIDTH/2)
            };

            let label = this.cubeGroupCSS.getObjectByName(`GEO_LABEL_${i}`);
            D3.selectAll('.time-slice-label').style('opacity', '1');
            label.position.x = targetCoords.x - CUBE_CONFIG.WIDTH/2 - 22;
            label.position.y = targetCoords.y;
            label.position.z = targetCoords.z;
            label.rotation.set(-Math.PI/2, 0, 0);

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
                                 }).onComplete(() => {
                                    this.cubeGroupCSS.add(mapClone);
                                 })
                                 .start();
        });
    }

    /**
     * Transitions from whatever temporal encoding to SI
     */
    transitionSI(): void { 
        if(!this._cubeToggle) return;
        this.boundingBox.visible = false;

        this.slices.forEach((slice: THREE.Group, i: number) => {
            let mapClone = this.cubeGroupCSS.getObjectByName(`MAP_CONTAINER_${i}`);

            let sourceCoords = {
                x: slice.position.x,
                y: slice.position.y,
                z: slice.position.z
            };
           
            let targetCoords = {
                x: CUBE_CONFIG.WIDTH/2,
                y: -CUBE_CONFIG.HEIGHT/2,
                z: CUBE_CONFIG.WIDTH/2
            };

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
                                        mapClone.position.y = sourceCoords.y,
                                        mapClone.position.z = sourceCoords.z;
                                    }
                                 })
                                 .onComplete(() => {
                                    if(mapClone) {
                                        mapClone.visible = false;
                                        this.cubeGroupCSS.remove(mapClone);
                                    }
                                    
                                    D3.selectAll('.time-slice-label').style('opacity', '0');
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

    getCurrentColor(object: THREE.Object3D): string {
        switch(this.colorCoding)  {
            case 'categorical': return this.colors(object.data.category_1);
            case 'temporal' : return this.colors(object.data.date_time);
            case 'monochrome' : return '#cc1414';
            default: return this.colors(object.data.category_1)
        }
    }

    resetCategorySelection(gray: boolean = false): void {
        this.cubeGroupGL.children.forEach((child: any) => {
            if(child.type !== 'Group') return;

            child.children.forEach((grandChild: any) => {
                if(grandChild.type !== 'DATA_POINT') return;
                grandChild.visible = true;
            });
        });
    }

    /**
     * Iterates through all timeslices and all data points
     * Resets their position and color back to default
     */
    resetSelection(gray: boolean = false): void {
        this.cubeGroupGL.children.forEach((child: any) => {
            if(child.type !== 'Group') return;

            child.children.forEach((grandChild: any) => {
                if(grandChild.type !== 'DATA_POINT') return;
                grandChild.scale.set(1,1,1);
                grandChild.material.color.set(gray ? '#b5b5b5' : this.getCurrentColor(grandChild));
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
        
        this.mouse.x= (($event.clientX - container.offsetLeft)/container.clientWidth) * 2 - 1;
        this.mouse.y= -(($event.clientY - container.offsetTop)/container.clientHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        let intersections = this.raycaster.intersectObjects(this.cubeGroupGL.children, true);
        
        for(let i = 0; i < intersections.length; i++) {
            let selectedObject = intersections[i].object;
            if(selectedObject.type !== 'DATA_POINT') continue;
            // got intersect 
            // setup tootlip and return object
            // tooltip.nativeElement.style.display = 'block';
            // tooltip.nativeElement.style.opacity = '.9';
            // tooltip.nativeElement.style.top = `${$event.pageY}px`;
            // tooltip.nativeElement.style.left = `${$event.pageX}px`;
            // tooltip.nativeElement.innerHTML = `
            //                                     <h2>${selectedObject.data.id}</h2>
            //                                     <p>${selectedObject.data.description}</p>
            //                                     <p>Photo taken on ${moment(selectedObject.data.date_time).format('DD/MM/YYYY')} @ ${selectedObject.data.location_name}</p>
            //                                   `;
          
            return selectedObject.data;
        }
        this.clearGuideline();
        this.resetSelection();
        return null;
    }

    clearGuideline(): void {
        let guideLine = this.cubeGroupGL.getObjectByName('GUIDE_LINE');
        let guidePoint = this.cubeGroupGL.getObjectByName('GUIDE_POINT');

        if(guideLine) this.cubeGroupGL.remove(guideLine);
        if(guidePoint) this.cubeGroupGL.remove(guidePoint);
    }

    
    highlightObject(id: string): void {
        this.clearGuideline();
        this.resetSelection(true);
        let highlighted = this.cubeGroupGL.getObjectByName(id);

        if(highlighted) {
            highlighted.material.color.setHex(0xff0000);
            highlighted.scale.set(2, 2, 2);

            let lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
            let lineGeometry = new THREE.Geometry();
          
            lineGeometry.vertices.push(
                    new THREE.Vector3(
                        highlighted.position.x + CUBE_CONFIG.WIDTH/2, 
                        this.findTimeSlice(highlighted.data.date_time).position.y,
                        highlighted.position.z + CUBE_CONFIG.WIDTH/2
                        )
                    ); 

            lineGeometry.vertices.push(
                new THREE.Vector3(
                    highlighted.position.x + CUBE_CONFIG.WIDTH/2, 
                    -CUBE_CONFIG.WIDTH/2, 
                    highlighted.position.z + CUBE_CONFIG.WIDTH/2
                    )
                ); 

            let line = new THREE.Line(lineGeometry, lineMaterial);
            line.name = 'GUIDE_LINE';
          
            let pointGeometry = new THREE.SphereGeometry(CUBE_CONFIG.NODE_SIZE, 32, 32);
            let pointMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            let point = new THREE.Mesh(pointGeometry, pointMaterial);

            point.position.set(highlighted.position.x + CUBE_CONFIG.WIDTH/2, -CUBE_CONFIG.WIDTH/2, highlighted.position.z + CUBE_CONFIG.WIDTH/2)
            point.name = 'GUIDE_POINT';

            this.cubeGroupGL.add(line);
            this.cubeGroupGL.add(point);
        }
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
        let bottomLayer = document.getElementById('map_container');
        if(bottomLayer) bottomLayer.style.opacity = '1';
    }

    /**
     * Hides the bottom layer of the geocube (map)
     */
    hideBottomLayer(): void {
        let bottomLayer = document.getElementById('map_container');
        if(bottomLayer) bottomLayer.style.opacity = '0';
    }
}
