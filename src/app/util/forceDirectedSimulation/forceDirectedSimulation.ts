import { Component, ViewChild, ElementRef, AfterViewInit, Input, Output, EventEmitter } from '@angular/core';
import { CUBE_CONFIG } from '../../cube.config';
import * as d3 from 'd3';
import { GoogleDriveProvider } from '../../services/google.drive.service';
import { GraphPositionService } from '../../services/graph.position.service';
import { DataManager } from '../../classes/datamanager';
import {Router} from '@angular/router';

@Component({
    selector: 'app-force-directed',
    templateUrl: './forceDirectedSimulation.html',
    styleUrls: ['./forceDirectedSimulation.css']
})

export class ForceDirectedComponent implements AfterViewInit {
    @ViewChild('inputText') textInput: ElementRef;
    // svg element groups
    private nodes: any;
    private links: any;
    private svg: any;
    // node and link data
    private nodeData: Array<any>;
    private linkData: Array<any>;

    outputData: Array<any>;

    constructor(private google: GoogleDriveProvider, private dm: DataManager, private router: Router, private graphData: GraphPositionService) {
        this.nodeData = new Array<any>();
        this.linkData = new Array<any>();

        this.outputData = new Array<any>();
    }

    ngAfterViewInit(): void {

    }

    doesNodeExist(id: string): boolean {
        let check = false;

        this.nodeData.forEach((n: any) => {
            if (n.id === id) {
                // console.log('node found');
                check = true;
                return;
            }
        });

        return check;
    }

    // run simulation 
    runSimulation(): void {
        if (!this.textInput.nativeElement.value) return;
        this.google.load(this.textInput.nativeElement.value).then((success) => {
            // create out nodeData and linkData structures for d3 sim
            this.dm.data = success;
            success.forEach((item: any) => {
                if (!item.id) {
                    // console.log('empty id');
                    // console.log(item);
                    return;
                }

                this.nodeData.push({ id: `${item.id}` });
            });
            success.forEach((item: any) => {
                item.target_nodes.forEach((target: any) => {
                    if (!target) {
                        // console.log('empty target');
                        // console.log(target);
                        return;
                    }
                    // target does not exist as a source node
                    if (!this.doesNodeExist(`${target}`)) {
                        // console.log('target does not exist as a source');
                        // console.log(target);
                        return;
                    }

                    this.linkData.push({
                        source: `${item.id}`,
                        target: `${target}`
                    });
                });
            });

            let simulation = d3.forceSimulation(this.nodeData)
                .force('link', d3.forceLink(this.linkData).id((d: any) => { return d.id; }))
                .force('charge', d3.forceManyBody())
                .force('center', d3.forceCenter(0, 0))
                .force('x', d3.forceX())
                .force('y', d3.forceY())
                // .alphaTarget(0.3)
                .on('tick', this.tick.bind(this));

            this.svg = d3.select('#graph')
                .attr('width', CUBE_CONFIG.WIDTH)
                .attr('height', CUBE_CONFIG.HEIGHT)
                .attr('viewBox', `0 0 ${CUBE_CONFIG.WIDTH} ${CUBE_CONFIG.HEIGHT}`);


            this.links = this.svg.append('g')
                .attr('class', 'links')
                .selectAll('line')
                .data(this.linkData)
                .enter()
                .append('line')
                .attr('stroke', '#999')
                .attr('stroke-opacity', .4);

            this.nodes = this.svg.append('g')
                .attr('class', 'nodes')
                .selectAll('circle')
                .data(this.nodeData)
                .enter()
                .append('circle')
                .attr('r', 2)
                .attr('fill', '#ff0000')
                .attr('cx', 0)
                .attr('cy', 0);
        });
    }

    tick(): void {
        this.links
            .attr('x1', (d: any) => { return d.source.x; })
            .attr('x2', (d: any) => { return d.target.x; })
            .attr('y1', (d: any) => { return d.source.y; })
            .attr('y2', (d: any) => { return d.target.y; });

        this.nodes.attr('transform', (d: any) => { return `translate(${d.x}, ${d.y})`; });
    }

    use(): void {
        // TODO: Rewrite cushman data 
        this.generatePositionArray();
        this.graphData.nodePos = this.outputData;
        this.graphData.buildPositionMap();
        this.router.navigateByUrl('/home');
    }

    generatePositionArray(): void {
        if(!this.nodes) return;

        this.nodes.each((d: any) => {
            this.outputData.push({
                id: d.id,
                x: d.x,
                y: d.y
            });
        });
    }
}