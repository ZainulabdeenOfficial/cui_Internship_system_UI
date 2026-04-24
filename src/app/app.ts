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
    // Safety net: force-hide the spinner on actual route navigations (path changes).
    // Query-param-only changes (e.g. ?tab=requests → ?tab=complaints) are NOT
    // route changes — they must NOT reset the loading counter, or API calls
    // triggered by selectTab() will have their spinners killed mid-flight.
    let previousPath = '';
    router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e) => {
      const nav = e as NavigationEnd;
      const currentPath = nav.urlAfterRedirects.split('?')[0];
      if (previousPath && currentPath !== previousPath) {
        // Genuine route change (e.g. /admin → /home): reset stuck spinners
        setTimeout(() => loadingService.forceHide(), 300);
      }
      previousPath = currentPath;
    });
  }
}
