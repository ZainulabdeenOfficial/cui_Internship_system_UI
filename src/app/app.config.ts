import { ApplicationConfig, APP_INITIALIZER, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { TokenRefreshService } from './shared/services/token-refresh.service';
import { VisibilityService } from './core/services/visibility.service';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { httpInterceptor } from './core/interceptors/http.interceptor';
import { authTokenInterceptor } from './shared/services/auth-token.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    // Use enhanced HTTP interceptor with loading and error handling
    provideHttpClient(withInterceptors([httpInterceptor, authTokenInterceptor])),
    // Provide visibility service for page visibility API support
    VisibilityService,
    {
      provide: APP_INITIALIZER,
      useFactory: (svc: TokenRefreshService) => () => svc.init(),
      deps: [TokenRefreshService],
      multi: true
    }
  ]
};
