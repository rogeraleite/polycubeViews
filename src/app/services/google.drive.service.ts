import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as moment from 'moment';
import { reject } from 'q';
/*
  Generated class for the GoogleDrive provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular 2 DI.
*/
@Injectable()
export class GoogleDriveProvider {
    data: any = null;

    constructor(public http: HttpClient) { }

    load = (id: string): Promise<any> => {
        // NOTE: Google App Script created to parse the contents of the google spreadsheet
        // IT ASSUMES THAT WE FOLLOW THE DATA MODEL DESCRIBED IN THE POLYCUBE PROJECT
        // SPREADSHEET ID CAN BE PASSED AS URL PARAMETER ?spreadsheetid=${id}
        //https://script.google.com/macros/s/AKfycbzXuKsFGFhIBQWH8fG21Gi78FE_F-On1QMwtGOFIiqg8na_XA/exec
        // to edit script: https://script.google.com/d/1ArSYnPLsBvAtzgsg4CG4PrzF-1YGG0VpRYziZf7f-SS72lY8X8lJqdRv/edit?splash=yes
        const url = `https://script.google.com/macros/s/AKfycbzXuKsFGFhIBQWH8fG21Gi78FE_F-On1QMwtGOFIiqg8na_XA/exec?spreadsheetid=${id}`;
        // don't have the data yet
        return new Promise((resolve: any, reject: any) => {
            this.http.get(url)
                .subscribe((data: any) => {
                    data.forEach((item: any) => {
                        item.date_time = moment(item.date_time).toDate();
                        item.target_nodes = item.target_nodes.split(';').map(Number);
                        item.category_1 = item.category_1 === "" ? "No Category" : item.category_1;
                        item.label = item.label.split(';').map(Number);
                        // TODO: data.date_range, data.range
                    });
                    resolve(data);
                }, (error: any) => {
                    reject(error.message);
                });
        });
    }
}