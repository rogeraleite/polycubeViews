import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { GoogleDriveProvider } from './services/google.drive.service';
import { AppComponent } from './app.component';
import { TimeSliderComponent } from './components/timeslider.component/timeslider';

@NgModule({
  declarations: [
    AppComponent,
    TimeSliderComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule
  ],
  providers: [GoogleDriveProvider],
  bootstrap: [AppComponent]
})
export class AppModule { }
