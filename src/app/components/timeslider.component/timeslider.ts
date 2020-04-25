import { Component, ViewChild, ElementRef, AfterViewInit, Input, Output, EventEmitter } from '@angular/core';
import * as D3 from 'd3';
import { DataManager } from 'src/app/classes/datamanager';

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
    yScale2: D3.ScaleTime<any, any>;
    brush: any;
    brush2: any;
    data: DataManager;

    _brushMemory: Array<Date>;
    _animationStep = 10;
    _interval;
    _svg;

    constructor() {
        this.onSelect = new EventEmitter<Array<Date>>();
        this._brushMemory = new Array<Date>();
    }

    ngAfterViewInit(): void {
        // console.log(this.minDate)

        // define margin for timeline
        const margin = {
            top: 0, bottom: 0,
            right: 0, left: 0
        };
        const buttonYSize = 20;
        this.width = this.width - (margin.left + margin.right);
        this.height = this.height - (margin.top + margin.bottom) - (2 * buttonYSize);


        // define scales
        this.xScale = D3.scaleLinear().range([0, this.width]);
        this.yScale = D3.scaleTime().domain([this.maxDate, this.minDate]).range([0, this.height]);
        this.yScale2 = D3.scaleTime().domain([new Date(2000, 1, 1), new Date(1900, 1, 1)]).range([0, this.height]);

        console.log(this.maxDate, this.minDate);

        // define brush
        this.brush = D3.brushY()
            .extent([[0, 0], [this.width, this.height]])
            .on('end', this.brushEnd.bind(this));

        this.brush2 = D3.brushY()
            .extent([[0, 0], [this.width, this.height]])
            .on('end', this.brushEnd2.bind(this));

        this._svg = D3.select(this.timeSlider.nativeElement)
            .append('svg')
            .attr('transform', 'translate(' + 20 + ', 0 )')
            .attr('width', this.width)
            .attr('height', this.height)
            .append('g');

        // timeline 1 y axis (not labels)
        this._svg.append('g')
            .attr('class', 'axis2 axis--y2')
            // .attr('transform', 'translate(' + 50 + ', 0 )')
            .call(
                D3.axisRight(this.yScale)
                    // .ticks(D3.timeYear.every(1))
                    .tickSize(10)
                    .tickFormat((d: Date) => {
                        return D3.timeFormat('%Y')(d);
                    })
            )
            .selectAll('.tick');

        // timeline 2
        // this._svg.append('g')
        //     .attr('class', 'axis2 axis--y2')
        //     .call(
        //         D3.axisRight(this.yScale2)
        //             // .ticks(D3.timeYear.every(1))
        //             .tickSize(10)
        //             // .tickFormat((d: Date) => {
        //             //     return D3.timeFormat('%Y')(d);
        //             // })
        //     )
        //     .selectAll('.tick');

        // Legend
        let defs = this._svg.append('defs');
        let linearGradient = defs.append('linearGradient')
            .attr('id', 'linear-gradient');

        // Vertical gradient
        linearGradient
            .attr('x1', '0%')
            .attr('y1', '0%')
            .attr('x2', '0%')
            .attr('y2', '100%');

        // A color scale
        let colorScale = D3.scaleSequential(D3.interpolateViridis)
            .domain([this.height, 0]);

        linearGradient.selectAll('stop')
            .data([
                {offset: '0%', color: '#fde725'},
                {offset: '12.5%', color: '#a8db35'},
                {offset: '25%', color: '#5cc763'},
                {offset: '37.5%', color: '#5cc763'},
                {offset: '50%', color: '#218f8d'},
                {offset: '62.5%', color: '#2d6d8e'},
                {offset: '75%', color: '#3c4f8a'},
                {offset: '87.5%', color: '#472775'},
                {offset: '100%', color: '#440154'}
            ])
            .enter().append('stop')
            .attr('offset', function(d) { return d.offset; })
            .attr('stop-color', function(d) { return d.color; });

        // legend
        const legend = this._svg.append('g')
            .attr('class', 'timeLegend')
            .append('rect')
            .attr('id', 'timeLegend')
            .style('display', 'none')
            .attr('width', 20 + 'px')
            .attr('height', this.height)
            .attr('transform', 'translate(' + -20 + ', 0 )')
            .attr('fill', 'url(#linear-gradient)');

        // Define the div for the tooltip
        let tooltip = D3.select("body").append("div")	
                    .attr("class", "tooltip")
                    .style("position", "absolute")
                    .style("z-index", "9999999")
                    .style("visibility", "hidden");

        // animate button
        const playButton = this._svg.append('g')
            .attr('transform', 'translate(' + 0 + ',' + (this.height + buttonYSize) + ')')
            .attr('class', 'animateButton')
            .on("mouseover", (d) => {		
                return tooltip.style("visibility", "visible");
                })					
            .on("mousemove", (d)=>{
                    return tooltip.style("top", (D3.event.pageY-10)+"px")
                                  .style("left",(D3.event.pageX+10)+"px")     
                                  .style("border-style","solid")          
                                  .style("border-width","thin")                                     
                                  .style("background-color","rgba(255,255,255)");
                })
            .on("mouseout", ()=>{
                    return tooltip.style("visibility", "hidden");                                
            });


        playButton.append('rect')
            .attr('width', this.width)
            .attr('height', buttonYSize);        

        playButton.append('text')
            .attr('class', 'playButton')
            .attr('font-size', '1em')
            .attr('fill', 'white')
            .text('play')
            .attr('transform', 'translate(8,16)')
            .on('mouseup', this.animateBasedOnPeriod.bind(this));

        // reset button
        const resetFilterButton = this._svg.append('g')
            .attr('transform', 'translate(' + 0 + ',' + (this.height) + ')')
            .attr('class', 'resetButton');

        resetFilterButton.append('rect')
            .attr('width', this.width)
            .attr('height', buttonYSize)
            .attr('fill', 'gray');

        resetFilterButton.append('text')
            .attr('class', 'playButton')
            .attr('font-size', '1em')
            .attr('fill', 'white')
            .text('reset')
            .attr('transform', 'translate(8,16)')
            .on('mouseup', this.resetTimeFilter.bind(this));

        // brush 1
        this._svg.append('g')
            .attr('class', 'brush')
            .attr('transform', `translate(0, ${margin.top})`)
            // .attr('transform', 'translate(' + 50 + ', 0 )')
            .attr('fill', 'black')
            .call(this.brush);

        //     // brush 2
        // this._svg.append('g')
        //     .attr('class', 'brush2')
        //     .attr('transform', `translate(0, ${margin.top})`)
        //     .attr('fill', 'black')
        //     .call(this.brush2);

        this._svg.select('g.brush').select('rect.selection').attr('fill-opacity', 0.8);
    }

    getTimePeriodFromSlider(): Array<Date> {
        let endDate_yPosition: any = D3.select('g.brush rect.handle--n').attr('y');
        let startDate_yPosition: any = D3.select('g.brush rect.handle--s').attr('y');

        const endDate = this.yScale.invert(endDate_yPosition);
        const startDate = this.yScale.invert(startDate_yPosition);

        return new Array<Date>(startDate, endDate);
    }

    resetTimeFilter(): void {
        if (this.isAnimationPlaying()) { this.pauseAnimation(); }

        this.drawBrushBasedOnPixelsCoordinates(null);
        this.onSelect.emit([this.minDate, this.maxDate]);
    }

    getWholeTimePeriod(): Array<Date> {
        return new Array<Date>(this.minDate, this.maxDate);
    }

    isAnimationPlaying(): boolean {
        return D3.select('text.playButton').text() === 'pause';
    }

    animateBasedOnPeriod() {
        if (this.hasBrushMemory()) {
            if (!this.isAnimationPlaying()) { this.animate(); }
            else { this.pauseAnimation(); }
        } else {
            const standardPeriod = [new Date(1939, 1, 1), new Date(1941, 1, 1)];
            this.saveAndEmitFilterSelection(standardPeriod);
            this.drawBrushBasedOnTimePeriod(standardPeriod);
            this.animateBasedOnPeriod();
        }
    }

    drawBrushBasedOnTimePeriod(timePeriod: Array<Date>) {
        let y0 = this.yScale(timePeriod[1]);
        let y1 = this.yScale(timePeriod[0]);
        this.drawBrushBasedOnPixelsCoordinates([y0, y1]);
    }

    drawBrushBasedOnPixelsCoordinates(pixelCoordinates: Array<number>) {
        this._svg.select('g.brush').call(this.brush.move, pixelCoordinates);
    }

    hasBrushMemory() {
        return (this._brushMemory && this._brushMemory.length > 1);
    }

    animate() {
        this.setPlayButtonLabel('pause');
        this._interval = setInterval(() => {
            this.stepForwardWithBrush(this._animationStep);
        }, 1000);
    }

    stepForwardWithBrush(step: number) {
        this.moveBrushPieces(step);
        this.filterPeriodAccordingToNewBrushPositions();
    }

    filterPeriodAccordingToNewBrushPositions() {
        const timePeriod = this.getTimePeriodFromSlider();
        this.saveAndEmitFilterSelection(timePeriod);
    }

    saveAndEmitFilterSelection(timePeriod: Array<Date>) {
        this.saveLastBrush(timePeriod);
        this.onSelect.emit(timePeriod);
    }

    isBrushNull(): boolean {
        if (D3.select('g.brush rect.handle--n').attr('y')) { return true; }
        return false;
    }

    moveBrushPieces(step: number) {
        if (this.isBrushInUpLimit(step)) { this.pauseAnimation(); }
        else {
            // north border
            let currentY: any = D3.select('g.brush rect.handle--n').attr('y');
            currentY = currentY - step;
            D3.select('g.brush rect.handle--n').attr('y', currentY);

            // center
            currentY = D3.select('g.brush rect.selection').attr('y');
            currentY = currentY - step;
            D3.select('g.brush rect.selection').attr('y', currentY);

            // south border
            currentY = D3.select('g.brush rect.handle--s').attr('y');
            currentY = currentY - step;
            D3.select('g.brush rect.handle--s').attr('y', currentY);
        }
    }

    isBrushInUpLimit(step: number) {
        // north border
        const currentY: any = D3.select('g.brush rect.handle--n').attr('y');
        return currentY < step;
    }

    pauseAnimation() {
        this.setPlayButtonLabel('play');
        clearInterval(this._interval);
    }

    addYearToDate(date: Date): Date {
        // 1 year = 1000 milliseconds in a second * 60 seconds in a minute * 60 minutes in an hour * 24 hours * 365 days
        if (date) { return new Date(date.getTime() + (1000 * 60 * 60 * 24 * 365)); }
        else { this.pauseAnimation(); }

        return null;
    }

    setPlayButtonLabel(str: any) {
        D3.select('text.playButton').text(str);
    }

    brushEnd(): void {
        if (this.isEventNotActive()) { return; }

        let timePeriod: Array<Date>;
        if (this.isSelectionMissing()) {
            timePeriod = this.getWholeTimePeriod();
            this.eraseLastBrush();
        } else {
            timePeriod = this.getTimePeriodFromSlider();
            this.saveLastBrush(timePeriod);
        }

        this.onSelect.emit(timePeriod);
    }

    brushEnd2(): void {
        if (this.isEventNotActive()) { return; }

        let timePeriod: Array<Date>;
        
        // if (this.isSelectionMissing()) {
        //     timePeriod = this.getWholeTimePeriod();
        //     this.eraseLastBrush();
        // }
        // else {
        //     timePeriod = this.getTimePeriodFromSlider();
        //     this.saveLastBrush(timePeriod);
        // }

        // this.onSelect.emit(timePeriod);
    }

    isSelectionMissing(): boolean {
        return !D3.event.selection;
    }

    isEventNotActive(): boolean {
        return !D3.event.sourceEvent;
    }

    saveLastBrush(timePeriod: Array<Date>): void {
        this._brushMemory = timePeriod;
    }

    eraseLastBrush(): void {
        this._brushMemory = null;
    }
}
