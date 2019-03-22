import { PolyCube } from './polycube.interface';
import { DataManager } from './datamanager';
import * as THREE from 'three-full';
import { VIEW_STATES } from './viewStates';
import { CUBE_CONFIG } from '../cube.config';
import { ElementRef } from '@angular/core';
import * as TWEEN from '@tweenjs/tween.js';
import * as D3 from 'd3';
import * as moment from 'moment';

export class NetCube implements PolyCube {
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
    private links: THREE.Group;

    private cubeLeftBoarder: number;

    constructor(dm: DataManager, camera: THREE.Camera, webGLScene: THREE.Scene, cssScene?: THREE.Scene) {
        this.dm = dm;
        this.webGLScene = webGLScene;
        if (cssScene) this.cssScene = cssScene;
        this.setMap = new Set<string>();
        this.camera = camera;
        this.cubeLeftBoarder = (CUBE_CONFIG.WIDTH + CUBE_CONFIG.GUTTER) * 2;
        this.createObjects();
        this.assembleData();
        this.render();
    }

    createObjects(): void {
        this.cubeGroupGL = new THREE.Group();
        this.cubeGroupCSS = new THREE.Group();
        this.colors = D3.scaleOrdinal(D3.schemePaired);

        this.createSlices();

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.createBoundingBox();
    }

    assembleData(): void {
        this.dm.data.forEach((d: any) => { this.setMap.add(d.category_1); });

        // this.timeLinearScale(some_date) gives us the vertical axis coordinate of the point
        this.timeLinearScale = this.dm.getTimeLinearScale();

        this.createNodes();
        this.createLinks();
    }

    render(): void {
        // group holding all webGl objects
        this.cubeGroupGL.name = 'NET_CUBE';
        this.cubeGroupGL.position.set(this.cubeLeftBoarder, 0, 0);
        this.webGLScene.add(this.cubeGroupGL);
        // group holding all css objects
        this.cubeGroupCSS.name = 'NET_CUBE_CSS';
        this.cubeGroupCSS.position.set(this.cubeLeftBoarder, 0, 0);
        this.cssScene.add(this.cubeGroupCSS); // add group to css scene
    }

    update(currentViewState: VIEW_STATES): void {
        if (currentViewState.valueOf() === VIEW_STATES.NET_CUBE || currentViewState.valueOf() === VIEW_STATES.POLY_CUBE) {
            this.webGLScene.add(this.cubeGroupGL);
            this.cssScene.add(this.cubeGroupCSS);
            this.showBottomLayer();
        }
    }

    updateData(): void {

    }

    dateWithinInterval(startDate: Date, endDate: Date, pointDate: Date): boolean {
        return moment(pointDate) >= moment(startDate) && moment(pointDate) <= moment(endDate);
    }



    filterData(startDate: Date, endDate: Date): void {
        this.cubeGroupGL.children.forEach((child: THREE.Group) => {
            if(child.type !== 'Group') return;

            child.children.forEach((grandChild: any) => {
                if(grandChild.type !== 'DATA_POINT') return;
                grandChild.visible = true;
                if(!this.dateWithinInterval(startDate, endDate, grandChild.data.date_time)) grandChild.visible = false;
            });
        })
    }



    /**
     * Transitions from whatever temporal encoding to STC
     */
    transitionSTC(): void {
        this.showLinks();
        let vertOffset = CUBE_CONFIG.HEIGHT / this.dm.timeRange.length;
        this.boundingBox.visible = true;
        this.slices.forEach((slice: THREE.Group, i: number) => {
            //slice.position.set(CUBE_CONFIG.WIDTH/2, (i*vertOffset) - (CUBE_CONFIG.WIDTH/2), CUBE_CONFIG.WIDTH/2);
            let sourceCoords = {
                x: slice.position.x,
                y: slice.position.y,
                z: slice.position.z
            };

            let targetCoords = {
                x: CUBE_CONFIG.WIDTH / 2,
                y: (i * vertOffset) - (CUBE_CONFIG.WIDTH / 2),
                z: CUBE_CONFIG.WIDTH / 2
            };

            let tween = new TWEEN.Tween(sourceCoords)
                .to(targetCoords, 1000)
                .delay(i * 300)
                .easing(TWEEN.Easing.Cubic.InOut)
                .onUpdate(() => {
                    slice.position.x = sourceCoords.x;
                    slice.position.y = sourceCoords.y,
                    slice.position.z = sourceCoords.z;
                })
                .onComplete(() => {
                    //something if needed
                })
                .start();
        });//end forEach
    }

    /**
     * Transitions from whatever temporal encoding to JP
     */
    transitionJP(): void {
        this.hideLinks();
        let vertOffset = CUBE_CONFIG.HEIGHT + 20;
        this.boundingBox.visible = false;
        this.slices.forEach((slice: THREE.Group, i: number) => {
            //slice.position.z = (i*vertOffset) - (CUBE_CONFIG.WIDTH/2);
            //slice.position.y = 0;
            let sourceCoords = {
                x: slice.position.x,
                y: slice.position.y,
                z: slice.position.z
            };

            let targetCoords = {
                x: slice.position.x,
                y: -CUBE_CONFIG.HEIGHT / 2,
                z: (i * vertOffset) - (CUBE_CONFIG.WIDTH / 2)
            };

            let tween = new TWEEN.Tween(sourceCoords)
                .to(targetCoords, 1000)
                .delay(i * 300)
                .easing(TWEEN.Easing.Cubic.InOut)
                .onUpdate(() => {
                    slice.position.x = sourceCoords.x;
                    slice.position.y = sourceCoords.y,
                        slice.position.z = sourceCoords.z;
                })
                .start();

        });

    }

    transitionSI(): void {
        this.hideLinks();
        this.boundingBox.visible = false;
        this.slices.forEach((slice: THREE.Group, i: number) => {
            let sourceCoords = {
                x: slice.position.x,
                y: slice.position.y,
                z: slice.position.z
            };

            let targetCoords = {
                x: CUBE_CONFIG.WIDTH / 2,
                y: -CUBE_CONFIG.HEIGHT / 2,
                z: CUBE_CONFIG.WIDTH / 2
            };

            let tween = new TWEEN.Tween(sourceCoords)
                .to(targetCoords, 1000)
                .delay(i * 300)
                .easing(TWEEN.Easing.Cubic.InOut)
                .onUpdate(() => {
                    slice.position.x = sourceCoords.x;
                    slice.position.y = sourceCoords.y,
                        slice.position.z = sourceCoords.z;
                })
                .start();
        });

    }

    transitionANI(): void { }


    getCubePosition(): THREE.Vector3 {
        let positionInWorld = new THREE.Vector3();
        this.cubeGroupGL.getWorldPosition(positionInWorld);
        return positionInWorld;
    }

    /**
    * Iterates through all timeslices and all data points
    * Resets their position and color back to default
    */
    resetSelection(gray: boolean = false): void {
        this.cubeGroupGL.children.forEach((child: any) => {
            if (child.type !== 'Group') return;

            child.children.forEach((grandChild: any) => {
                if (grandChild.type !== 'DATA_POINT') return;

                grandChild.scale.set(1, 1, 1);
                grandChild.material.color.set(gray ? '#b5b5b5' : this.colors(grandChild.data.category_1));
            });
        });
    }


    onClick($event: any, tooltip: ElementRef, container: HTMLElement): any {
        $event.preventDefault();
        
        this.mouse.x = (($event.clientX - container.offsetLeft) / container.clientWidth) * 2 - 1;
        this.mouse.y = -(($event.clientY - container.offsetTop) / container.clientHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        let intersections = this.raycaster.intersectObjects(this.cubeGroupGL.children, true);

        for (let i = 0; i < intersections.length; i++) {
            let selectedObject = intersections[i].object;
            if (selectedObject.type !== 'DATA_POINT') continue;
            // get first intersect that is a data point
            tooltip.nativeElement.style.display = 'block';
            tooltip.nativeElement.style.opacity = '.9';
            tooltip.nativeElement.style.top = `${$event.pageY}px`;
            tooltip.nativeElement.style.left = `${$event.pageX}px`;
            tooltip.nativeElement.innerHTML = selectedObject.data.description;

            return selectedObject.data;
        }
        this.resetSelection();
        return null;
    }

    // TODO: Should highlight the point consider passing the id of the point or something instead of the 
    // object, because the object is not unique across multiple cubes
    highlightObject(id: string): void {
        this.resetSelection(true);

        let highlighted = this.cubeGroupGL.getObjectByName(id);

        if(highlighted) {
            highlighted.material.color.setHex(0xff0000);
            highlighted.scale.set(2, 2, 2);
        }
    }

    /**
     * Returns the corresponding timeslice to a given objects date (date_time property)
     * @param date Date object
     */
    findTimeSlice(date: Date): THREE.Group {
        let correspondingSlice;
        this.slices.forEach((slice: THREE.Group) => {
            if (slice.name === this.dm.getTimeQuantile(date)) {
                correspondingSlice = slice;
                return;
            }
        });
        return correspondingSlice;
    }

    onDblClick($event: any): void {

    }

    getNormalizedPositionById(id) {
        let pos_map = this.dm.getForcedDirectedCushmanPositionMap();
        let pos_dim = this.dm.getDataPositionDimensions();

        let normalized_x = null;
        let normalized_z = null;
        if (pos_map[id]) {
            normalized_x = pos_map[id].x * CUBE_CONFIG.WIDTH / Math.abs(pos_dim.max_x - pos_dim.min_x);
            normalized_z = pos_map[id].y * CUBE_CONFIG.WIDTH / Math.abs(pos_dim.max_y - pos_dim.min_y);
        }

        if (normalized_x) return { x: normalized_x, y: null, z: normalized_z };
        else return null;
    }


    createNodes(): void {
        let geometry = new THREE.SphereGeometry(CUBE_CONFIG.NODE_SIZE, 32, 32);

        for (let i = 0; i < this.dm.data.length; i++) {
            let dataItem = this.dm.data[i];
            // TODO: consider just updating color property of material if you ever find out how to do it
            let material = new THREE.MeshBasicMaterial({ color: this.colors(dataItem.category_1) });

            let sphere = new THREE.Mesh(geometry, material);

            let position = this.getNormalizedPositionById(dataItem.id);
            if (position) {
                sphere.position.x = position.x;
                sphere.position.z = position.z;
                //sphere.position.y = this.timeLinearScale(dataItem.date_time);
                sphere.name = dataItem.id;
                sphere.data = dataItem;
                sphere.type = 'DATA_POINT';

                //console.log(this.findTimeSlice(dataItem.date_time));
                this.findTimeSlice(dataItem.date_time).add(sphere);
            }//end if            
        }//end for
    }

    createLinks(): void {
        this.links = new THREE.Group();
        let lineMaterial = new THREE.LineBasicMaterial({ color: '#b5b5b5', transparent: true, opacity: 0.75 });
        let linksPerNode = 1;

        for (let i = 0; i < this.dm.data.length; i++) {
            let dataItem = this.dm.data[i];
            let sourceNode_position = this.getNormalizedPositionById(dataItem.id);
            sourceNode_position.y = this.findTimeSlice(dataItem.date_time).position.y;

            for (let a = 0; a < linksPerNode; a++) {//3 links for each nodes
                let lineGeometry = new THREE.Geometry();
                let targetId = dataItem.target_nodes[a];
                let targetNode_position = this.getNormalizedPositionById(targetId);

                if (targetNode_position) {
                    let position_fix = CUBE_CONFIG.WIDTH / 2;
                    targetNode_position.y = this.findTimeSlice(this.dm.dataMap[targetId].date_time).position.y;
                    lineGeometry.vertices.push(
                        new THREE.Vector3(
                            sourceNode_position.x + position_fix,
                            sourceNode_position.y,
                            sourceNode_position.z + position_fix
                        )
                    );
                    lineGeometry.vertices.push(
                        new THREE.Vector3(
                            targetNode_position.x + position_fix,
                            targetNode_position.y,
                            targetNode_position.z + position_fix
                        )
                    );
                    let line = new THREE.Line(lineGeometry, lineMaterial);
                    line.name = dataItem.id + "_" + targetId;
                    this.links.add(line);
                }//end if
            }//end for     
        }//end for

        this.cubeGroupGL.add(this.links);

    }

    createSlices(): void {
        this.slices = new Array<THREE.Group>();
        let vertOffset = CUBE_CONFIG.WIDTH / this.dm.timeRange.length;
        for (let i = 0; i < this.dm.timeRange.length; i++) {
            // TIME SLICES
            let slice = new THREE.Group();

            // name set to year -> we can now map objects to certain layers by checking their
            // this.dm.getTimeQuantile(date) and the slices name.
            slice.name = this.dm.timeRange[i].getFullYear();

            let geometry = new THREE.PlaneGeometry(CUBE_CONFIG.WIDTH, CUBE_CONFIG.HEIGHT, 32);
            let edgeGeometry = new THREE.EdgesGeometry(geometry);
            let material = new THREE.LineBasicMaterial({ color: 0x000000 });
            let plane = new THREE.LineSegments(edgeGeometry, material);


            slice.position.set(CUBE_CONFIG.WIDTH / 2, (i * vertOffset) - (CUBE_CONFIG.WIDTH / 2), CUBE_CONFIG.WIDTH / 2);
            plane.position.set(0, 0, 0);
            plane.rotation.set(Math.PI / 2, 0, 0);
            slice.add(plane);
            //slice.yPos = (i*vertOffset) - (CUBE_CONFIG.WIDTH/2);
            this.slices.push(slice);

            // CSS 3D TIME SLICE LABELS
            // let element = document.createElement('div');
            // element.innerHTML = slice.name;
            // element.className = 'time-slice-label';

            // //CSS Object
            // let label = new THREE.CSS3DObject(element);
            // label.position.set(-20, (i*vertOffset) - (CUBE_CONFIG.WIDTH/2), CUBE_CONFIG.WIDTH/2);
            // // label.rotation.set(Math.PI);
            // this.cssScene.add(label);
        }
    }

    createBoundingBox() {
        let placeholderBox = new THREE.Mesh(
            new THREE.BoxGeometry(CUBE_CONFIG.WIDTH, CUBE_CONFIG.WIDTH, CUBE_CONFIG.WIDTH),
            new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        );
        placeholderBox.position.set(CUBE_CONFIG.WIDTH / 2, 0, CUBE_CONFIG.WIDTH / 2);
        this.boundingBox = new THREE.BoxHelper(placeholderBox, '#b5b5b5');
        this.boundingBox.name = 'BOX_HELPER';
        this.cubeGroupGL.add(this.boundingBox);
        this.slices.forEach((slice: THREE.Group) => { this.cubeGroupGL.add(slice); });
    }

    //saving useful scripts for future usage
    parsingCushmanPositionData() {
        // let new_temp_data = [];
        // for(let i = 0; i < this.dm.data.length; i++) {
        //     let d = this.dm.data[i];
        //     let obj = {id: d.id, target: d.target_nodes.slice(0, 5)}
        //     new_temp_data.push(obj);
        // }
        // console.log(new_temp_data);

        // let nodes = [];
        // let links = [];
        // for(let i = 0; i < this.dm.data.length; i++) {
        //     let d = this.dm.data[i];
        //     let node = {id: ""+d.id, group: 1}
        //     nodes.push(node);

        //     for(let a = 0; a < 3; a++) {
        //         links.push({source: ""+d.id, target: ""+d.target_nodes[a], value:1})                
        //     }

        // }//end for


        // let new_cushman_position = [];
        // //console.log(cushman_positions);
        // cushman_positions.forEach((d:any)=>{
        //     new_cushman_position.push({id:d.textContent, x: d.__data__.x, y: d.__data__.y});
        // });
        // console.log(new_cushman_position);

        // let nodes4 = [];
        // $$( "circle" ).forEach(e=>{
        //         nodes4.push({id:e.textContent, x:e.__data__.x, y:e.__data__.y})
        //     }
        // )
        // console.log(nodes4);
    }

    showBottomLayer(): void { }

    hideBottomLayer(): void { }

    showLinks(): void {
        this.links.visible = true;
    }

    hideLinks(): void {
        this.links.visible = false;
    }
}