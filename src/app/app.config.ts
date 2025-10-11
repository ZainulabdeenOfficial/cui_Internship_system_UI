import { ApplicationConfig, APP_INITIALIZER, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { TokenRefreshService } from './shared/services/token-refresh.service';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { jsonInterceptor } from './shared/services/http.interceptor';
import { authTokenInterceptor } from './shared/services/auth-token.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([jsonInterceptor, authTokenInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: (svc: TokenRefreshService) => () => svc.init(),
      deps: [TokenRefreshService],
      multi: true
    }
  ]
};
