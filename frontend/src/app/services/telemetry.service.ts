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
    // Prevent double tracking in the same session tab
    if (sessionStorage.getItem('telemetry_tracked') === 'true') {
      return;
    }

    const headers: any = {};
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Direct ping to backend telemetry log endpoint. 
    // Backend resolves the visitor IP address to a geolocation country, state, and city.
    this.http.post(this.telemetryUrl, {}, { headers }).pipe(
      catchError(err => {
        console.error('Failed to submit telemetry logs:', err);
        return of(null);
      })
    ).subscribe(() => {
      sessionStorage.setItem('telemetry_tracked', 'true');
    });
  }
}
