import * as D3 from 'd3';
import * as moment from 'moment';
import { CUBE_CONFIG } from '../cube.config';
import { CushmanForcedDirected } from '../../data/cushman_nodes_position';


export class DataManager {
    private _data: Array<any>;
    private _data_map: any;
    private _cushman_pos: CushmanForcedDirected;

    private _numSlices: number
    
    private timeLinearScale: D3.ScaleLinear<number, number>;
    
    private MIN_DATE: Date;
    private MAX_DATE: Date;

    constructor() {
        this._data_map = new Map();
        this._cushman_pos = new CushmanForcedDirected();
        this._numSlices = 5;
    }

    get data(): Array<any> {
        return this._data;
    }

    set data(data: Array<any>) {
        this._data = data;
        this._numSlices = 5;
        this.MIN_DATE = this.getTimeExtentAsDate()[0];
        this.MAX_DATE = this.getTimeExtentAsDate()[1];
        this.timeLinearScale = D3.scaleLinear()
                                 .domain([this.MIN_DATE, this.MAX_DATE])
                                 .range([-CUBE_CONFIG.WIDTH/2, CUBE_CONFIG.WIDTH/2]);
    }

    getForcedDirectedCushmanPositionMap(): any {                
        return this._cushman_pos.nodesPosMap;
    }

    getDataPositionDimensions(): any{
        return this._cushman_pos.getDataPositionDimensions(); 
    }
    
    get numSlices(): number {
        return this._numSlices;
    }

    set numSlicers(slices: number) {
        this._numSlices = slices;
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
    
    // deprecated
    // getTimeslice(date: Date): number {
    //     let dateDiff = moment(this.MAX_DATE).diff(this.MIN_DATE, 'days');
        
    //     console.log(dateDiff/this._numSlices);

    //     return 0;
    // }

    timeRange(date: Date): any {
        let timeScale = D3.scaleTime().domain([this.MIN_DATE, this.MAX_DATE]);

        // NOTE: not guarenteed to return same amount of ticks as passed
        // need to define tickValues function to enforce same amount of ticks 
        // https://stackoverflow.com/questions/51497534/how-to-force-a-specific-amount-of-y-axis-ticks-in-d3-charts
        let xRange = timeScale.ticks(8);
        
        // TODO: Consider temporal granularity (currently in years) -> days?
        let myQuantizeFunction = D3.scaleQuantize()
                                   .domain([this.MIN_DATE, this.MAX_DATE])
                                   .range(xRange.map((d) => { return d.getFullYear(); }));

        return myQuantizeFunction(date);
    }

    private getTimeExtentAsUnix(): Array<Number> {
        return D3.extent(this._data, (d: any) => {
            return moment(d.date_time).unix();
        });
    }
}//end class