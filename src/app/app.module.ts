import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
// Routing
import { AppRoutingModule } from './app.routing.module';
import { HttpClientModule } from '@angular/common/http';
import { GoogleDriveProvider } from './services/google.drive.service';
import { GraphPositionService } from './services/graph.position.service';
import { DataManager } from './classes/datamanager';
import { AppComponent } from './app.component'; 
import { CubeComponent } from './components/cube.component/cube.component';
import { TimeSliderComponent } from './components/timeslider.component/timeslider';
import { ForceDirectedComponent } from './util/forceDirectedSimulation/forceDirectedSimulation';
import { SidebarModule } from 'ng-sidebar';

@NgModule({
  declarations: [
    AppComponent,
    CubeComponent,
    TimeSliderComponent,
    ForceDirectedComponent
  ],
  imports: [
    BrowserModule,
    SidebarModule.forRoot(),
    AppRoutingModule,
    HttpClientModule
  ],
  providers: [GoogleDriveProvider, GraphPositionService, DataManager],
  bootstrap: [AppComponent]
})
export class AppModule { }
