import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { TelemetryService } from './services/telemetry.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly telemetryService = inject(TelemetryService);

  ngOnInit(): void {
    this.telemetryService.trackAccess();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
