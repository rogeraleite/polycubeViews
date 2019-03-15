import * as DAT from 'dat-gui';

export class GUI {
    geoBtn: HTMLElement;
    setBtn: HTMLElement;
    netBtn: HTMLElement;
    polyBtn: HTMLElement;

    stcBtn: HTMLElement;
    jpBtn: HTMLElement;
    siBtn: HTMLElement;
    aniBtn: HTMLElement;

    constructor() {
        this.geoBtn = document.getElementById('geo-view-button');
        this.setBtn = document.getElementById('set-view-button');
        this.netBtn = document.getElementById('net-view-button');
        this.polyBtn = document.getElementById('poly-view-button');

        this.stcBtn = document.getElementById('stc-view-button');
        this.jpBtn = document.getElementById('jp-view-button');
        this.siBtn = document.getElementById('si-view-button');
        this.aniBtn = document.getElementById('ani-view-button');
    }
}