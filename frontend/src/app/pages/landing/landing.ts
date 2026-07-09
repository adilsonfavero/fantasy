import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, Sponsor } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.css'
})
export class LandingComponent implements OnInit {
  private readonly apiService = inject(ApiService);
  readonly authService = inject(AuthService);

  sponsors: Sponsor[] = [];
  errorMessage = '';

  ngOnInit(): void {
    this.apiService.getSponsors().subscribe({
      next: (data) => {
        this.sponsors = data;
      },
      error: (err) => {
        console.error('Error fetching sponsors:', err);
        this.errorMessage = 'Não foi possível carregar os patrocinadores no momento.';
      }
    });
  }
}
