import { PolyCube } from './polycube.interface';
import { DataManager } from './datamanager';
import * as THREE from 'three-full';
import * as TWEEN from '@tweenjs/tween.js';
import { VIEW_STATES } from './viewStates';
import { CUBE_CONFIG } from '../cube.config';
import * as D3 from 'd3';
import * as moment from 'moment';
import { ElementRef } from '@angular/core';
import { mouse } from 'd3';
import { forceCluster } from 'd3-force-cluster';


export class SetCube implements PolyCube {
    cubeGroupGL: THREE.Group;
    cubeGroupCSS: THREE.Group;
    pointGroup: Array<THREE.Group>;
    circleGroup: Array<THREE.Group>;
    hullGroup: THREE.Group;
    hullState: boolean;

    // Data
    private dm: DataManager;
    private camera: THREE.Camera;
    private setMap: Set<string>;

    // THREE
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;
    private webGLScene: THREE.Scene;
    private cssScene: THREE.Scene;
    private colors: any;
    private timeLinearScale: D3.ScaleLinear<number, number>;
    private boundingBox: THREE.BoxHelper;

    private slices: Array<THREE.Group>;
    private colorCoding = 'categorical';
    private cubeLeftBoarder: number;

    private _cubeToggle = true;
    private filterCat: any = '';

    private hiddenLabels: Array<THREE.CSS3DObject>;

    get cubeToggle(): boolean {
        return this._cubeToggle;
    }

    constructor(dm: DataManager, camera: THREE.Camera, webGLScene: THREE.Scene, cssScene: THREE.Scene) {
        this.dm = dm;
        this.webGLScene = webGLScene;

        if (cssScene) { this.cssScene = cssScene; }

        this.hiddenLabels = new Array<THREE.CSS3DObject>();

        this.setMap = new Set<any>();
        this.camera = camera;

        this.cubeLeftBoarder = (CUBE_CONFIG.WIDTH + CUBE_CONFIG.GUTTER) * 1;

        this.createObjects();
        this.assembleData();
        // artificial timeout to process all data before drawing hull
        // TODO: Could be improved using promises, callbacks, or after the layout completes
        setTimeout(() => {
            this.drawHull();
            this.showHull();
        }, 1000);
        this.render();
    }

    hideCube(): void {
        this.webGLScene.remove(this.webGLScene.getObjectByName('SET_CUBE'));
        this.cssScene.remove(this.cssScene.getObjectByName('SET_CUBE_CSS'));
        this.hideBottomLayer();
        this.hideLabels();
    }

    createObjects(): void {
        this.cubeGroupGL = new THREE.Group();
        this.cubeGroupCSS = new THREE.Group();
        this.cubeGroupCSS.position.set(this.cubeLeftBoarder, 0, 0);
        this.colors = this.dm.colors; // D3.scaleOrdinal(D3.schemePaired);
        this.slices = new Array<THREE.Group>();
        this.pointGroup = new Array<THREE.Group>();
        this.circleGroup = new Array<THREE.Group>();
        // this.pointGroup.name = 'pointGroup'
        this.cubeGroupGL.pointGroup = this.pointGroup;

        this.timeLinearScale = this.dm.getTimeLinearScale();

        // hull
        this.hullGroup = new THREE.Group();
        this.hullState = false;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();


        const placeholderBox = new THREE.Mesh(
            new THREE.BoxGeometry(CUBE_CONFIG.WIDTH, CUBE_CONFIG.HEIGHT, CUBE_CONFIG.WIDTH),
            new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        );

        placeholderBox.position.set(CUBE_CONFIG.WIDTH / 2, 0, CUBE_CONFIG.WIDTH / 2);
        this.boundingBox = new THREE.BoxHelper(placeholderBox, '#b5b5b5');
        this.boundingBox.name = 'BOX_HELPER';
        this.cubeGroupGL.add(this.boundingBox);
        this.cubeGroupGL.add(this.hullGroup);
    }

    assembleData(): void {
        this.updateSetCube(this.dm.timeRange.length, true);
        this.cubeGroupCSS.add(this.createBottomLayer());
    }

    createBottomLayer(color?: string): void {
        const divContainer = document.createElement('div');

        divContainer.id = 'div_container_setcube';
        divContainer.style.width = CUBE_CONFIG.WIDTH + 'px';
        divContainer.style.height = CUBE_CONFIG.HEIGHT + 'px';
        divContainer.style.backgroundColor = color ? color : '#F4F8FB';
        document.getElementById('css-canvas').appendChild(divContainer);

        const divObject = new THREE.CSS3DObject(divContainer);
        divObject.name = 'DIV_CONTAINER_SETCUBE';
        divObject.position.set(CUBE_CONFIG.WIDTH / 2, -CUBE_CONFIG.WIDTH / 2, CUBE_CONFIG.WIDTH / 2);
        divObject.rotation.set(-Math.PI / 2, 0, 0);

        return divObject;
    }

    // pass new slices numer and run the simulation again
    updateSetCube(segs: number = this.dm.timeRange.length, initial: boolean = false, layout: string = 'pack'): void { // pass object parameter to function

        // clean function
        this.circleGroup = [];

        // clear scene of old objects
        this.slices.forEach((slice: THREE.Group) => { this.cubeGroupGL.remove(slice); });
        this.slices = new Array<THREE.Group>();
        this.clearLabels();

        this.dm.data.forEach((d: any) => {
            this.setMap.add(d.category_1); // TODO: pass the count size of each category
            // store quantized time
            d.groupDate = moment((this.dm.getCustomTimeQuantile(d.date_time, segs)), 'YYYY').toDate();
        });

        // this.timeLinearScale(some_date) gives us the vertical axis coordinate of the point

        // group by time and then category
        const groupedData = D3.nest()
            .key((d: any) => moment(d.groupDate).format('YYYY'))
            .key((d: any) => d.category_1)
            .entries(this.dm.data)
            .sort((a: any, b: any) => a.key == b.key ? 0 : +(a.key > b.key) || -1);

        // add geometry points
        const pointGeometry = new THREE.SphereGeometry(CUBE_CONFIG.NODE_SIZE, 32, 32);
        const vertOffset = CUBE_CONFIG.HEIGHT / this.dm.timeRange.length;

        // layouts
        const circleLayout = this.getCircleLayout(this.setMap, 0, 0, 180);
        const packLayout = this.getPackLayout();

        const radExtent = D3.extent(this.getSetScale(), function(d: any) {
            return d.Value;
        });
        const radScale = D3.scaleLinear().domain(radExtent).range([5, 80]);


        groupedData.forEach((timeLayer: any, i: number) => { // complete group

            // flat planes for JP
            const geometry = new THREE.PlaneGeometry(CUBE_CONFIG.WIDTH, CUBE_CONFIG.WIDTH, 32);
            const edgeGeometry = new THREE.EdgesGeometry(geometry);
            const material = new THREE.LineBasicMaterial({ color: '#b5b5b5' });
            const plane = new THREE.LineSegments(edgeGeometry, material);
            plane.position.set(0, 0, 0);
            plane.rotation.set(Math.PI / 2, 0, 0);

            // time slices
            const slice = new THREE.Group();
            slice.name = timeLayer.key; // we need to decide either to use full date or
            slice.add(plane);
            slice.position.set(CUBE_CONFIG.WIDTH / 2, initial ? this.timeLinearScale(moment(`${slice.name}`).toDate()) : -CUBE_CONFIG.WIDTH / 2, CUBE_CONFIG.WIDTH / 2); // for initial run
            // slice.position.set(CUBE_CONFIG.WIDTH / 2, - (CUBE_CONFIG.WIDTH / 2), CUBE_CONFIG.WIDTH / 2); // for updates
            this.slices.push(slice);
            this.cubeGroupGL.add(slice);

            // CSS 3D TIME SLICE LABELS
            const element = document.createElement('div');
            element.innerHTML = slice.name;
            element.className = 'time-slice-label';

            //CSS Object
            let label = new THREE.CSS3DObject(element);
            label.position.set(-20, this.timeLinearScale(moment(`${slice.name}`).toDate()), CUBE_CONFIG.WIDTH / 2);
            label.name = `SET_LABEL_${i}`;
            this.cubeGroupCSS.add(label);



            // each category inside each time slice
            timeLayer.values.forEach((category: any) => { // slices group

                // circle geometry
                // const rad = category.values.length / 2;//ral: size of the big circles

                const rad = radScale(category.values.length);

                const geometry = new THREE.CircleGeometry(rad, 32); // hull resolution
                const material1 = new THREE.MeshBasicMaterial({
                    color: '#d0d0d0',
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.7
                });
                const circle = new THREE.Mesh(geometry, material1);

                circle.matrixWorldNeedsUpdate = true;
                circle.name = category.key;
                circle.rotation.x = Math.PI / 2;

                // hide the circle layer in SI view
                (segs == 1) ? circle.visible = false : circle.visible = true;
                // circle.name = timeLayer.key + category.key;

                // apply group positions
                this.getLayouts(layout, category, circle);

                circle.updateMatrixWorld();

                // get circles into one group to use for hull later
                this.circleGroup.push(circle);
                slice.add(circle);

                // add circle label
                // console.log(circle.position)

                // add points after each category
                // get this category points positions
                // let spiralCategory = this.getSpiralPosition(parentPos.x, parentPos.z, rad, category.values)

                const phyllotaxis = this.getPhyllotaxis(circle.position.x, circle.position.z, rad, category.values);

                phyllotaxis.forEach((points) => { // points group

                    // this.updateColorCoding('temporal');
                    const material2 = new THREE.MeshBasicMaterial({ color: this.getCurrentColor(points) }); // FIXME: Color not found on SI

                    const point = new THREE.Mesh(pointGeometry, material2);
                    point.material.needsUpdate = true;

                    point.position.y = circle.position.y;
                    point.position.x = points.x;
                    point.position.z = points.y;
                    point.name = points.data.id;
                    point.data = points.data;
                    point.type = 'DATA_POINT'; // data point identifier
                    this.pointGroup.push(point);
                    slice.add(point);
                }); // points groups end

            }); // slices group end

        }); // complete group end

        // cube filter update
        this.filterData(this.filterCat, this.dm.getMinDate(), this.dm.getMaxDate());
    }

    getSetLabel(group: any, position: Array<number>) {
        // FIXME: This function duplicates the label construction in the constructor and is never called
        // Can we safely remove it ?

        // CSS 3D SET LABELS
        const element = document.createElement('div');
        element.innerHTML = group;
        element.className = 'set-label';
        element.style.fontSize = 'smaller';
        element.style.color = 'grey';

        // CSS Object
        // let label = new THREE.CSS3DObject(element);
        const label = new THREE.CSS3DSprite(element);
        // label.position.set(position[1], CUBE_CONFIG.HEIGHT, position[2]);
        label.position.x = position[0] + CUBE_CONFIG.WIDTH / 2;
        label.position.y = CUBE_CONFIG.HEIGHT / 2 + 20;
        label.position.z = position[1] + CUBE_CONFIG.WIDTH / 2;

        // label.rotation.set(Math.PI);

        label.name = `LABEL_${group}`;
        this.cubeGroupCSS.add(label);
    }

    // Add force-directed layout
    // https://bl.ocks.org/lorenzopub/af1bc8b10e82f4ec8bff27673ef21a13

    forceClusterGraph(): void {
        const state = {
            numDimensions: 3,
            warmUpTicks: 0,
            coolDownTicks: Infinity,
            coolDownTime: 15000
        };
        const d3Nodes = this.pointGroup;
        const groups = this.getCircleLayout(this.setMap, 0, 0, 180);
        const m = groups.length;
        const clusters = new Array(m);
        const radius = 150;

        d3Nodes.map(function(data) {

            const clust = groups.forEach((cat) => {
                if (cat.cat === data.data.category_1) {
                    data.cluster = cat.cat.cluster;
                }
            });

            let i = data.cluster,
                r = 2,
                d = {
                    cluster: data.cluster,
                    radius: r,
                    x: Math.cos(i / m * 2 * Math.PI) * 150 + CUBE_CONFIG.WIDTH / 2 + Math.random(),
                    y: Math.sin(i / m * 2 * Math.PI) * 150 + CUBE_CONFIG.HEIGHT / 2 + Math.random()
                };

            if (!clusters[i] || (r > clusters[i].radius)) { clusters[i] = d; }
            return d;
        });

        const layout = D3.forceSimulation()
            .nodes(d3Nodes)
            .force('charge', D3.forceManyBody().strength(20))
            .force('center', D3.forceCenter(0, 0))
            // cluster by section
            .force('cluster', forceCluster().centers(function(d) { return clusters[d.cluster]; }))
            .stop();

        for (let i = 0; i < state.warmUpTicks; i++) { layout.tick(); } // Initial ticks before starting to render

        let cntTicks = 0;
        const startTickTime = new Date().getTime();
        layout.on('tick', layoutTick).restart();

        function layoutTick() {
            if (cntTicks++ > state.coolDownTicks || (new Date().getTime()) - startTickTime > state.coolDownTime) {
                layout.stop(); // Stop ticking graph
            }
            // console.log(d3Nodes);

            // Update nodes position
            d3Nodes.forEach(node => {

                const sphere = node;
                // sphere.position.x = node.x || 0;
                // // sphere.position.y = node.y || 0;
                // sphere.position.z = node.y || 0;

                sphere.position.x = node.x * 20 || 0;
                // sphere.position.y = node.y || 0;
                sphere.position.z = node.y * 20 || 0;
            });
            // requestAnimationFrame(layoutTick);
        }
    }

    render(): void {
        // create a box and add it to the scene
        this.cubeGroupGL.name = 'SET_CUBE';
        this.cubeGroupGL.position.set(CUBE_CONFIG.WIDTH + CUBE_CONFIG.GUTTER, 0, 0);
        this.webGLScene.add(this.cubeGroupGL);
        this.cssScene.add(this.cubeGroupCSS); // add css group to css scene
    }

    clearLabels(): void {
        const removed = new Array<THREE.CSS3DObject>();
        this.cubeGroupCSS.children.forEach((child: THREE.CSS3DObject) => {
            if (child.name.includes('SET_LABEL')) { removed.push(child); }
        });
        removed.forEach((r: THREE.CSS3DObject) => { this.cubeGroupCSS.remove(r); });
    }

    hideLabels(): void {
        this.cubeGroupCSS.traverse((object: THREE.Object3D) => {
            if (object.name.includes('SET_LABEL')) { this.hiddenLabels.push(object); }
        });

        this.hiddenLabels.forEach((r: THREE.CSS3DObject) => { this.cubeGroupCSS.remove(r); });
    }

    showLabels(): void {
        this.hiddenLabels.forEach((object: THREE.CSS3DObject) => {
            this.cubeGroupCSS.add(object);
        });

        this.hiddenLabels = new Array<THREE.CSS3DObject>();
    }


    clearSetLabels(): void {
        this.cubeGroupCSS.children.forEach((child: THREE.CSS3DObject) => {
            if (child.name.includes('SET_LABEL')) {
                child.visible = false;
            }
        });

        D3.selectAll('.set-label')
            .style('display', 'none');
    }

    updateLayout(layout: string): void {
        const segs = this.dm.timeRange.length;
        if (layout === 'cluster') { // just for testing cluster force in UI
            // console.log('cluster')
            this.forceClusterGraph();
        } else {
            this.updateSetCube(segs, true, layout);
        }

        // update hull
        this.hullState = false;
    }

    getLayouts(layout: string, category: any, circle: THREE.Mesh) {
        const circleLayout = this.getCircleLayout(this.setMap, 0, 0, 180);
        const packLayout = this.getPackLayout();

        if (layout === 'circle') {
            return circleLayout.forEach((d) => {
                if (d.cat === category.key) {
                    circle.position.x = d.y;
                    circle.position.z = d.x;
                }
            });
        }

        if (layout === 'pack') {
            packLayout.forEach((d) => {
                if (d.cat === category.key) {
                    circle.position.x = d.x;
                    circle.position.z = d.y;
                }
            });
        }
    }

    updateTime(time: string): void {
        this.cubeGroupGL.children.forEach((child: THREE.Group) => {
            if (child.type !== 'Group') { return; }

            child.children.forEach((grandChild: any) => {
                if (grandChild.type !== 'DATA_POINT') { return; }
                const sliceOffsetY = child.position.y;
                grandChild.position.y = time === 'aggregated' ? 0 : this.timeLinearScale(grandChild.data.date_time) - sliceOffsetY;
            });
        });
    }

    toggleDisplayCube(): void {
        this._cubeToggle = !this._cubeToggle;
    }

    updateView(currentViewState: VIEW_STATES): void {
        if (this._cubeToggle) {
            this.webGLScene.add(this.cubeGroupGL);
            this.showBottomLayer();
            this.showLabels();
        }
    }

    updateNumSlices(): void {
        const segs = this.dm.timeRange.length;
        this.updateSetCube(segs, true);
        // update hull
        this.hullState = false;
    }

    updateColorCoding(encoding: string): void {
        this.colorCoding = encoding;
        switch (encoding) {
            case 'categorical':
                this.colors = this.dm.colors; // D3.scaleOrdinal(D3.schemePaired);
                break;
            case 'temporal':
                this.colors = D3.scaleSequential(D3.interpolateViridis).domain([this.dm.getMinDate(), this.dm.getMaxDate()]);
                break;
            case 'monochrome':
                this.colors = D3.scaleOrdinal(D3.schemeSet2);
                break;

            default:
                this.colors = this.dm.colors; // D3.scaleOrdinal(D3.schemePaired);
                break;
        }
    }

    updateNodeColor(encoding: string): void {
        this.updateColorCoding(encoding);
        this.cubeGroupGL.children.forEach((child: THREE.Group) => {
            if (child.type !== 'Group') { return; }

            child.children.forEach((grandChild: any) => {
                if (grandChild.type !== 'DATA_POINT') { return; }
                switch (encoding) {
                    case 'categorical':
                        grandChild.material.color.set(this.colors(grandChild.data.category_1));
                        break;
                    case 'temporal':
                        grandChild.material.color.set(this.colors(grandChild.data.date_time));
                        break;
                    case 'monochrome':
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
        const scale = 1 + radius * 0.1;
        const targetScale = {
            x: scale,
            y: scale,
            z: scale
        };

        this.cubeGroupGL.children.forEach((child: THREE.Group) => {
            if (child.type !== 'Group') { return; }

            child.children.forEach((grandChild: any) => {
                if (grandChild.type !== 'DATA_POINT') { return; }

                const sourceScale = {
                    x: grandChild.scale.x,
                    y: grandChild.scale.y,
                    z: grandChild.scale.z,
                };

                const tween = new TWEEN.Tween(sourceScale)
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

    dateWithinInterval(startDate: Date, endDate: Date, pointDate: Date): boolean {
        if (!startDate) { startDate = this.dm.getMinDate(); }
        if (!endDate) { endDate = this.dm.getMaxDate(); }
        return moment(pointDate) >= moment(startDate) && moment(pointDate) <= moment(endDate);
    }

    filterData(cat: string, start: Date, end: Date): void {
        this.cubeGroupGL.children.forEach((child: THREE.Group) => {
            if (child.type !== 'Group') { return; }

            child.children.forEach((grandChild: any) => {
                if (grandChild.type !== 'DATA_POINT') { return; }
                grandChild.visible = true;
                if (!(this.dateWithinInterval(start, end, grandChild.data.date_time) && (cat === '' ? true : grandChild.data.category_1 === cat))) {
                    grandChild.visible = false;
                }
            });
        });
        
        // update global category
        this.filterCat = cat;
    }


    transitionSTC(): void {
        if (!this._cubeToggle) { return; }
        this.showBottomLayer();
        this.boundingBox.visible = true;
        // TODO:on STC, update setcube with stacked layers
        this.updateColorCoding('categorical');
        this.updateSetCube();

        const vertOffset = CUBE_CONFIG.HEIGHT / this.dm.timeRange.length; // FIXME: value is aways divided by 1
        let duration = 1000,
            tween;

        this.slices.forEach((slice: THREE.Group, i: number) => {
            const sourceCoords = {
                x: slice.position.x,
                y: slice.position.y,
                z: slice.position.z
            };

            const targetCoords = {
                x: CUBE_CONFIG.WIDTH / 2,
                y: this.timeLinearScale(moment(`${slice.name}`).toDate()),
                z: CUBE_CONFIG.WIDTH / 2
            };

            // labels

            const label = this.cubeGroupCSS.getObjectByName(`SET_LABEL_${i}`);
            D3.selectAll('.time-slice-label').style('opacity', '1');
            D3.selectAll('.set-label').style('opacity', '1'); // FIXME: This selection is empty because we have no elements with .set-label class
            label.position.x = targetCoords.x - CUBE_CONFIG.WIDTH / 2 - 22;
            label.position.y = targetCoords.y;
            label.position.z = targetCoords.z;
            label.rotation.set(0, 0, 0);

            tween = new TWEEN.Tween(sourceCoords)
                .to(targetCoords, duration)
                .delay(i * 300)
                .easing(TWEEN.Easing.Cubic.InOut)
                .onUpdate(() => {
                    slice.position.x = sourceCoords.x;
                    slice.position.y = sourceCoords.y,
                        slice.position.z = sourceCoords.z;
                })
                .start();
        }); // end forEach

        tween.onComplete(() => {
            // update nodecolor to categorical
            // this.updateNodeColor('categorical');
        });
        // show hull
        this.showHull();
    }

    transitionJP(): void {
        this.hideBottomLayer();
        if (!this._cubeToggle) { return; }
        // hide hull
        this.hideHull();
        // rerun scene and transition to JP
        const segs = this.dm.timeRange.length;
        this.updateSetCube(segs, true);
        // update hull
        this.hullState = false;

        // re run updateSet

        const vertOffset = CUBE_CONFIG.HEIGHT + 20;
        this.boundingBox.visible = false;
        this.slices.forEach((slice: THREE.Group, i: number) => {
            const sourceCoords = {
                x: slice.position.x,
                y: slice.position.y,
                z: slice.position.z
            };

            const targetCoords = {
                x: slice.position.x,
                y: -CUBE_CONFIG.HEIGHT / 2,
                z: (i * vertOffset) - (CUBE_CONFIG.HEIGHT / 2)
            };

            // label
            const label = this.cubeGroupCSS.getObjectByName(`SET_LABEL_${i}`);

            label.position.x = targetCoords.x - CUBE_CONFIG.HEIGHT / 2 - 22;
            label.position.y = targetCoords.y;
            label.position.z = targetCoords.z;
            label.rotation.set(-Math.PI / 2, 0, 0);

            const tween = new TWEEN.Tween(sourceCoords)
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
        // hide hull
        if (!this._cubeToggle) { return; }
        this.hideHull();
        this.hideBottomLayer();
        this.boundingBox.visible = false;
        let duration = 1000,
            tween;

        this.slices.forEach((slice: THREE.Group, i: number) => {
            const sourceCoords = {
                x: slice.position.x,
                y: slice.position.y,
                z: slice.position.z
            };

            const targetCoords = {
                x: CUBE_CONFIG.WIDTH / 2,
                y: -CUBE_CONFIG.HEIGHT / 2,
                z: CUBE_CONFIG.WIDTH / 2
            };

            tween = new TWEEN.Tween(sourceCoords)
                .to(targetCoords, duration)
                .delay(i * 300)
                .easing(TWEEN.Easing.Cubic.InOut)
                .onUpdate(() => {
                    slice.position.x = sourceCoords.x;
                    slice.position.y = sourceCoords.y,
                        slice.position.z = sourceCoords.z;
                })
                .start();
        });

        // on complete tweening, update setcube with flattened layers
        tween.onComplete(() => {
            this.updateSetCube(1);
            // update node colors to temporal
            this.updateNodeColor('temporal');
            this.hideLabels();
        });
    }

    transitionANI(): void { }

    getCubePosition(): THREE.Vector3 {
        const positionInWorld = new THREE.Vector3();
        this.cubeGroupGL.getWorldPosition(positionInWorld);
        return positionInWorld;
    }

    getCurrentColor(object: THREE.Object3D): string {
        switch (this.colorCoding) {
            case 'categorical': return this.colors(object.data.category_1);
            case 'temporal': return this.colors(object.data.date_time);
            case 'monochrome': return '#cc1414';
            default: return this.colors(object.data.category_1);
        }
    }

    resetCategorySelection(gray: boolean = false): void {
        this.cubeGroupGL.children.forEach((child: any) => {
            if (child.type !== 'Group') { return; }

            child.children.forEach((grandChild: any) => {
                if (grandChild.type !== 'DATA_POINT') { return; }
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
            if (child.type !== 'Group') { return; }

            child.children.forEach((grandChild: any) => {
                if (grandChild.type !== 'DATA_POINT') { return; }

                grandChild.scale.set(1, 1, 1);
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
        this.mouse.x = (($event.clientX - container.offsetLeft) / container.clientWidth) * 2 - 1;
        this.mouse.y = -(($event.clientY - container.offsetTop) / container.clientHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersections = this.raycaster.intersectObjects(this.cubeGroupGL.children, true);

        for (let i = 0; i < intersections.length; i++) {
            const selectedObject = intersections[i].object;
            if (selectedObject.type !== 'DATA_POINT') { continue; }
            // get first intersect that is a data point
            // tooltip.nativeElement.style.display = 'block';
            // tooltip.nativeElement.style.opacity = '.9';
            // tooltip.nativeElement.style.top = `${$event.pageY}px`;
            // tooltip.nativeElement.style.left = `${$event.pageX}px`;
            // tooltip.nativeElement.innerHTML = selectedObject.data.description;
            return selectedObject.data;
        }
        this.resetSelection();
        return null;
    }


    highlightObject(id: string): void {
        this.resetSelection(true);

        const highlighted = this.cubeGroupGL.getObjectByName(id);

        if (highlighted) {
            highlighted.material.color.setHex(0xff0000);
            highlighted.scale.set(2, 2, 2);
        }
    }

    onDblClick($event: any): void {

    }

    // function to get circle layout, pass Sets, center x and y and radius
    getCircleLayout(group_list, x0: number = 0, y0: number = 0, r: number = 20) {

        let items = Array.from(group_list);
        let circleLayout = [];

        for (let i = 0; i < items.length; i++) {
            let x = x0 + r * Math.cos(2 * Math.PI * i / items.length);
            let y = y0 + r * Math.sin(2 * Math.PI * i / items.length);
            circleLayout.push({ cat: items[i], x, y, cluster: i });
        }
        return circleLayout;
    }

    getPackLayout() {
        const groupedData = D3.nest()
            .key((d: any) => d.category_1)
            .entries(this.dm.data)
            .map(function(d) {
                return { Category: d.key, Value: d.values.length };
            });
        const data = { name: 'groups', children: groupedData };
        const vLayout = D3.pack().size([CUBE_CONFIG.WIDTH, CUBE_CONFIG.HEIGHT]);

        let vRoot = D3.hierarchy(data).sum(function(d: any) { return d.Value; }).sort(function(a, b) { return b.value - a.value; }); ;

        let vNodes = vRoot.descendants();
        const layout = vLayout(vRoot).children.map((d: any) => {
            return { cat: d.data.Category, x: d.x - CUBE_CONFIG.WIDTH / 2, y: d.y - CUBE_CONFIG.HEIGHT / 2, count: d.value, r: d.r };
        });

        return layout;
    }

    // function to get spiral spread of points accross a single category in time, pass center x and y, radius and group array
    getSpiralPosition(centerX: number, centerY: number, radius: number, group_list) {

        const sides = group_list.length,
            coils = 2,
            rotation = 2 * (Math.PI / 180);

        // How far to step away from center for each side.
        const awayStep = radius / sides;

        // How far to rotate around center for each side.
        const aroundStep = coils / sides; // 0 to 1 based.

        // Convert aroundStep to radians.
        const aroundRadians = aroundStep * (Math.PI / 180);
        let new_time = [];

        // sort group by years
        group_list.sort(function(a, b) {
            return a.year == b.year ? 0 : +(a.year > b.year) || -1;
        });

        // For every side, step around and away from center.
        for (let i = 0; i < sides; i++) {
            // How far away from center
            const away = (i * awayStep);

            // How far around the center.
            const around = i + aroundRadians * rotation;

            // Convert 'around' and 'away' to X and Y.
            const x = centerX + Math.sin(around) * away;
            const y = centerY + Math.cos(around) * away;

            new_time.push({ x, y, data: group_list[i] });
        }

        return new_time;
    }

    getPhyllotaxis(centerX: number, centerY: number, radius: number, data: any) {

        data.sort((a: any, b: any) => {

            a = Date.parse(a.date_time),
                b = Date.parse(b.date_time);

            return a == b ? 0 : +(a > b) || -1;
        }
        );


        let theta = Math.PI * (3 - Math.sqrt(5)),
            spacing = 3,
            // size = spacing - 1,
            // speed = 1,
            index = 0;
        // total = (radius * radius) / (spacing * spacing);
        let new_time = [];

        // For every side, step around and away from center.
        for (let i = 0; i < data.length; i++) {
            let radius = spacing * Math.sqrt(++index),
                angle = index * theta;

            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);

            new_time.push({ x, y, data: data[i] });
        }

        return new_time;
    }

    drawHull() {
        // empty hull group
        this.hullGroup.children = [];

        const categories = Array.from(this.setMap);
        categories.forEach((d) => {
            this.geometryConvex(d);
        });

        // hull state
        this.hullState = true;

        this.uncertainHull();
    }

    geometryConvex(group = 'Identification photographs') {
        const vertices = [];
        this.circleGroup.forEach((child: any) => {
            if (child.name === group) {
                let array_aux = [];
                child.geometry.vertices.forEach((d) => {
                    array_aux.push(child.localToWorld(d));
                });
                vertices.push(array_aux);
            }
        });

        vertices.forEach((d, i) => {
            let meshData;
            if (i !== vertices.length - 1) { // if to deal with last component structure
                meshData = vertices[i].concat(vertices[i + 1]);

                // const top = Math.abs(meshData[0].y);
                // const bottom = Math.abs(meshData[meshData.length - 1].y);
                // const gap = Math.abs(top - bottom);

                this.addHullToScene(meshData);

            }
        });
    }

    addHullToScene(vertices) {
        const wireFrameMat = new THREE.MeshBasicMaterial({
            color: '#a2a2a2', transparent: true, opacity: 0.3,
            // ***** Clipping setup (material): *****
            clippingPlanes: [],
            clipShadows: true,
            wireframe: true
        });

        const meshGeometry = new THREE.ConvexBufferGeometry(vertices);

        const mesh = new THREE.Mesh(meshGeometry, wireFrameMat);

        // calibrate the cubleft border
        mesh.position.set(-this.cubeLeftBoarder, 0, 0);
        // this.cubeGroupGL.add(mesh);
        this.hullGroup.add(mesh);
    }


    getHullState(): boolean {
        return this.hullState;
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

    hideBottomLayer(): void {
        const bottomLayer = document.getElementById('div_container_setcube');
        if (bottomLayer) { bottomLayer.style.opacity = '0'; }
    }

    showBottomLayer(): void {
        const bottomLayer = document.getElementById('div_container_setcube');
        if (bottomLayer) { bottomLayer.style.opacity = '1'; }
    }

    hideHull() {
        // hide hull
        this.hullGroup.visible = false;
    }

    showHull() {
        // show hull
        this.hullGroup.visible = true;
    }

    uncertainHull() {
        const vertOffset = CUBE_CONFIG.HEIGHT / this.dm.timeRange.length;
        this.hullGroup.children.forEach((mesh: THREE.Mesh) => {

            const box = new THREE.Box3().setFromObject(mesh);
            const size = box.getSize(new THREE.Vector3());

            if (size.y > (vertOffset + 5)) {
                // console.log( mesh);

                mesh.material.color.setHex('0x2194ce');
                mesh.material.opacity = 0.1;
                mesh.material.wireframe = false;
                mesh.material.wireframeLinewidth = 6;
                // mesh.material.vertexColors = THREE.vertexColors;

                // mesh.visible = false;
            }
        });
    }


    getSetScale() {
        const groupedData = D3.nest()
            .key((d: any) => d.category_1)
            .entries(this.dm.data)
            .map(function(d) {
                return { Category: d.key, Value: d.values.length };
            });

        return groupedData;
    }

}
