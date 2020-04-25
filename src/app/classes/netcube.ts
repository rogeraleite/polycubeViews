import { PolyCube } from './polycube.interface';
import { DataManager } from './datamanager';
import * as THREE from 'three-full';
import { VIEW_STATES } from './viewStates';
import { CUBE_CONFIG } from '../cube.config';
import { ElementRef, Inject } from '@angular/core';
import * as TWEEN from '@tweenjs/tween.js';
import * as D3 from 'd3';
import * as moment from 'moment';
import { Line } from 'three';
import { GraphPositionService } from '../services/graph.position.service';

export class NetCube implements PolyCube {
    cubeGroupGL: THREE.Group;
    cubeGroupCSS: THREE.Group;

    readonly cube_id = 'NET_CUBE';

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
    private colors: any;
    private timeLinearScale: D3.ScaleLinear<number, number>;
    private degreeScale: D3.ScaleLinear<any, any>;
    private hiddenLabels: Array<THREE.CSS3DObject>;

    private links_stc_aggregated: THREE.Group;
    private links_stc_absolute: THREE.Group;
    private links_si: THREE.Group;
    private linksPerNode = 1;

    private colorCoding: string = 'categorical';
    private cubeLeftBoarder: number;

    private _cubeToggle: boolean = true;

    private nodeSizeEncodeFactor = "overall_degree";
    private chargeFactor = 1;
    private areSlicesSaved = false;
    private areLinksSaved = false;

    // Graph Position Provider Service
    private gps: GraphPositionService;

    private currentTimeSetting: string = 'aggregated'; // aggregated time by default 

    get cubeToggle(): boolean {
        return this._cubeToggle;
    }

    constructor(dm: DataManager, camera: THREE.Camera, webGLScene: THREE.Scene, cssScene?: THREE.Scene) {
        this.dm = dm;
        this.webGLScene = webGLScene;

        if (cssScene) this.cssScene = cssScene;

        this.hiddenLabels = new Array<THREE.CSS3DObject>();

        this.setMap = new Set<string>();
        this.camera = camera;
        this.cubeLeftBoarder = (CUBE_CONFIG.WIDTH + CUBE_CONFIG.GUTTER) * 2;

        this.createObjects();
        this.assembleData();
        this.render();
    }



    createObjects(): void {
        this.timeLinearScale = this.dm.getTimeLinearScale();
        this.resetCubeGroupGL();
        this.resetCubeGroupCSS();
        this.colors = this.dm.colors;

        this.createSlices();

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.createBoundingBox();
    }

    assembleData(): void {
        this.dm.data.forEach((d: any) => { this.setMap.add(d.category_1); });

        this.addNetworkDegreeToNodes();

        this.cubeGroupCSS.add(this.createBottomLayer());
        this.createNodes();
        this.createLinks();
        this.showCubeLinks_aggregated();
    }

    setGraphPositionService(gps: GraphPositionService): void {
        this.gps = gps;
    }

    addNetworkDegreeToNodes(): void {
        this.dm.data.forEach((d: any) => {
            // initialize properties
            d.network_degree_in = 0;
            d.network_degree_out = 0;
            d.network_degree_overall = 0;
            d.incomingNodes = new Set<number>();
        });

        // For every node check against every other node
        this.dm.data.forEach((source: any) => {
            source.network_degree_out = source.target_nodes.length; // outgoing edges just length of target_nodes
            this.dm.data.forEach((target: any) => {
                if (source.id === target.id) return; // return so we dont check same node against itsself
                target.target_nodes.forEach((targetNode: any) => {
                    if (targetNode === source.id) { // if target of target is same as source - incoming edge
                        source.network_degree_in++;
                        source.incomingNodes.add(targetNode); // add to incomingNodes
                    }
                });
            });
        });

        this.dm.data.forEach((d: any) => {
            // calc total
            d.network_degree_overall = d.network_degree_in + d.network_degree_out;
        });
    }

    createBottomLayer(color?: string): void {
        let divContainer = document.createElement('div');

        divContainer.id = 'div_container_netcube';
        divContainer.style.width = CUBE_CONFIG.WIDTH + 'px';
        divContainer.style.height = CUBE_CONFIG.HEIGHT + 'px';
        divContainer.style.backgroundColor = color ? color : '#F4F8FB';
        document.getElementById('css-canvas').appendChild(divContainer);

        let divObject = new THREE.CSS3DObject(divContainer);
        divObject.name = 'DIV_CONTAINER_NETCUBE';
        divObject.position.set(CUBE_CONFIG.WIDTH / 2, -CUBE_CONFIG.WIDTH / 2, CUBE_CONFIG.WIDTH / 2);
        divObject.rotation.set(-Math.PI / 2, 0, 0);

        return divObject;
    }

    resetCubeGroupCSS(): void {
        this.cubeGroupCSS = new THREE.Group();
        this.cubeGroupCSS.name = this.cube_id + '_CSS';
        this.cubeGroupCSS.position.set(this.cubeLeftBoarder, 0, 0);
    }

    resetCubeGroupGL(): void {
        this.cubeGroupGL = new THREE.Group();
        // group holding all webGl objects
        this.cubeGroupGL.name = this.cube_id;
        this.cubeGroupGL.position.set(this.cubeLeftBoarder, 0, 0);
    }

    hideCube(): void {
        this.webGLScene.remove(this.webGLScene.getObjectByName('NET_CUBE'));
        this.cssScene.remove(this.cssScene.getObjectByName('NET_CUBE_CSS'));
        this.hideBottomLayer();
        this.hideLabels();
    }

    clearLabels(): void {
        let removed = new Array<THREE.CSS3DObject>();
        this.cubeGroupCSS.children.forEach((child: THREE.CSS3DObject) => {
            if (child.name.includes('NET_LABEL')) removed.push(child);
        });
        removed.forEach((r: THREE.CSS3DObject) => this.cubeGroupCSS.remove(r));
    }

    hideLabels(): void {
        this.cubeGroupCSS.traverse((object: THREE.Object3D) => {
            if (object.name.includes('NET_LABEL')) {
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

    render(): void {
        this.webGLScene.add(this.cubeGroupGL);
        this.cssScene.add(this.cubeGroupCSS); // add group to css scene
    }

    updateTime(time: string): void {
        this.currentTimeSetting = time;
        this.cubeGroupGL.children.forEach((child: THREE.Group, i) => {
            if (child.type !== 'Group') return;

            child.children.forEach((grandChild: any) => {
                if (grandChild.type !== 'DATA_POINT') return;
                let sliceOffsetY = child.position.y;
                grandChild.position.y = time === 'aggregated' ? 0 : (this.timeLinearScale(grandChild.data.date_time) - sliceOffsetY);

            });
        });

        this.currentTimeSetting === 'aggregated' ? this.showCubeLinks_aggregated() : this.showCubeLinks_absolute();
    }

    // TODO: This function is not called from anywhere
    // What is its purpose?????
    countDistanceBetweenLayersToFixAbsolutePositionBug(): any {
        let layers = [];
        let distance_between_layers = 0;
        let count = 0;

        this.cubeGroupGL.children.forEach((child: THREE.Group, i) => {
            if (child.type !== 'Group') return;

            child.children.forEach((grandChild: any) => {
                if (grandChild.type !== 'DATA_POINT') return;
                layers.push(child.position.y);
            });
        });

        let setlayers = Array.from(new Set(layers));

        return (setlayers[0] - setlayers[1]);
    }

    updateView(currentViewState: VIEW_STATES): void {
        if (this._cubeToggle) {
            this.webGLScene.add(this.cubeGroupGL);
            this.cssScene.add(this.cubeGroupCSS);
            this.showBottomLayer();
            this.showLabels();
        }
    }

    updateNumSlices(): void {
        this.timeLinearScale = this.dm.getTimeLinearScale();
        this.clearLabels();
        this.resetCubeGroupGL();

        this.updateSlices();
        this.assembleData();

        this.updateNetCubeFromScene();
    }

    updateNetCubeFromScene(): void {
        this.deleteNetCubeFromScene();
        this.webGLScene.add(this.cubeGroupGL);
    }

    deleteNetCubeFromScene(): void {
        this.webGLScene.children.forEach((cube, i) => {
            if (cube.name === this.cube_id) {
                this.webGLScene.children.splice(i, 1);
            }
        });
    }

    toggleDisplayCube(): void {
        this._cubeToggle = !this._cubeToggle;
    }

    updateColorCoding(encoding: string): void {
        this.colorCoding = encoding;
        switch (encoding) {
            case 'categorical':
                this.colors = this.dm.colors;//D3.scaleOrdinal(D3.schemePaired);
                break;
            case 'temporal':
                this.colors = D3.scaleSequential(D3.interpolateViridis).domain([this.dm.getMinDate(), this.dm.getMaxDate()]);
                break;
            case 'monochrome':
                this.colors = D3.scaleOrdinal(D3.schemeSet2);
                break;

            default:
                this.colors = this.dm.colors; //D3.scaleOrdinal(D3.schemePaired);
                break;
        }
    }

    updateNodeColor(encoding: string): void {
        this.updateColorCoding(encoding);

        this.getAllNodes().forEach((node: any) => {
            switch (encoding) {
                case 'categorical':
                    node.material.color.set(this.colors(node.data.category_1));
                    break;
                case 'temporal':
                    node.material.color.set(this.colors(node.data.date_time));
                    break;
                case 'monochrome':
                    node.material.color.set('#cc1414');
                    break;
                default:
                    node.material.color.set(this.colors(node.data.category_1));
                    break;
            }
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
            if (child.type !== 'Group') return;

            child.children.forEach((grandChild: any) => {
                if (grandChild.type !== 'DATA_POINT') return;

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

    updateData(): void {
    }

    areBothDatesWithinDateInterval(startDate: Date, endDate: Date, dates: Array<Date>): boolean {
        let isFirstDate = moment(dates[0]) >= moment(startDate) && moment(dates[0]) <= moment(endDate);
        let isSecondDate = moment(dates[1]) >= moment(startDate) && moment(dates[1]) <= moment(endDate);
        return isFirstDate && isSecondDate;
    }

    filterData(category: string, start: Date, end: Date): void {
        let query_byPeriod = this.filterNodesByDatePeriod(start, end);
        let query_byCategory = this.filterNodesByCategory(category);
        let intersection = this.getSimilarItems(query_byPeriod, query_byCategory);

        this.applyFilterToNodes(intersection);
    }


    getSimilarItems(array1: Array<string>, array2: Array<string>): Array<string> {
        return array1.filter(element => array2.includes(element));
    }


    applyFilterToNodes(nodes: Array<string>): void {
        this.showNodes(nodes);
        this.showLinksToRemainingNodes(nodes);
    }

    showNodes(nodes: Array<string>): void {
        this.getAllNodes().forEach((node: any) => {
            node.visible = nodes.includes("" + node.name);
        });
    }

    filterNodesByCategory(category: string): Array<string> {
        let selected_nodes = new Array<string>();

        this.getAllNodes().forEach((node: any) => {
            if (node.data.category_1 == category || category == "") {
                selected_nodes.push("" + node.name);
            }
        });

        return selected_nodes;
    }

    getAllNodes(): Array<any> {
        let all_nodes = new Array<any>();
        this.cubeGroupGL.children.forEach((group: THREE.Group) => {
            if (group.type == 'Group') {
                group.children.forEach((node: any) => {
                    if (node.type == 'DATA_POINT') {
                        all_nodes.push(node);
                    }
                });
            }
        });
        return all_nodes;
    }

    filterNodesByDatePeriod(startDate: Date, endDate: Date): Array<string> {
        let selected_nodes = new Array<string>();

        this.getAllNodes().forEach((node: any) => {
            if (this.isDateWithinInterval(startDate, endDate, node.data.date_time)) {
                selected_nodes.push("" + node.name);
            }
        });

        return selected_nodes;
    }

    showLinksToRemainingNodes(nodes: Array<string>): void {
        this.hideOutSlicerLinks(nodes);
        this.hideInSlicerLinks(nodes);
    }

    hideOutSlicerLinks(nodes: Array<string>): void {
        //stc links aggregated (cube)
        this.links_stc_aggregated.children.forEach((link: THREE.Group) => {
            link.visible = this.areBothSidesOfTheLinkSelected(link, nodes);
        });
        //stc links absolute (cube)
        this.links_stc_absolute.children.forEach((link: THREE.Group) => {
            link.visible = this.areBothSidesOfTheLinkSelected(link, nodes);
        });
        //SI links
        this.links_si.children.forEach((link: THREE.Group) => {
            link.visible = this.areBothSidesOfTheLinkSelected(link, nodes);
        });
    }

    hideInSlicerLinks(nodes: Array<string>): void {
        this.slices.forEach((slice: THREE.Group) => {
            slice.children.forEach((element: THREE.Group) => {
                if (element.type == "Line") {
                    let link = element;
                    link.visible = this.areBothSidesOfTheLinkSelected(link, nodes);
                }//end if
            });
        });
    }

    areBothSidesOfTheLinkSelected(link: Line, nodes: Array<string>): boolean {
        let nodeNames = this.getLinkBothNodesNames(link);
        let result = (nodes.includes(nodeNames[0]) && nodes.includes(nodeNames[1]));

        return result;
    }

    areBothNodesFromSameTargetCategory(link: any, category: string): boolean {
        let bothNodeCategories = this.getLinkBothNodesCategories(link.name);
        if (this.areBothSameNodeCategory(bothNodeCategories) &&
            this.isTargetCategory(bothNodeCategories[0], category)) {
            return true;
        }
        return false;
    }

    areBothSameNodeCategory(nodes_categories: Array<string>): boolean {
        return nodes_categories[0] == nodes_categories[1];
    }

    isTargetCategory(target_node_category: string, target_category: string): boolean {
        if (target_category == "") return true;
        return target_node_category == target_category;
    }

    isDateWithinInterval(startDate: Date, endDate: Date, pointDate: Date): boolean {
        if (!startDate) startDate = this.dm.getMinDate();
        if (!endDate) endDate = this.dm.getMaxDate();
        return moment(pointDate) >= moment(startDate) && moment(pointDate) <= moment(endDate);
    }

    getLinkDates(link_name: any): Array<Date> {
        let couple_ids = link_name.name.split("_", 2);
        let id1 = couple_ids[0];
        let id2 = couple_ids[1];

        return [this.dm.dataMap[id1].date_time, this.dm.dataMap[id2].date_time];
    }

    getLinkBothNodesNames(link: any): Array<string> {
        let couple_ids = link.name.split("_", 2);
        let id1 = couple_ids[0];
        let id2 = couple_ids[1];

        return [id1, id2];
    }

    getLinkBothNodesCategories(link_name: any): Array<string> {
        let couple_ids = link_name.split("_", 2);
        let id1 = couple_ids[0];
        let id2 = couple_ids[1];

        return [this.dm.dataMap[id1].category_1, this.dm.dataMap[id2].category_1];
    }


    //TRANSITIONS
    transitionSTC(): void {
        if (!this._cubeToggle) return;
        this.currentTimeSetting === 'aggregated' ? this.showCubeLinks_aggregated() : this.showCubeLinks_absolute(); // get back setting
        this.showBottomLayer();
        this.boundingBox.visible = true;
        this.slices.forEach((slice: THREE.Group, i: number) => {
            this.transitionAnimationSTC(slice, i);
        });//end forEach
    }

    transitionAnimationSTC(slice: THREE.Group, index: number): void {
        let vertOffset = CUBE_CONFIG.HEIGHT / this.dm.timeRange.length;
        let sourceCoords = {
            x: slice.position.x,
            y: slice.position.y,
            z: slice.position.z
        };

        let targetCoords = {
            x: CUBE_CONFIG.WIDTH / 2,
            y: (index * vertOffset) - (CUBE_CONFIG.WIDTH / 2),
            z: CUBE_CONFIG.WIDTH / 2
        };

        let label = this.cubeGroupCSS.getObjectByName(`NET_LABEL_${index}`);
        if (label) {
            D3.selectAll('.time-slice-label').style('opacity', '1');
            label.position.x = targetCoords.x - CUBE_CONFIG.WIDTH / 2 - 22;
            label.position.y = targetCoords.y;
            label.position.z = targetCoords.z;
            label.rotation.set(0, 0, 0);
        }

        let tween = new TWEEN.Tween(sourceCoords)
            .to(targetCoords, 1000)
            .delay(index * 300)
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
    }

    transitionJP(): void {
        this.hideBottomLayer();
        if (!this._cubeToggle) return;
        this.hideAllLinks();
        this.boundingBox.visible = false;
        this.slices.forEach((slice: THREE.Group, i: number) => {
            this, this.transitionAnimationJP(slice, i);
        });
    }

    transitionAnimationJP(slice: THREE.Group, index: number): void {
        let vertOffset = CUBE_CONFIG.HEIGHT + 20;
        let sourceCoords = {
            x: slice.position.x,
            y: slice.position.y,
            z: slice.position.z
        };

        let targetCoords = {
            x: slice.position.x,
            y: -CUBE_CONFIG.HEIGHT / 2,
            z: (index * vertOffset) - (CUBE_CONFIG.WIDTH / 2)
        };

        let label = this.cubeGroupCSS.getObjectByName(`NET_LABEL_${index}`);
        if (label) {
            D3.selectAll('.time-slice-label').style('opacity', '1');
            label.position.x = targetCoords.x - CUBE_CONFIG.WIDTH / 2 - 22;
            label.position.y = targetCoords.y;
            label.position.z = targetCoords.z;
            label.rotation.set(-Math.PI / 2, 0, 0);
        }

        let tween = new TWEEN.Tween(sourceCoords)
            .to(targetCoords, 1000)
            .delay(index * 300)
            .easing(TWEEN.Easing.Cubic.InOut)
            .onUpdate(() => {
                slice.position.x = sourceCoords.x;
                slice.position.y = sourceCoords.y,
                    slice.position.z = sourceCoords.z;
            })
            .start();
    }

    transitionSI(): void {
        if (!this._cubeToggle) return;
        this.showSILinks();
        this.hideBottomLayer();
        this.boundingBox.visible = false;
        this.slices.forEach((slice: THREE.Group, i: number) => {
            this.transitionAnimationSI(slice, i);
        });
    }

    transitionAnimationSI(slice: THREE.Group, index: number) {
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
            .delay(index * 300)
            .easing(TWEEN.Easing.Cubic.InOut)
            .onUpdate(() => {
                slice.position.x = sourceCoords.x;
                slice.position.y = sourceCoords.y,
                    slice.position.z = sourceCoords.z;
            })
            .onComplete(() => {
                D3.selectAll('.time-slice-label').style('opacity', '0');
            })
            .start();
    }

    transitionANI(): void { }

    /////////
    getCubePosition(): THREE.Vector3 {
        let positionInWorld = new THREE.Vector3();
        this.cubeGroupGL.getWorldPosition(positionInWorld);
        return positionInWorld;
    }

    getCurrentColor(object: THREE.Object3D): string {
        switch (this.colorCoding) {
            case 'categorical': return this.colors(object.data.category_1);
            case 'temporal': return this.colors(object.data.date_time);
            case 'monochrome': return '#cc1414';
            default: return this.colors(object.data.category_1)
        }
    }

    resetCategorySelection(gray: boolean = false): void {
        this.filterData("", this.dm.getMinDate(), this.dm.getMaxDate());
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

                grandChild.material.color.set(gray ? '#b5b5b5' : this.getCurrentColor(grandChild));
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

            return selectedObject.data;
        }
        this.resetSelection();
        return null;
    }

    highlightObject(id: string): void {
        this.resetSelection(true);

        let highlighted_source = this.cubeGroupGL.getObjectByName(id);

        if (highlighted_source) {
            highlighted_source.material.color.setHex(0xff0000);

            //highlight targetBy
            highlighted_source.data.targetBy.forEach((n_id) => {
                let related = this.getNodesInSceneById(n_id);
                related.material.color.setHex(0xEF9A9A);
            })

            //highlight targets            
            for (let a = 0; a < this.linksPerNode; a++) {
                let target_id = highlighted_source.data.target_nodes[a];
                if (target_id) {
                    let related = this.getNodesInSceneById(target_id);
                    related.material.color.setHex(0x000000);
                }
            }
        }
    }

    getNodesInSceneById(id: string): any {
        let _node = null;
        this.slices.forEach((slice: THREE.Group) => {
            slice.children.forEach((node: any) => {
                if (node.name == id) _node = node;
            })
        });
        return _node;
    }

    getTimeSliceById(id: any): THREE.Group {
        let date = this.dm.getNodeById(id).date_time;
        let correspondingSlice: THREE.Group;
        this.slices.forEach((slice: THREE.Group) => {
            if (slice.name === this.dm.getTimeQuantile(date)) {
                correspondingSlice = slice;
                return;
            }
        });
        return correspondingSlice;
    }

    resetNodesInTimeSlices(): void {
        let save_nonNodes_slice_content = new Array<any>();
        //create slices saving conditions
        this.slices.forEach((slice: THREE.Group) => {
            save_nonNodes_slice_content.push([]);
        });

        //save the non-nodes elements from the slices
        this.slices.forEach((slice: THREE.Group, i: number) => {
            slice.children.forEach((c: THREE.Group) => {
                if (c.type != "DATA_POINT") {
                    save_nonNodes_slice_content[i].push(c);
                }
            });
        });

        //fulfil slices with non-nodes elements
        this.slices.forEach((slice: THREE.Group, i: number) => {
            slice.children = save_nonNodes_slice_content[i];
        });
    }

    getTimeSliceByDate(date: Date): THREE.Group {
        let correspondingSlice: THREE.Group;
        this.slices.forEach((slice: THREE.Group) => {
            if (slice.name === this.dm.getTimeQuantile(date)) {
                correspondingSlice = slice;
                return;
            }
        });
        return correspondingSlice;
    }

    applyChargeFactorInNodes(): void {
        if (!this.areSlicesSaved) this.saveSliceRecords();

        this.slices.forEach((s: THREE.Group, i) => {
            s.updateMatrixWorld();
            s.children.forEach((c, ii) => {

                c.position.x = c.original_position_x * this.chargeFactor;
                c.position.z = c.original_position_z * this.chargeFactor;

                var vector = new THREE.Vector3();
                vector.setFromMatrixPosition(c.matrixWorld);
            })
        });
    }

    applyChargeFactorInInternalSliceLinks(): void {
        if (!this.areSlicesSaved) this.saveSliceRecords();

        this.slices.forEach((s: THREE.Group, i) => {
            s.updateMatrixWorld();
            s.children.forEach((l) => {
                if (l.type !== 'Line') return;
                l = this.scaleLink(l);
            })
        });
    }

    scaleLink(link: any): any {
        let source = link.name.split("_")[0];
        let target = link.name.split("_")[1];

        let source_pos = this.getNormalizedPositionById(source);
        let target_pos = this.getNormalizedPositionById(target);

        link.geometry.vertices[0].x = source_pos.x * this.chargeFactor;
        link.geometry.vertices[0].z = source_pos.z * this.chargeFactor;
        link.geometry.vertices[1].x = target_pos.x * this.chargeFactor;
        link.geometry.vertices[1].z = target_pos.z * this.chargeFactor;
        link.geometry.verticesNeedUpdate = true;

        return link;
    }

    scaleLinkNormalizing(link: any): any {
        let source = link.name.split("_")[0];
        let target = link.name.split("_")[1];

        let source_pos = this.getNormalizedPositionWithChargeById(source);
        let target_pos = this.getNormalizedPositionWithChargeById(target);

        link.geometry.vertices[0].x = source_pos.x;
        link.geometry.vertices[0].z = source_pos.z;
        link.geometry.vertices[1].x = target_pos.x;
        link.geometry.vertices[1].z = target_pos.z;
        link.geometry.verticesNeedUpdate = true;

        return link;
    }

    applyChargeFactorInLinks(): void {
        this.links_stc_aggregated.children.forEach((l) => {
            l = this.scaleLinkNormalizing(l);
        })
        this.links_stc_absolute.children.forEach((l) => {
            l = this.scaleLinkNormalizing(l);
        })
        this.links_si.children.forEach((l) => {
            l = this.scaleLinkNormalizing(l);
        })
    }

    saveSliceRecords(): void {
        this.slices.forEach((s: THREE.Group) => {
            s.children.forEach((c) => {
                c.original_position_x = c.position.x;
                c.original_position_z = c.position.z;
            })
        });
        this.areSlicesSaved = true;
    }

    onDblClick($event: any): void {
    }

    getNormalizedPositionWithChargeById(id: string): any {
        let pos_map = this.dm.getForcedDirectedPositionMap();
        let pos_dim = this.dm.getDataPositionDimensions();

        let normalized_x = null;
        let normalized_z = null;
        if (pos_map.has(`${id}`)) {
            normalized_x = ((pos_map.get(`${id}`).x * CUBE_CONFIG.WIDTH / Math.abs(pos_dim.max_x - pos_dim.min_x)) * this.chargeFactor) + CUBE_CONFIG.WIDTH / 2;
            normalized_z = ((pos_map.get(`${id}`).y * CUBE_CONFIG.WIDTH / Math.abs(pos_dim.max_y - pos_dim.min_y)) * this.chargeFactor) + CUBE_CONFIG.WIDTH / 2;
        }

        if (normalized_x) return { x: normalized_x, y: null, z: normalized_z };
        else return null;
    }

    getNormalizedPositionById(id: string): any {
        let pos_map = this.dm.getForcedDirectedPositionMap();
        let pos_dim = this.dm.getDataPositionDimensions();
        let normalized_x = null;
        let normalized_z = null;

        if (pos_map.has(`${id}`)) {
            normalized_x = pos_map.get(`${id}`).x * CUBE_CONFIG.WIDTH / Math.abs(pos_dim.max_x - pos_dim.min_x);
            normalized_z = pos_map.get(`${id}`).y * CUBE_CONFIG.WIDTH / Math.abs(pos_dim.max_y - pos_dim.min_y);
        }

        if (normalized_x) return { x: normalized_x, y: null, z: normalized_z };
        else return null;
    }

    addTargetByInformationInDataItems(): void {
        let targetBy_map = []

        //create empty map
        for (let i = 0; i < this.dm.data.length; i++) {
            let dataItem = this.dm.data[i];
            targetBy_map[dataItem.id] = [];
        }

        //fill map with relations
        for (let i = 0; i < this.dm.data.length; i++) {
            let dataItem = this.dm.data[i];
            for (let a = 0; a < this.linksPerNode; a++) {
                let targetId = dataItem.target_nodes[a];
                if (targetBy_map[targetId]) targetBy_map[targetId].push(dataItem.id);
            }
        }

        //add targetBy information to data items
        for (let i = 0; i < this.dm.data.length; i++) {
            let dataItem = this.dm.data[i];
            this.dm.data[i].targetBy = targetBy_map[dataItem.id];
        }

    }

    createNodes(): void {

        this.resetNodesInTimeSlices();

        let geometry = new THREE.SphereGeometry(CUBE_CONFIG.NODE_SIZE, 32, 32);

        // using linear scale to calculate the degree size for nodes 
        let degreeExtent =  D3.extent(this.dm.data, (d: any) => {
            return d.network_degree_in });
        this.degreeScale = D3.scaleLinear().domain([degreeExtent[0],degreeExtent[1]]).range([1,6]);
        this.addTargetByInformationInDataItems();

        for (let i = 0; i < this.dm.data.length; i++) {
            let dataItem = this.dm.data[i];
            // let networkDegreeFactor = this.getNetworkDegreeFactor(dataItem);
            let networkDegreeFactor = this.degreeScale(dataItem.network_degree_in);

            let material = new THREE.MeshBasicMaterial({ color: this.colors(dataItem.category_1) });

            let point = new THREE.Mesh(geometry, material);

            let position = this.getNormalizedPositionById(dataItem.id);
            if (position) {
                point.position.x = position.x;
                point.position.z = position.z;

                point.name = dataItem.id;
                point.data = dataItem;
                point.type = 'DATA_POINT';

                point.scale.set(networkDegreeFactor, networkDegreeFactor, networkDegreeFactor);

                this.getTimeSliceByDate(dataItem.date_time).add(point);
            }//end if            
        }//end for
    }

    // This function needs to be improved using d3.scaleLinear with min/max incoming node count (SS: Done at at the top, no need for this function anymore) 
    // Instead of just returning 5 if result is higher than 5 (lots of nodes have way more than 5 incoming nodes)
    getNetworkDegreeFactor(dataItem: any): number {
        let result = 1;
        switch (this.nodeSizeEncodeFactor) {
            case 'overall_degree': 
                result = dataItem.network_degree_overall;
                result = Math.log2(result);
                break;
            case 'in_degree': 
                result = dataItem.network_degree_in;
                result = Math.log2(result);
                break;
            case 'out_degree': 
                result = dataItem.network_degree_out; 
                break;
            case 'non_degree': 
                result = 1; 
                break;
        }



        if (result < 1) result = 1;
        else if (result > 5) result = 5;

        return result;
    }

    createLinks(): void {

        this.links_stc_aggregated = new THREE.Group();
        this.links_stc_absolute = new THREE.Group();
        this.links_si = new THREE.Group();

        for (let i = 0; i < this.dm.data.length; i++) {
            let dataItem = this.dm.data[i];

            let sourceNode_position = this.getNormalizedPositionById(`${dataItem.id}`);
            sourceNode_position.y = this.getTimeSliceByDate(dataItem.date_time).position.y;

            for (let a = 0; a < this.linksPerNode; a++) {

                let targetId = dataItem.target_nodes[a];

                if (this.doesTargetNodeHasPosition(targetId)) {
                    //STC aggregated                    
                    let line_forSTC_aggregated = this.createLineForSTC_aggregated(dataItem, sourceNode_position, a);
                    if (line_forSTC_aggregated) this.links_stc_aggregated.add(line_forSTC_aggregated);

                    //STC absolute                    
                    let line_forSTC_absolute = this.createLineForSTC_absolute(dataItem, sourceNode_position, a);
                    if (line_forSTC_absolute) this.links_stc_absolute.add(line_forSTC_absolute);

                    //SI
                    let line_forSI = this.createLineForSI(dataItem, sourceNode_position, a);
                    if (line_forSI) this.links_si.add(line_forSI);

                    //JP
                    let line_forJP = this.createLineForJP(dataItem, sourceNode_position, a);
                    if (line_forJP) this.getTimeSliceByDate(dataItem.date_time).add(line_forJP);
                }//end if
            }//end for     
        }//end for

        this.cubeGroupGL.add(this.links_stc_aggregated);
        this.cubeGroupGL.add(this.links_stc_absolute);
        this.cubeGroupGL.add(this.links_si);
    }

    createLineForJP(dataItem, sourceNode_position, targetIndex) {
        let targetId = dataItem.target_nodes[targetIndex];
        if (!this.dm.dataMap[targetId]) return;
        let targetNode_position = this.getNormalizedPositionById(targetId);
        targetNode_position.y = this.getTimeSliceByDate(this.dm.dataMap[targetId].date_time).position.y;

        if (this.areSourceAndTargetInTheSameSlice(dataItem.id, targetId)) {
            targetNode_position.y = 0;
            sourceNode_position.y = 0;

            targetNode_position.x = this.parsePositionForJP(targetNode_position.x);
            sourceNode_position.x = this.parsePositionForJP(sourceNode_position.x);

            targetNode_position.z = this.parsePositionForJP(targetNode_position.z);
            sourceNode_position.z = this.parsePositionForJP(sourceNode_position.z);

            let lineGeometry = this.createLineGeometry(sourceNode_position, targetNode_position);
            let line = new THREE.Line(lineGeometry, this.getLineMaterial());
            line.name = this.getLineName(dataItem, targetId);
            return line;
        }
        return null;
    }

    areSourceAndTargetInTheSameSlice(sourceId: string, targetId: string): boolean {
        if (this.getTimeSliceById(sourceId).name === this.getTimeSliceById(targetId).name) return true;
        return false;
    }

    parsePositionForJP(coordinate: number): number {
        return coordinate - CUBE_CONFIG.WIDTH / 2;
    }

    createLineForSI(dataItem: any, sourceNode_position: any, targetIndex: number) {
        let targetId = dataItem.target_nodes[targetIndex];
        let targetNode_position = this.getNormalizedPositionById(targetId);

        sourceNode_position.y = this.getYValueWhenFlatVis();
        targetNode_position.y = this.getYValueWhenFlatVis();

        let lineGeometry = this.createLineGeometry(sourceNode_position, targetNode_position);
        let line = new THREE.Line(lineGeometry, this.getLineMaterial());
        line.name = this.getLineName(dataItem, targetId);
        return line;
    }

    getYValueWhenFlatVis(): number {
        return -CUBE_CONFIG.HEIGHT / 2;
    }

    createLineForSTC_aggregated(dataItem: any, sourceNode_position: any, targetIndex: number): any {
        let targetId = dataItem.target_nodes[targetIndex];
        if (!this.dm.dataMap[targetId]) return;

        let targetNode_position = this.getNormalizedPositionById(targetId);
        targetNode_position.y = this.getTimeSliceByDate(this.dm.dataMap[targetId].date_time).position.y;

        let lineGeometry = this.createLineGeometry(sourceNode_position, targetNode_position);
        let line = new THREE.Line(lineGeometry, this.getLineMaterial());
        line.name = this.getLineName(dataItem, targetId);
        return line;
    }

    createLineForSTC_absolute(dataItem, sourceNode_position, targetIndex) {
        let targetId = dataItem.target_nodes[targetIndex];
        if (!this.dm.dataMap[targetId]) return;

        let sourcePosition: THREE.Vector3 = {
            x: sourceNode_position.x,
            y: this.timeLinearScale(moment(`${dataItem.date_time}`).toDate()),
            z: sourceNode_position.z
        };

        let targetNode = this.getNormalizedPositionById(targetId);
        let targetPosition: THREE.Vector3 = {
            x: targetNode.x,
            y: this.timeLinearScale(moment(`${this.dm.dataMap[targetId].date_time}`).toDate()),
            z: targetNode.z
        };

        let lineGeometry = this.createLineGeometry(sourcePosition, targetPosition);
        let line = new THREE.Line(lineGeometry, this.getLineMaterial());
        line.name = this.getLineName(dataItem, targetId);

        return line;
    }

    getLineName(dataItem: any, targetId: string) {
        return dataItem.id + "_" + targetId;
    }

    doesTargetNodeHasPosition(targetId) {
        if (this.getNormalizedPositionById(targetId)) return true;
        return false;
    }

    getLineMaterial() {
        return new THREE.LineBasicMaterial({ color: '#b5b5b5', transparent: true, opacity: 0.75 });
    }

    createLineGeometry(sourceNode_position: THREE.Vector3, targetNode_position: THREE.Vector3) {
        let position_fix = CUBE_CONFIG.WIDTH / 2;
        let lineGeometry = new THREE.Geometry();
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

        lineGeometry.verticesNeedUpdate = true;
        return lineGeometry;
    }


    updateSlices(): void {
        this.slices.forEach((slice: THREE.Group) => { this.cubeGroupGL.remove(slice); });
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
            let material = new THREE.LineBasicMaterial({ color: '#b5b5b5' });
            let plane = new THREE.LineSegments(edgeGeometry, material);

            slice.position.set(CUBE_CONFIG.WIDTH / 2, (i * vertOffset) - (CUBE_CONFIG.WIDTH / 2), CUBE_CONFIG.WIDTH / 2);
            plane.position.set(0, 0, 0);
            plane.rotation.set(Math.PI / 2, 0, 0);
            slice.add(plane);
            this.slices.push(slice);

            // CSS 3D TIME SLICE LABELS
            let element = document.createElement('div');
            element.innerHTML = slice.name;
            element.className = 'time-slice-label';

            //CSS Object
            let label = new THREE.CSS3DObject(element);
            label.position.set(-20, (i * vertOffset) - (CUBE_CONFIG.WIDTH / 2), CUBE_CONFIG.WIDTH / 2);
            label.name = `NET_LABEL_${i}`;
            this.cubeGroupCSS.add(label);
        }
        this.slices.forEach((slice: THREE.Group) => { this.cubeGroupGL.add(slice); });
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
            let material = new THREE.LineBasicMaterial({ color: 0xb5b5b5 });
            let plane = new THREE.LineSegments(edgeGeometry, material);

            slice.position.set(CUBE_CONFIG.WIDTH / 2, this.timeLinearScale(moment(`${slice.name}`).toDate()), CUBE_CONFIG.WIDTH / 2);
            slice.index = i;
            plane.position.set(0, 0, 0);
            plane.rotation.set(Math.PI / 2, 0, 0);
            slice.add(plane);
            //slice.yPos = (i*vertOffset) - (CUBE_CONFIG.WIDTH/2);
            this.slices.push(slice);

            // CSS 3D TIME SLICE LABELS
            let element = document.createElement('div');
            element.innerHTML = slice.name;
            element.className = 'time-slice-label';

            // CSS Object
            let label = new THREE.CSS3DObject(element);
            label.position.set(-20, this.timeLinearScale(moment(`${slice.name}`).toDate()), CUBE_CONFIG.WIDTH / 2);
            label.name = `NET_LABEL_${i}`;
            this.cubeGroupCSS.add(label);
        }//end for
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

    hideBottomLayer(): void {
        let bottomLayer = document.getElementById('div_container_netcube');
        if (bottomLayer) bottomLayer.style.opacity = '0';
    }

    showBottomLayer(): void {
        let bottomLayer = document.getElementById('div_container_netcube');
        if (bottomLayer) bottomLayer.style.opacity = '1';
    }


    hideAllLinks(): void {
        this.hideCubeLinks_aggregated();
        this.hideCubeLinks_absolute();
        this.hideSILinks();
    }

    showCubeLinks_absolute(): void {
        this.hideAllLinks();
        this.hideCubeLinks_aggregated();
        this.links_stc_absolute.visible = true;
    }

    showCubeLinks_aggregated(): void {
        this.hideAllLinks();
        this.links_stc_aggregated.visible = true;
        this.cubeGroupGL.add(this.links_stc_aggregated);
    }

    showSILinks(): void {
        this.hideAllLinks();
        this.links_si.visible = true;
    }

    hideCubeLinks_aggregated(): void {
        this.links_stc_aggregated.visible = false;
        this.cubeGroupGL.remove(this.links_stc_aggregated);
    }

    hideCubeLinks_absolute(): void {
        this.links_stc_absolute.visible = false;
    }

    hideSILinks(): void {
        this.links_si.visible = false;
    }

    changeNodeSizeEncode(encode_type) {
        this.nodeSizeEncodeFactor = encode_type;
        this.createNodes();
    }

    changeChargeFactor(factor) {
        this.chargeFactor = factor / 25;
        this.applyChargeFactorInNodes();
        this.applyChargeFactorInLinks();
        this.applyChargeFactorInInternalSliceLinks();
    }


    async delay(ms: number) {
        await new Promise(resolve => setTimeout(() => resolve(), ms));
    }
    // TODO: useless function?x`
    // Should we remove
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

}