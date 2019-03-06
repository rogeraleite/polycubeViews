export class DataManager {
    private _data: Array<any>;
    private _data_map: any;

    constructor() {
        this._data = new Array<any>('green', 'red', 'blue');
        this._data_map = new Map();
    }

    get data(): Array<any> {
        return this._data;
    }

    set data(data: Array<any>) {
        this._data = data;
    }
}//end class