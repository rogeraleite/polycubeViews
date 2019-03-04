import * as DAT from 'dat-gui';

export class GUI {
    geoBtn: HTMLElement;
    setBtn: HTMLElement;
    netBtn: HTMLElement;
    polyBtn: HTMLElement;
    constructor() {
        this.geoBtn = document.getElementById('geo-view-button');
        this.setBtn = document.getElementById('set-view-button');
        this.netBtn = document.getElementById('net-view-button');
        this.polyBtn = document.getElementById('poly-view-button');
    }
}