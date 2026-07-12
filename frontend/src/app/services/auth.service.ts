import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

export interface User {
  id: number;
  email: string;
  isAdmin: boolean;
}

interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  
  // Current user signal
  readonly currentUser = signal<User | null>(null);
  readonly isLoading = signal<boolean>(true);

  constructor() {
    this.checkSession();
  }

  // Check if token exists and is valid
  checkSession(): void {
    const token = localStorage.getItem('token');
    if (!token) {
      this.currentUser.set(null);
      this.isLoading.set(false);
      return;
    }

    this.http.get<{ user: User }>(`${this.apiUrl}/profile`).subscribe({
      next: (res) => {
        this.currentUser.set(res.user);
        this.isLoading.set(false);
      },
      error: () => {
        // Token invalid or expired, clear it
        this.logout();
        this.isLoading.set(false);
      }
    });
  }

  // Register new user
  register(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, { email, password }).pipe(
      tap(res => {
        localStorage.setItem('token', res.token);
        this.currentUser.set(res.user);
      })
    );
  }

  // Login user
  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap(res => {
        localStorage.setItem('token', res.token);
        this.currentUser.set(res.user);
      })
    );
  }

  // Logout
  logout(): void {
    localStorage.removeItem('token');
    this.currentUser.set(null);
  }

  // Check if current user is admin
  isAdmin(): boolean {
    return this.currentUser()?.isAdmin === true;
  }
}
