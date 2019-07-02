import * as DAT from 'dat-gui';
import { CUBE_CONFIG } from '../cube.config';
import { EventEmitter } from 'events';

export class GUI {
    gui: DAT.GUI;

    geoBtn: HTMLElement;
    setBtn: HTMLElement;
    netBtn: HTMLElement;
    polyBtn: HTMLElement;

    stcBtn: HTMLElement;
    jpBtn: HTMLElement;
    siBtn: HTMLElement;

    pCubeConfigEmitter: EventEmitter;
    gCubeConfigEmitter: EventEmitter;
    sCubeConfigEmitter: EventEmitter;
    nCubeConfigEmitter: EventEmitter;

    constructor() {
        this.pCubeConfigEmitter = new EventEmitter();
        this.gCubeConfigEmitter = new EventEmitter();
        this.sCubeConfigEmitter = new EventEmitter();
        this.nCubeConfigEmitter = new EventEmitter();
        
        this.geoBtn = document.getElementById('geo-view-button');
        this.setBtn = document.getElementById('set-view-button');
        this.netBtn = document.getElementById('net-view-button');
        
        this.stcBtn = document.getElementById('stc-view-button');
        this.jpBtn = document.getElementById('jp-view-button');
        this.siBtn = document.getElementById('si-view-button');
       
        this.gui = new DAT.GUI();
        this.createDATGUI();
    }

    createDATGUI(): void {

        //camera

        // polycube
        let pCubeParams = {
            reset: function(){ 
            },
            numSlices: 10,
            backgroundColor: '#ffffff',
            nodeColor: 'categorical', // temporal (viridis), monochrome (gray)
            time: 'aggregated',
            nodeSize: CUBE_CONFIG.NODE_SIZE,
            dataSet: CUBE_CONFIG.DATA_SET.name,
            cameraType: 'Perspective'
        };
        let pCubeFolder = this.gui.addFolder('Global Settings');

        pCubeFolder.add(pCubeParams, 'numSlices').min(1).max(50).step(1)
        .onChange(() => {
            this.pCubeConfigEmitter.emit('processing', true);
        })
        .onFinishChange(() => {
            this.pCubeConfigEmitter.emit('change', {
                numSlices: Math.floor(pCubeParams.numSlices)
            });
        });
        pCubeFolder.add(pCubeParams, 'nodeSize').min(1).max(10).step(1).onChange(() => {
            this.pCubeConfigEmitter.emit('change', {
                nodeSize: Math.floor(pCubeParams.nodeSize)
            });
        });
        pCubeFolder.add(pCubeParams, 'time', ['aggregated', 'absolute']).onChange(() => {
            this.pCubeConfigEmitter.emit('change', {
                time: pCubeParams.time
            });
        });
        pCubeFolder.add(pCubeParams, 'nodeColor', ['categorical', 'temporal', 'monochrome']).onChange(() => {
            this.pCubeConfigEmitter.emit('change', {
                nodeColor: pCubeParams.nodeColor
            });
        });
        pCubeFolder.add(pCubeParams, 'dataSet', ['Cushman', 'Alliances', '?']).onChange(() => {
            this.pCubeConfigEmitter.emit('change', {
                dataSet: pCubeParams.dataSet
            });
        });
        
        pCubeFolder.add(pCubeParams, 'cameraType', ['Perspective', 'Orthographic']).onChange(() => {
            this.pCubeConfigEmitter.emit('change', {
                cameraType: pCubeParams.cameraType
            });
        });

        pCubeFolder.addColor(pCubeParams, 'backgroundColor').onChange(() => {
            this.pCubeConfigEmitter.emit('change', {
                backgroundColor: pCubeParams.backgroundColor
            });
        });

        pCubeFolder.add(pCubeParams, 'reset').onChange(()=>{
            this.pCubeConfigEmitter.emit('change', {
                reset: pCubeParams.reset
            });
        });

        
        // GeoCube settings
        let gCubeParams = {
            jitter: 0,

        };
        let gCubeFolder = this.gui.addFolder('GeoCube');

        gCubeFolder.add(gCubeParams, 'jitter').min(0).max(30).step(1).onChange(() => {
            this.gCubeConfigEmitter.emit('change', {
                jitter: Math.floor(gCubeParams.jitter)
            }); 
        });

        // SetCube settings
        let sCubeParams = {
            layout: ['circle'],
            hull: false
        };

        let sCubeFolder = this.gui.addFolder('SetCube');

        sCubeFolder.add(sCubeParams, 'layout', ['circle', 'pack', 'cluster']).onChange(() => {
            this.sCubeConfigEmitter.emit('change', {
                sLayout: sCubeParams.layout
            });
        });

        sCubeFolder.add(sCubeParams, 'hull').onChange(() => {
            this.sCubeConfigEmitter.emit('change', {
                hull: sCubeParams.hull
            });
        });

        // NetCube settings
        let nCubeFolder = this.gui.addFolder('NetCube');

    }
    
}