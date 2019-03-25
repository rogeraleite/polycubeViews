import { Component, ViewChild, ElementRef, AfterViewInit, Input, Output, EventEmitter } from '@angular/core';
import * as D3 from 'd3';
import * as moment from 'moment';

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

    constructor() {
        this.onSelect = new EventEmitter<Array<Date>>();
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
            .on('end', this.brushEnd.bind(this))


        let svg = D3.select(this.timeSlider.nativeElement)
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top - 15})`);
        // timeline y axis (not labels)
        svg.append('g')
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

        svg.append('g')
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
        let button = svg.append('g')
            .attr("transform", "translate(" + 0 + "," + (this.height) + ")")
            .attr("class", "animateButton")

        button.append("rect")
            .attr("width", this.width)
            .attr("height", 40)

        button.append("path")
            .attr("d", "M5 5 L5 35 L35 20 Z")
            .style("fill", "#8a8a8a")
            .style("stroke", "#8a8a8a");

        // for play text
        // append('text')
        //     .attr("font-size", "2em")
        //     .attr("fill", "white")
        //     .text('play')

        // brush
        svg.append('g')
            .attr('class', 'brush')
            .attr('transform', `translate(0, ${margin.top})`)
            .call(this.brush)


    }

    brushEnd(): void {
        if (!D3.event.sourceEvent || !D3.event.selection) return; // no selection or event

        let d0 = D3.event.selection.map(this.yScale.invert);
        let d1 = d0.map(D3.timeMonth.round);
        let brushDOM = D3.select('.brush');

        brushDOM.transition().call(D3.event.target.move, d1.map(this.yScale));
        // console.log(D3.event);
        let range = D3.brushSelection((brushDOM as any).node());


        let startD = this.yScale.invert(+range[0]);
        let endD = this.yScale.invert(+range[1]);

        this.onSelect.emit(new Array<Date>(endD, startD));
    }

}