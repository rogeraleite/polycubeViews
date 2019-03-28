import { Component, ViewChild, ElementRef, AfterViewInit, Input, Output, EventEmitter } from '@angular/core';
import * as D3 from 'd3';
import * as moment from 'moment';
import { timer } from 'rxjs';

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

    @Output() onSelect: EventEmitter<Array<Date>>;

    @ViewChild('timeSliderContainer') timeSlider: ElementRef;

    // D3 things
    xScale: D3.ScaleLinear<any, any>;
    yScale: D3.ScaleTime<any, any>;
    brush: any;

    _brushMemory: Array<Date>;
    _animationTime: number = 5;
    _timeLeft: number = 5;
    _interval;
    _svg;

    constructor() {
        this.onSelect = new EventEmitter<Array<Date>>();
        this._brushMemory = new Array<Date>();
    }

    ngAfterViewInit(): void {

        // define margin for timeline
        let margin = {
            top: 0,
            right: 0,
            bottom: 20,
            left: 0
        };
        this.width = this.width - (margin.left + margin.right);
        this.height = this.height - (margin.top + margin.bottom);

        // define scales
        this.xScale = D3.scaleLinear().range([0, this.width]);
        this.yScale = D3.scaleTime().domain([this.maxDate, this.minDate]).range([0, this.height]);

        // define brush
        this.brush = D3.brushY()
            .extent([[0, 0], [this.width, this.height]])
            .on('end', this.brushEnd.bind(this));


        this._svg = D3.select(this.timeSlider.nativeElement)
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top - 15})`);
        // timeline y axis (not labels)
        this._svg.append('g')
            .attr('class', 'axis2 axis--y2')
            .attr('transform', `translate(0, ${margin.top})`)
            .call(
                D3.axisLeft(this.yScale)
                    .ticks(D3.timeMonth)
                    .tickSize(-this.width)
                    .tickFormat(() => {
                        return null;
                    })
            )
            .selectAll('.tick')

        this._svg.append('g')
            .attr('class', 'axis axis--y')
            .attr('transform', `translate(0, ${margin.top})`)
            .call(
                D3.axisLeft(this.yScale)
                    .tickFormat((d: Date) => {
                        return D3.timeYear(d) < d ? D3.timeFormat('%b')(d) : D3.timeFormat('%b%Y')(d);
                    })
            )
            .attr('text-anchor', null)
            .selectAll('text')
            .attr('x', 70)
            .attr('fill', 'black'); // TODO: change colorcoding later according to timer

        //animate button
        let button = this._svg.append('g')
            .attr("transform", "translate(" + 0 + "," + (this.height) + ")")
            .attr("class", "animateButton")

        button.append("rect")
            .attr("width", this.width)
            .attr("height", 40)

        // button.append("path")
        //     .attr("d", "M5 5 L5 35 L35 20 Z")
        //     .style("fill", "#8a8a8a")
        //     .style("stroke", "#8a8a8a");

        // for play text
        button.append('text')
            .attr("class","playButton")
            .attr("font-size", "1.5em")
            .attr("fill", "white")
            .text('play')
            .attr("transform", "translate(8,28)")
            .on('mouseup', this.animateBasedOnPeriod.bind(this));

        // brush
        this._svg.append('g')
            .attr('class', 'brush')
            .attr('transform', `translate(0, ${margin.top})`)
            .attr("fill", "black")
            .call(this.brush);
        
        this._svg.select("g.brush").select("rect.selection").attr('fill-opacity',0.8);


    }

    getTimePeriodFromSlider(): Array<Date>{
        let d0 = D3.event.selection.map(this.yScale.invert);
        let d1 = d0.map(D3.timeMonth.round);

        console.log(d0);
        console.log(d1);

        let brushDOM = D3.select('.brush');

        brushDOM.transition().call(D3.event.target.move, d1.map(this.yScale));
        let range = D3.brushSelection((brushDOM as any).node());

        let startD = this.yScale.invert(+range[0]);
        let endD = this.yScale.invert(+range[1]);

        return new Array<Date>(endD, startD);
    }

    getWholeTimePeriod(): Array<Date>{
        return new Array<Date>(this.minDate, this.maxDate);
    }
    
    isAnimationPlaying(): boolean{
        return this._animationTime > this._timeLeft;
    }

    animateBasedOnPeriod(){
        if (!this._brushMemory) {
            alert("Missing period - Brush the vertical time line to define a period");
        } 
        else{
            let timePeriod = this._brushMemory;            

            if(!this.isAnimationPlaying()) this.animate();
            else this.pauseAnimation();
        }        
    }    

    animate() {   
        this.setPlayButtonLabel("play");
        
        this._interval = setInterval(() => {
            if(this._timeLeft > 0) {
                this._timeLeft--;                
                console.log(this._timeLeft);

                this.stepForwardWithBrush(10);
            }
            else this._timeLeft = this._animationTime;
          }, 1000);

        
    }

    stepForwardWithBrush(y){
        // console.log(this._brushMemory);
        // let newEndDate = this.addYearToDate(this._brushMemory[0]);
        // let newStartDate = this.addYearToDate(this._brushMemory[1]);
        
        // let timePeriod = Array<Date>(newEndDate, newStartDate);

        //  this.saveAndEmitSelection(timePeriod);
        this.moveBrushPieces(10);


        //TODO: filter according to new positions

        // let timePeriod = this.getTimePeriodFromSlider();
        // this.saveLastBrush(timePeriod);
        // this.onSelect.emit(timePeriod);  

    }

    moveBrushPieces(step: number){
        // north border
        let currentY: any = D3.select("g.brush rect.handle--n").attr("y");

        if (currentY<step) this.pauseAnimation();
        else{
            currentY = currentY-step;
            D3.select("g.brush rect.handle--n").attr("y",currentY);
    
            // center
            currentY = D3.select("g.brush rect.selection").attr("y");
            currentY = currentY-step;
            D3.select("g.brush rect.selection").attr("y",currentY);        
            
            // south border
            currentY = D3.select("g.brush rect.handle--s").attr("y");
            currentY = currentY-step;
            D3.select("g.brush rect.handle--s").attr("y",currentY);
        }        
    }

    saveAndEmitSelection(timePeriod:Array<Date>){
        this.saveLastBrush(timePeriod);
        this.onSelect.emit(timePeriod);  
    }

    pauseAnimation(){
        this.setPlayButtonLabel("pause");
        clearInterval(this._interval);
        this._timeLeft = this._animationTime;
    }

    addYearToDate(date:Date): Date{
        //1 year = 1000 milliseconds in a second * 60 seconds in a minute * 60 minutes in an hour * 24 hours * 365 days
        if(date) return new Date(date.getTime() + (1000 * 60 * 60 * 24 * 365));
        else {            
            this.pauseAnimation();
        }
        
        return null;
    }
    setPlayButtonLabel(str: any){
        D3.select('text.playButton').text(str);
    }

    //DEPRICATED
    switchPlayButtonLabel(){
        let newLabel = "";
        if(!this.isAnimationPlaying()) newLabel = "pause";
        else newLabel = "play";
        D3.select('text.playButton').text(newLabel);
    }

    brushEnd(): void {
        if (this.isEventNotActive()) return;

        let timePeriod: Array<Date>; 
        if (this.isSelectionMissing()){ 
            timePeriod = this.getWholeTimePeriod(); 
            this.eraseLastBrush();
        }
        else{
            timePeriod = this.getTimePeriodFromSlider();
            this.saveLastBrush(timePeriod);
        }

        this.onSelect.emit(timePeriod);        
    }

    isSelectionMissing(): boolean{
        return !D3.event.selection
    }

    isEventNotActive(): boolean{
        return !D3.event.sourceEvent
    }

    saveLastBrush(timePeriod: Array<Date>):void{
        this._brushMemory = timePeriod;
    }
    eraseLastBrush():void{
        this._brushMemory = null;
    }

}