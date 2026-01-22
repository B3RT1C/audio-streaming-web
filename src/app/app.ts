import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  title = "";
  http = inject(HttpClient).get('http://localhost:8080/', {responseType: 'text'}).subscribe((text) => {
    this.title = text;
  });
}