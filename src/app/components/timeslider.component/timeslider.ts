import { Component, ViewChild, ElementRef, AfterViewInit, Input, Output, EventEmitter } from '@angular/core';
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

    @Output() onSelect: EventEmitter<Array<Date>>;

    @ViewChild('timeSliderContainer') timeSlider: ElementRef;

    // D3 things
    xScale: D3.ScaleLinear<any, any>;
    yScale: D3.ScaleTime<any, any>;
    brush: any;

    _brushMemory: Array<Date>;
    _animationStep = 10;
    _interval;
    _svg;

    constructor() {
        this.onSelect = new EventEmitter<Array<Date>>();
        this._brushMemory = new Array<Date>();
    }

    ngAfterViewInit(): void {
        // define margin for timeline
        let margin = {
            top: 0, bottom: 0,
            right: 0, left: 0
        };
        let buttonYSize = 20;
        this.width = this.width - (margin.left + margin.right);
        this.height = this.height - (margin.top + margin.bottom)-(2*buttonYSize);


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
        // timeline y axis (not labels)
        this._svg.append('g')
            .attr('class', 'axis2 axis--y2')
            .call(
                D3.axisRight(this.yScale)
                .ticks(D3.timeYear.every(1))
                .tickSize(10)
                .tickFormat((d: Date) => {
                  return D3.timeFormat('%Y')(d);
                })
            )
            .selectAll('.tick')

        //animate button
        let playButton = this._svg.append('g')
            .attr('transform', 'translate(' + 0 + ',' + (this.height+buttonYSize) + ')')
            .attr('class', 'animateButton')

        playButton.append('rect')
            .attr('width', this.width)
            .attr('height', buttonYSize);

        playButton.append('text')
            .attr('class','playButton')
            .attr('font-size', '1em')
            .attr('fill', 'white')
            .text('play')
                .attr('transform', 'translate(8,16)')
                .on('mouseup', this.animateBasedOnPeriod.bind(this));

        //reset button
        let resetFilterButton = this._svg.append('g')
            .attr('transform', 'translate(' + 0 + ',' + (this.height) + ')')
            .attr('class', 'resetButton')

        resetFilterButton.append('rect')
            .attr('width', this.width)
            .attr('height', buttonYSize)
            .attr('fill', 'gray');

        resetFilterButton.append('text')
            .attr('class','playButton')
            .attr('font-size', '1em')
            .attr('fill', 'white')
            .text('reset')
                .attr('transform', 'translate(8,16)')
                .on('mouseup', this.resetTimeFilter.bind(this));

        // brush
        this._svg.append('g')
            .attr('class', 'brush')
            .attr('transform', `translate(0, ${margin.top})`)
            .attr('fill', 'black')
            .call(this.brush);
        
        this._svg.select('g.brush').select('rect.selection').attr('fill-opacity',0.8);
    }

    getTimePeriodFromSlider(): Array<Date>{
        let endDate_yPosition: any = D3.select('g.brush rect.handle--n').attr('y');
        let startDate_yPosition: any = D3.select('g.brush rect.handle--s').attr('y');

        let endDate = this.yScale.invert(endDate_yPosition);
        let startDate = this.yScale.invert(startDate_yPosition);

        return new Array<Date>(startDate,endDate);
    }

    resetTimeFilter():void{
        //TODO
        console.log("reset time filter");
    }

    getWholeTimePeriod(): Array<Date>{
        return new Array<Date>(this.minDate, this.maxDate);
    }
    
    isAnimationPlaying(): boolean{
        return D3.select('text.playButton').text() === 'pause';
    }

    animateBasedOnPeriod(){
        if (!this._brushMemory) {
            alert('Missing period - An animation will be played with standard brush. HOWEVER, the brush is FLEXIBLE and you can change its intervals the way you want it!!');            
            
            this._brushMemory = [new Date(1939,1,1),new Date(1941,1,1)];            
            console.log(this._brushMemory);

            this.showBrushAccordingToDateInterval();
            this.animateBasedOnPeriod();
        } 
        else{
            if(!this.isAnimationPlaying()) this.animate();
            else this.pauseAnimation();
        }        
    }    

    showBrushAccordingToDateInterval(){
        
        //this.brush.move(this._brushMemory);
        // call(brush.move,this._brushMemory.map(this.yScale));

        // // north border
        // let currentY: any = D3.select('g.brush rect.handle--n').attr('y');
        // currentY = this.yScale(this._brushMemory[1]);
        // D3.select('g.brush rect.handle--n').attr('y',currentY).attr('style','');    

        // // center
        // let height = (this.yScale(this._brushMemory[0]) - this.yScale(this._brushMemory[1]));
        // currentY = D3.select('g.brush rect.selection').attr('y');        
        // currentY = (height/2) + this.yScale(this._brushMemory[0]);        
        // D3.select('g.brush rect.selection').attr('y',currentY).attr('height',height).attr('style','');        
        
        // // south border
        // currentY = D3.select('g.brush rect.handle--s').attr('y');
        // currentY = this.yScale(this._brushMemory[0]);
        // D3.select('g.brush rect.handle--s').attr('y',currentY).attr('style','');    
    }

    animate() {   
        this.setPlayButtonLabel('pause');
        this._interval = setInterval(() => {
                this.stepForwardWithBrush(this._animationStep);
          }, 1000);        
    }

    stepForwardWithBrush(step: number){
        this.moveBrushPieces(step);
        this.filterPeriodAccordingToNewBrushPositions();
    }

    filterPeriodAccordingToNewBrushPositions(){
        let timePeriod = this.getTimePeriodFromSlider();
        this.saveLastBrush(timePeriod);
        this.onSelect.emit(timePeriod);        
    }

    moveBrushPieces(step: number){
        if (this.isBrushInUpLimit(step)) this.pauseAnimation();
        else{
            // north border
            let currentY: any = D3.select('g.brush rect.handle--n').attr('y');
            currentY = currentY-step;
            D3.select('g.brush rect.handle--n').attr('y',currentY);
    
            // center
            currentY = D3.select('g.brush rect.selection').attr('y');
            currentY = currentY-step;
            D3.select('g.brush rect.selection').attr('y',currentY);        
            
            // south border
            currentY = D3.select('g.brush rect.handle--s').attr('y');
            currentY = currentY-step;
            D3.select('g.brush rect.handle--s').attr('y',currentY);
        }        
    }

    isBrushInUpLimit(step: number){
        // north border
        let currentY: any = D3.select('g.brush rect.handle--n').attr('y');
        return currentY<step;
    }

    saveAndEmitSelection(timePeriod:Array<Date>){
        this.saveLastBrush(timePeriod);
        this.onSelect.emit(timePeriod);  
    }

    pauseAnimation(){
        this.setPlayButtonLabel('play');
        clearInterval(this._interval);
    }

    addYearToDate(date:Date): Date{
        //1 year = 1000 milliseconds in a second * 60 seconds in a minute * 60 minutes in an hour * 24 hours * 365 days
        if(date) return new Date(date.getTime() + (1000 * 60 * 60 * 24 * 365));
        else this.pauseAnimation();

        return null;
    }

    setPlayButtonLabel(str: any){
        D3.select('text.playButton').text(str);
    }

    //DEPRICATED
    switchPlayButtonLabel(){
        let newLabel = '';
        if(!this.isAnimationPlaying()) newLabel = 'pause';
        else newLabel = 'play';
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