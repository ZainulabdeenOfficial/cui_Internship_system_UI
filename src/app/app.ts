import { Component } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { RouterOutlet } from '@angular/router';
import { Header } from './shared/header/header';
import { Footer } from './shared/footer/footer';
import { ToastsContainer } from './shared/toast/toasts';
import { LoadingSpinnerComponent } from './core/components/loading-spinner/loading-spinner.component';
import { LoadingService } from './core/services/loading.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer, ToastsContainer, LoadingSpinnerComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected title = 'cui_Internship_system';

  constructor(router: Router, loadingService: LoadingService) {
    // Safety net: force-hide the spinner on every completed navigation.
    // This prevents any in-flight HTTP request (cancelled by navigation) from
    // leaving the loading counter stuck above zero.
    router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      // Small delay so any finalize() from completing requests runs first
      setTimeout(() => loadingService.forceHide(), 300);
    });
  }
}
