import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { catchError, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TelemetryService {
  private readonly http = inject(HttpClient);
  private readonly telemetryUrl = `${environment.apiUrl}/telemetry`;

  trackAccess(): void {
    // Prevent tracking multiple times in the same session tab
    if (sessionStorage.getItem('telemetry_tracked') === 'true') {
      return;
    }

    // Call free geolocation API over HTTPS
    this.http.get<any>('https://ipapi.co/json/').pipe(
      catchError(err => {
        console.warn('Geolocation API failed. Falling back to backend IP lookup:', err);
        return of({
          country_name: 'Unknown (Fallback)',
          region: 'Unknown (Fallback)',
          city: 'Unknown (Fallback)'
        });
      })
    ).subscribe({
      next: (geo) => {
        const payload = {
          country: geo.country_name || 'Desconhecido',
          state: geo.region || 'Desconhecido',
          city: geo.city || 'Desconhecido'
        };

        const headers: any = {};
        const token = localStorage.getItem('token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        this.http.post(this.telemetryUrl, payload, { headers }).pipe(
          catchError(err => {
            console.error('Failed to submit telemetry logs:', err);
            return of(null);
          })
        ).subscribe(() => {
          sessionStorage.setItem('telemetry_tracked', 'true');
        });
      }
    });
  }
}
