import { Component, ViewChild, ElementRef, AfterViewInit, Input } from '@angular/core';
import * as D3 from 'd3';

@Component({
   selector: 'app-timeslider',
   templateUrl: './timeslider.html',
   styleUrls: ['./timeslider.css']
})

export class TimeSliderComponent implements AfterViewInit {
    @Input('minDate') minDate: Date;
    @Input('maxDate') maxDate: Date;
    @Input('width') width: number;
    @Input('height') height: number;

    @ViewChild('timeSliderContainer') timeSlider: ElementRef;
    
    xScale: D3.ScaleTime<any, any>;
    yScale: D3.ScaleTime<any, any>;
    
    constructor() {}

    ngAfterViewInit(): void {
        this.xScale = D3.scaleTime().domain([this.minDate, this.maxDate]).range([0, this.height]);
        // this.yScale = D3.scaleLinear().range([0, width]);
    }
}