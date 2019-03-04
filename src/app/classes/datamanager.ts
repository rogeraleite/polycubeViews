

export class DataManager {
    private temp_data: Array<string>;

    private _data: any;
    private _data_map: any = new Map();

    constructor(data: any) {
        this.temp_data = new Array<string>('green', 'red', 'blue');
        this.loadDataCushmanRelationships();
    }

    getData(): Array<string> {
        
        return this.temp_data;
    }

    //setData(data: any)

    printArray(): void {
        this.temp_data.forEach((d) => { console.log(d); });
    }

    loadDataCushmanRelationships(): void {
        console.log("aa");
        let a = 8;
        let xhr = new XMLHttpRequest();
        xhr.overrideMimeType('application/json');
        xhr.open('GET', './data/cushman_relationships.json');
        xhr.send();
        xhr.onreadystatechange = function() {    
                if(this.readyState == 4 && this.status == 200) {
                    console.log(a);
                    a = 10;
                    console.log(a);
                    // this._data = JSON.parse(xhr.responseText);                
                    // //map constructor
                    // this._data.forEach((e:any) => {
                    //     this._data_map.set(e.id, e);
                    // });
                } 
        };//end function
    }
    


}//end class