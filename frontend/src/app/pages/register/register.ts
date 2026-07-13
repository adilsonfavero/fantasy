import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, CommonModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class RegisterComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  email = '';
  password = '';
  confirmPassword = '';
  birthDate = '';
  selectedCountry = '';
  selectedState = '';
  selectedCity = '';
  errorMessage = '';
  isSubmitting = signal(false);

  // Geo selection state
  countries: string[] = [];
  states: string[] = [];
  cities: string[] = [];
  
  isLoadingCountries = signal(false);
  isLoadingStates = signal(false);
  isLoadingCities = signal(false);

  // Fallback indicators
  useTextState = false;
  useTextCity = false;

  // Pre-defined fallback countries in case API is offline or has issues
  fallbackCountries = [
    'Brasil', 'Portugal', 'Espanha', 'França', 'Itália', 'Bélgica', 
    'Colômbia', 'Estados Unidos', 'Reino Unido', 'Alemanha', 
    'Países Baixos', 'Equador', 'Canadá', 'Austrália', 'Outro'
  ];

  ngOnInit(): void {
    this.loadCountries();
  }

  loadCountries(): void {
    this.isLoadingCountries.set(true);
    this.http.get<any>('https://countriesnow.space/api/v0.1/countries/iso').pipe(
      catchError(err => {
        console.warn('Countries API failed, loading fallback countries:', err);
        return of({ data: this.fallbackCountries.map(c => ({ name: c })) });
      })
    ).subscribe({
      next: (res) => {
        if (res && res.data) {
          this.countries = res.data.map((c: any) => c.name).sort();
        } else {
          this.countries = this.fallbackCountries;
        }
        this.isLoadingCountries.set(false);
      },
      error: () => {
        this.countries = this.fallbackCountries;
        this.isLoadingCountries.set(false);
      }
    });
  }

  onCountryChange(): void {
    this.states = [];
    this.cities = [];
    this.selectedState = '';
    this.selectedCity = '';
    this.useTextState = false;
    this.useTextCity = false;

    if (!this.selectedCountry) return;

    this.isLoadingStates.set(true);
    this.http.post<any>('https://countriesnow.space/api/v0.1/countries/states', {
      country: this.selectedCountry
    }).pipe(
      catchError(err => {
        console.warn('States API failed, switching to text input:', err);
        this.useTextState = true;
        this.useTextCity = true;
        return of({ data: { states: [] } });
      })
    ).subscribe({
      next: (res) => {
        this.isLoadingStates.set(false);
        if (res && res.data && res.data.states && res.data.states.length > 0) {
          this.states = res.data.states.map((s: any) => s.name).sort();
          this.useTextState = false;
        } else {
          this.useTextState = true;
          this.useTextCity = true;
        }
      },
      error: () => {
        this.useTextState = true;
        this.useTextCity = true;
        this.isLoadingStates.set(false);
      }
    });
  }

  onStateChange(): void {
    this.cities = [];
    this.selectedCity = '';
    this.useTextCity = false;

    if (!this.selectedState) return;

    this.isLoadingCities.set(true);
    this.http.post<any>('https://countriesnow.space/api/v0.1/countries/state/cities', {
      country: this.selectedCountry,
      state: this.selectedState
    }).pipe(
      catchError(err => {
        console.warn('Cities API failed, switching to text input:', err);
        this.useTextCity = true;
        return of({ data: [] });
      })
    ).subscribe({
      next: (res) => {
        this.isLoadingCities.set(false);
        if (res && res.data && res.data.length > 0) {
          this.cities = res.data.sort();
          this.useTextCity = false;
        } else {
          this.useTextCity = true;
        }
      },
      error: () => {
        this.useTextCity = true;
        this.isLoadingCities.set(false);
      }
    });
  }

  onSubmit(): void {
    if (!this.email || !this.password || !this.confirmPassword || !this.birthDate || !this.selectedCountry || !this.selectedState || !this.selectedCity) {
      this.errorMessage = 'Preencha todos os campos obrigatórios.';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'As senhas não coincidem.';
      return;
    }

    this.errorMessage = '';
    this.isSubmitting.set(true);

    this.authService.register(
      this.email,
      this.password,
      this.birthDate,
      this.selectedCountry,
      this.selectedState,
      this.selectedCity
    ).subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = err.error?.message || 'Falha ao cadastrar. Tente novamente.';
        this.isSubmitting.set(false);
      }
    });
  }
}
