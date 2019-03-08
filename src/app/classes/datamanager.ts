import * as D3 from 'd3';
import * as moment from 'moment';
import { CUBE_CONFIG } from '../cube.config';

export class DataManager {
    private _data: Array<any>;
    private _data_map: any;
    private timeLinearScale: D3.ScaleLinear<number, number>;

    constructor() {
        this._data = new Array<any>('green', 'red', 'blue');
        this._data_map = new Map();
    }

    get data(): Array<any> {
        return this._data;
    }

    set data(data: Array<any>) {
        this._data = data;
        this.timeLinearScale = D3.scaleLinear()
                                 .domain(this.getTimeExtentAsDate())
                                 .range([-CUBE_CONFIG.WIDTH/2, CUBE_CONFIG.WIDTH/2]);
    }

    getTimeLinearScale(): D3.ScaleLinear<number, number> {
        return this.timeLinearScale;
    }

    private getTimeExtentAsDate(): Array<Date> {
        return D3.extent(this._data, (d: any) => {
            return d.date_time;
        });
    }

    private getTimeExtentAsUnix(): Array<Number> {
        return D3.extent(this._data, (d: any) => {
            return moment(d.date_time).unix();
        });
    }
}//end class