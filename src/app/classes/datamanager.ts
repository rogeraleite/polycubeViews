import * as D3 from 'd3';
import * as moment from 'moment';
import { CUBE_CONFIG } from '../cube.config';

export class DataManager {
    private _data: Array<any>;
    private _data_map: any;
    
    private timeLinearScale: D3.ScaleLinear<number, number>;
    
    private MIN_DATE: Date;
    private MAX_DATE: Date;

    constructor() {
        this._data = new Array<any>('green', 'red', 'blue');
        this._data_map = new Map();
    }

    get data(): Array<any> {
        return this._data;
    }

    set data(data: Array<any>) {
        this._data = data;
        this.MIN_DATE = this.getTimeExtentAsDate()[0];
        this.MAX_DATE = this.getTimeExtentAsDate()[1];
        this.timeLinearScale = D3.scaleLinear()
                                 .domain([this.MIN_DATE, this.MAX_DATE])
                                 .range([-CUBE_CONFIG.WIDTH/2, CUBE_CONFIG.WIDTH/2]);
    }

    getMinDate(): Date { return this.MIN_DATE; }
    getMaxDate(): Date { return this.MAX_DATE; }

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