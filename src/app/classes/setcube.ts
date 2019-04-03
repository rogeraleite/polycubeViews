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

export class SetCube implements PolyCube {
    cubeGroupGL: THREE.Group;
    cubeGroupCSS: THREE.Group;

    // Data
    private dm: DataManager;
    private camera: THREE.Camera;
    private data: Array<any>;
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
    private colorCoding: string = 'categorical';

    constructor(dm: DataManager, camera: THREE.Camera, webGLScene: THREE.Scene, cssScene: THREE.Scene) {
        this.dm = dm;
        this.webGLScene = webGLScene;
        if (cssScene) { this.cssScene = cssScene; }
        this.data = new Array<any>();
        this.setMap = new Set<any>();
        this.camera = camera;
        this.createObjects();
        this.assembleData();
        this.render();
    }

    createObjects(): void {
        this.cubeGroupGL = new THREE.Group();
        this.cubeGroupCSS = new THREE.Group();
        this.colors = D3.scaleOrdinal(D3.schemePaired);
        this.slices = new Array<THREE.Group>();

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();


        let placeholderBox = new THREE.Mesh(
            new THREE.BoxGeometry(CUBE_CONFIG.WIDTH, CUBE_CONFIG.WIDTH, CUBE_CONFIG.WIDTH),
            new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        );
        placeholderBox.position.set(CUBE_CONFIG.WIDTH / 2, 0, CUBE_CONFIG.WIDTH / 2);
        this.boundingBox = new THREE.BoxHelper(placeholderBox, '#b5b5b5');
        this.boundingBox.name = 'BOX_HELPER';
        this.cubeGroupGL.add(this.boundingBox);
    }

    assembleData(): void {
        this.updateSetCube(this.dm.timeRange.length, true);
    }

    //pass new slices numer and run the simulation again
    updateSetCube(segs: number = this.dm.timeRange.length, initial: boolean = false): void {

        //clean function
        //clear scene of old objects
        this.slices.forEach((slice: THREE.Group) => { this.cubeGroupGL.remove(slice); });
        this.slices = new Array<THREE.Group>();

        this.dm.data.forEach((d: any) => {
            this.setMap.add(d.category_1); //TODO: pass the count size of each category
            //store quantized time 
            d.groupDate = moment((this.dm.getCustomTimeQuantile(d.date_time, segs)), 'YYYY').toDate()
        });

        // this.timeLinearScale(some_date) gives us the vertical axis coordinate of the point
        // this.timeLinearScale = this.dm.getTimeLinearScale();

        //group by time and then category
        let groupedData = D3.nest()
            .key((d: any) => { return moment(d.groupDate).format('YYYY') })
            .key((d: any) => { return d.category_1 })
            .entries(this.dm.data)
            .sort((a: any, b: any) => { return a.key == b.key ? 0 : +(a.key > b.key) || -1; })

        //add geometry points
        let pointGeometry = new THREE.SphereGeometry(CUBE_CONFIG.NODE_SIZE, 32, 32);
        let vertOffset = CUBE_CONFIG.WIDTH / this.dm.timeRange.length;

        //layouts
        let circleLayout = this.getCircleLayout(this.setMap, 0, 0, 180)
        let packLayout = this.getPackLayout()


        groupedData.forEach((timeLayer: any, i: number) => { // complete group

            // flat planes for JP
            const geometry = new THREE.PlaneGeometry(CUBE_CONFIG.WIDTH, CUBE_CONFIG.HEIGHT, 32);
            let edgeGeometry = new THREE.EdgesGeometry(geometry);
            let material = new THREE.LineBasicMaterial({ color: '#b5b5b5' });
            let plane = new THREE.LineSegments(edgeGeometry, material);
            plane.position.set(0, 0, 0);
            plane.rotation.set(Math.PI / 2, 0, 0);

            // time slices
            let slice = new THREE.Group();
            slice.name = timeLayer.key; // we need to decide either to use full date or
            slice.add(plane);
            slice.position.set(CUBE_CONFIG.WIDTH / 2, initial ? (i * vertOffset) - (CUBE_CONFIG.WIDTH / 2) : -CUBE_CONFIG.WIDTH / 2, CUBE_CONFIG.WIDTH / 2); // for initial run
            // slice.position.set(CUBE_CONFIG.WIDTH / 2, - (CUBE_CONFIG.WIDTH / 2), CUBE_CONFIG.WIDTH / 2); // for updates
            this.slices.push(slice);
            this.cubeGroupGL.add(slice)

            // each category inside each time slice
            timeLayer.values.forEach((category) => { //slices group
                // draw group geometries

                //circle geometry
                const rad = category.values.length / 2;//ral: size of the big circles
                const geometry = new THREE.CircleGeometry(rad, 32);//hull resolution
                const material = new THREE.MeshBasicMaterial({
                    color: '#d0d0d0',
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.7
                });
                const circle = new THREE.Mesh(geometry, material);
                const circleStc = new THREE.Object3D();

                circle.matrixWorldNeedsUpdate = true;
                circle.name = category.key;
                circle.rotation.x = Math.PI / 2;
                circle.name = timeLayer.key + category.key;

                //apply group positions
                circleLayout.forEach((d) => {
                    if (d.cat === category.key) {
                        circle.position.x = d.y
                        circle.position.z = d.x;
                    }
                });

                // packLayout.forEach((d) => {
                //     if (d.cat === category.key) {
                //         circle.position.x = d.x
                //         circle.position.z = d.y;
                //     }
                // });

                // this.cubeGroupGL.add(circle)
                slice.add(circle)

                //add points after each category
                let parentPos = circle.position;

                //get this category points positions
                let spiralCategory = this.getSpiralPosition(parentPos.x, parentPos.z, rad, category.values)

                spiralCategory.forEach((points) => { //points group 
                    const material = new THREE.MeshBasicMaterial({ color: this.colors(points.data.category_1) });
                    const point = new THREE.Mesh(pointGeometry, material);

                    point.position.y = parentPos.y;
                    point.position.x = points.x;
                    point.position.z = points.y;
                    point.name = points.data.id;
                    point.data = points.data;
                    point.type = 'DATA_POINT'; //data point identifier
                    slice.add(point)
                }) //points groups end

            }) //slices group end

        }) //complete group end
    }

    render(): void {
        // create a box and add it to the scene
        this.cubeGroupGL.name = 'SET_CUBE';
        this.cubeGroupGL.position.set(CUBE_CONFIG.WIDTH + CUBE_CONFIG.GUTTER, 0, 0);
        this.webGLScene.add(this.cubeGroupGL);
    }


    updateView(currentViewState: VIEW_STATES): void {
        if (currentViewState.valueOf() === VIEW_STATES.SET_CUBE || currentViewState.valueOf() === VIEW_STATES.POLY_CUBE) {
            this.webGLScene.add(this.cubeGroupGL);
        }
    }

    updateNumSlices(): void {
        const segs = this.dm.timeRange.length;
        this.updateSetCube(segs)
    }

    updateColorCoding(encoding: string): void {
        this.colorCoding = encoding;
        switch (encoding) {
            case 'categorical':
                this.colors = D3.scaleOrdinal(D3.schemePaired);
                break;
            case 'temporal':
                this.colors = D3.scaleSequential(D3.interpolateViridis).domain([this.dm.getMinDate(), this.dm.getMaxDate()]);
                break;
            case 'monochrome':
                this.colors = D3.scaleOrdinal(D3.schemeSet2);
                break;

            default:
                this.colors = D3.scaleOrdinal(D3.schemePaired);
                break;
        }
    }

    updateNodeColor(encoding: string): void {
        this.updateColorCoding(encoding);
        this.cubeGroupGL.children.forEach((child: THREE.Group) => {
            if (child.type !== 'Group') return;

            child.children.forEach((grandChild: any) => {
                if (grandChild.type !== 'DATA_POINT') return;
                switch (encoding) {
                    case 'categorical':
                        grandChild.material.color.set(this.colors(grandChild.data.category_1));
                        break;
                    case 'temporal':
                        grandChild.material.color.set(this.colors(grandChild.data.date_time));
                        break;
                    case 'monochrome':
                        grandChild.material.color.set('#b5b5b5');
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

    dateWithinInterval(startDate: Date, endDate: Date, pointDate: Date): boolean {
        return moment(pointDate) >= moment(startDate) && moment(pointDate) <= moment(endDate);
    }

    filterDataByDatePeriod(startDate: Date, endDate: Date): void {
        this.cubeGroupGL.children.forEach((child: THREE.Group) => {
            if (child.type !== 'Group') return;

            child.children.forEach((grandChild: any) => {
                if (grandChild.type !== 'DATA_POINT') return;
                grandChild.visible = true;
                if (!this.dateWithinInterval(startDate, endDate, grandChild.data.date_time)) grandChild.visible = false;
            });
        })
    }


    transitionSTC(): void {
        this.boundingBox.visible = true;
        //TODO:on STC, update setcube with stacked layers
        this.updateSetCube();

        let vertOffset = CUBE_CONFIG.HEIGHT / this.dm.timeRange.length; // FIXME: value is aways divided by 1

        this.slices.forEach((slice: THREE.Group, i: number) => {
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
    transitionJP(): void {
        let vertOffset = CUBE_CONFIG.HEIGHT + 20;
        this.boundingBox.visible = false;
        this.slices.forEach((slice: THREE.Group, i: number) => {
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
        this.boundingBox.visible = false;
        let duration = 1000,
            tween;

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

            tween = new TWEEN.Tween(sourceCoords)
                .to(targetCoords, duration)
                .delay(i * 300)
                .easing(TWEEN.Easing.Cubic.InOut)
                .onUpdate(() => {
                    slice.position.x = sourceCoords.x;
                    slice.position.y = sourceCoords.y,
                        slice.position.z = sourceCoords.z;
                })
                .start()
        });

        //on complete tweening, update setcube with flattened layers
        tween.onComplete(() => {
            console.log('complete')
            this.updateSetCube(1)
        })
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
            case 'monochrome': return '#b5b5b5';
            default: return this.colors(object.data.category_1)
        }
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


    highlightObject(id: string): void {
        this.resetSelection(true);

        let highlighted = this.cubeGroupGL.getObjectByName(id);

        if (highlighted) {
            highlighted.material.color.setHex(0xff0000);
            highlighted.scale.set(2, 2, 2);
        }
    }

    onDblClick($event: any): void {

    }

    // function to get circle layout, pass Sets, center x and y and radius
    getCircleLayout(group_list, x0: number = 0, y0: number = 0, r: number = 20) {

        let items = [...Array.from(group_list)]
        let circleLayout = [];

        for (var i = 0; i < items.length; i++) {
            var x = x0 + r * Math.cos(2 * Math.PI * i / items.length);
            var y = y0 + r * Math.sin(2 * Math.PI * i / items.length);
            circleLayout.push({ cat: items[i], x: x, y: y })
        }
        return circleLayout
    }

    getPackLayout() {
        let groupedData = D3.nest()
            .key((d: any) => { return d.category_1 })
            .entries(this.dm.data)
            .map(function (d) {
                return { Category: d.key, Value: d.values.length };
            });
        const data = { name: "groups", children: groupedData };
        let vLayout = D3.pack().size([CUBE_CONFIG.WIDTH, CUBE_CONFIG.HEIGHT]);
        var vRoot = D3.hierarchy(data).sum(function (d: any) { return d.Value; });
        var vNodes = vRoot.descendants();
        let layout = vLayout(vRoot).children.map((d: any) => {
            return { cat: d.data.Category, x: d.x - CUBE_CONFIG.WIDTH / 2, y: d.y - CUBE_CONFIG.HEIGHT / 2, count: d.value, r: d.r };
        })

        return layout
    }

    // function to get spiral spread of points accross a single category in time, pass center x and y, radius and group array
    getSpiralPosition(centerX: number, centerY: number, radius: number, group_list) {

        let sides = group_list.length,
            coils = 2,
            rotation = 2 * (Math.PI / 180);

        // How far to step away from center for each side.
        let awayStep = radius / sides;

        // How far to rotate around center for each side.
        let aroundStep = coils / sides;// 0 to 1 based.

        // Convert aroundStep to radians.
        let aroundRadians = aroundStep * (Math.PI / 180);
        let new_time = [];

        // sort group by years
        group_list.sort(function (a, b) {
            return a.year == b.year ? 0 : +(a.year > b.year) || -1;
        });

        // For every side, step around and away from center.
        for (let i = 0; i < sides; i++) {
            // How far away from center
            let away = (i * awayStep);

            // How far around the center.
            let around = i + aroundRadians * rotation;

            // Convert 'around' and 'away' to X and Y.
            let x = centerX + Math.sin(around) * away;
            let y = centerY + Math.cos(around) * away;

            new_time.push({ x: x, y: y, data: group_list[i] });
        }

        return new_time
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


    hideBottomLayer(): void { }
    showBottomLayer(): void { }
}
