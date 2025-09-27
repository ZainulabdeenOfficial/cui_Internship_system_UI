import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { share } from 'rxjs';
import { Header } from './shared/header/header';
import { Footer } from './shared/footer/footer';
import { ToastsContainer } from './shared/toast/toasts';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer, ToastsContainer],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected title = 'cui_Internship_system';
}
