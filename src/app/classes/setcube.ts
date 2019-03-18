import { PolyCube } from './polycube.interface';
import { DataManager } from './datamanager';
import * as THREE from 'three-full';
import { VIEW_STATES } from './viewStates';
import { CUBE_CONFIG } from '../cube.config';
import * as D3 from 'd3';
import * as moment from 'moment';

export class SetCube implements PolyCube {
    cubeGroupGL: THREE.Group;
    cubeGroupCSS: THREE.Group;

    // Data
    private dm: DataManager;
    private camera: THREE.Camera;
    private data: Array<any>;
    private setMap: Set<string>;

    private webGLScene: THREE.Scene;
    private cssScene: THREE.Scene;
    private colors: D3.ScaleOrdinal<string, string>;
    private timeLinearScale: D3.ScaleLinear<number, number>;

    private slices: Array<THREE.Group>;


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
    }

    assembleData(): void {
        this.dm.data.forEach((d: any) => {
            this.setMap.add(d.category_1);
            //store quantized time 
            d.groupDate = moment((this.dm.getTimeQuantile(d.date_time)), 'YYYY').toDate()
        });
        // this.timeLinearScale(some_date) gives us the vertical axis coordinate of the point
        //this is currently not alligned with the geo time layers position
        this.timeLinearScale = this.dm.getTimeLinearScale();

        //group by time and then category
        // run layout simulations and store group positions for other time layers 
        let groupedData = D3.nest()
            .key((d: any) => { return moment(d.groupDate).format('YYYY') })
            .key((d: any) => { return d.category_1 })
            .entries(this.dm.data)
            .sort((a: any, b: any) => { return a.key == b.key ? 0 : +(a.key > b.key) || -1; })

        // console.log(this.setMap)
        //add geometry points
        let pointGeometry = new THREE.SphereGeometry(1, 32, 32);
        let vertOffset = CUBE_CONFIG.WIDTH / groupedData.length;

        groupedData.forEach((timeLayer: any, i: number) => {

            // console.log(this.getCircleLayout(this.setMap))

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
            slice.position.set(CUBE_CONFIG.WIDTH / 2, (i * vertOffset) - (CUBE_CONFIG.WIDTH / 2), CUBE_CONFIG.WIDTH / 2);
            slice.add(plane);
            this.slices.push(slice);
            this.cubeGroupGL.add(slice)

            // each category inside each time slice
            timeLayer.values.forEach((category) => {
                // draw group geometries

                //circle geometry
                const rad = category.values.length / 2;//ral: size of the big circles
                const geometry = new THREE.CircleGeometry(rad, 32);//hull resolution
                const material = new THREE.MeshBasicMaterial({
                    color: '#d0d0d0',
                    // color: colorScale(data.key),
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
                circle.position.x = Math.random() * CUBE_CONFIG.WIDTH / 2; //need to be fixed for the differente layouts
                circle.position.z = Math.random() * CUBE_CONFIG.WIDTH / 2;
                circle.position.y = (i * vertOffset) - (CUBE_CONFIG.WIDTH / 2);
                this.cubeGroupGL.add(circle)
    
                //add points after each category
                let parentPos = circle.position;

                //get this category points positions
                let spiralCategory = this.getSpiralPosition(parentPos.x, parentPos.z, rad, category.values)

                spiralCategory.forEach((points) => {

                    const material = new THREE.MeshBasicMaterial({ color: this.colors(points.data.category_1) });
                    const sphere = new THREE.Mesh(pointGeometry, material);
                    //deprecated
                    // sphere.position.y = this.timeLinearScale(points.groupDate);
                    sphere.position.y = parentPos.y;

                    // console.log(points)

                    sphere.position.x = points.x;
                    sphere.position.z = points.y;

                    this.cubeGroupGL.add(sphere);
                })

            })

        })

        // for (let i = 0; i < this.dm.data.length; i++) {
        //     let dataItem = this.dm.data[i];
        //     // TODO: consider just updating color property of material if you ever find out how to do it
        //     let material = new THREE.MeshBasicMaterial({ color: this.colors(dataItem.category_1) });

        //     let sphere = new THREE.Mesh(geometry, material);
        //     //deprecated
        //     sphere.position.y = this.timeLinearScale(dataItem.groupDate);

        //     // console.log(dataItem)

        //     sphere.position.x = Math.random() * CUBE_CONFIG.WIDTH;
        //     sphere.position.z = Math.random() * CUBE_CONFIG.WIDTH;

        //     this.cubeGroupGL.add(sphere);
        // }
    }

    render(): void {
        // create a box and add it to the scene
        let boxHelper = new THREE.BoxHelper(this.cubeGroupGL, 0x000000);
        this.cubeGroupGL.name = 'SET_CUBE';
        this.cubeGroupGL.add(boxHelper);
        this.cubeGroupGL.position.set(CUBE_CONFIG.WIDTH + CUBE_CONFIG.GUTTER, 0, 0);
        this.webGLScene.add(this.cubeGroupGL);
    }


    update(currentViewState: VIEW_STATES): void {
        if (currentViewState.valueOf() === VIEW_STATES.SET_CUBE || currentViewState.valueOf() === VIEW_STATES.POLY_CUBE) {
            this.webGLScene.add(this.cubeGroupGL);
        }
    }

    updateData(): void {

    }


    transitionSTC(): void { }
    transitionJP(): void { }
    transitionSI(): void { }
    transitionANI(): void { }


    getCubePosition(): THREE.Vector3 {
        const positionInWorld = new THREE.Vector3();
        this.cubeGroupGL.getWorldPosition(positionInWorld);
        return positionInWorld;
    }

    onClick($event: any): void {

    }

    onDblClick($event: any): void {

    }

    getCircleLayout(group_list) {

        // let newGroup_list = [...group_list]

        console.log(Array.from(group_list))

        // [...group_list].sort(function (one, other) {
        //     //a - b is
        //     //   0 when elements are the same
        //     //  >0 when a > b
        //     //  <0 when a < b
        //     return one.values.length - other.values.length;
        // });

        // let fraction = (2 * Math.PI) / group_list.length;
        // let current_pos = 0;
        // let r = 20;
        // let posX = r * Math.cos(current_pos);
        // let posY = r * Math.sin(current_pos);

        // group_list.forEach(function (d) {
        //     d.x = posX;
        //     d.y = posY;
        //     current_pos += fraction;
        //     posX = r * Math.cos(current_pos);
        //     posY = r * Math.sin(current_pos);
        // })

        // return group_list

    }

    getSpiralPosition(centerX: number, centerY: number, radius: number, group_list) {

        let sides = group_list.length,
            coils = 2,
            rotation = 2 * (Math.PI / 180);

        // How far to step away from center for each side.
        let awayStep = radius / sides;
        // let awayStep = 1.2;

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
            // let away = (i + 0.1);

            // How far around the center.
            let around = i + aroundRadians * rotation;

            // Convert 'around' and 'away' to X and Y.
            let x = centerX + Math.sin(around) * away;
            let y = centerY + Math.cos(around) * away;

            new_time.push({ x: x, y: y, data: group_list[i] });
        }

        return new_time
    }

    hideBottomLayer(): void { }
    showBottomLayer(): void { }
}
