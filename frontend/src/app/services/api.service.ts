import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface User {
  id: number;
  email: string;
  is_admin: boolean;
  created_at: string;
}

export interface Sponsor {
  id?: number;
  name: string;
  logo_url: string;
  website_url: string;
  description: string;
}

export interface Race {
  id: number;
  name: string;
  description: string;
  year: number;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
}

export interface Athlete {
  id: number;
  race_id: number;
  name: string;
  nationality: string;
  official_team: string;
  value: number;
}

export interface Team {
  id?: number;
  race_id: number;
  race_name?: string;
  team_name: string;
  sports_director: string;
  jersey_icon: string;
  country: string;
  total_spent?: number;
  athletes?: Athlete[];
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  // --- Sponsors ---
  getSponsors(): Observable<Sponsor[]> {
    return this.http.get<Sponsor[]>(`${this.baseUrl}/sponsors`);
  }

  addSponsor(sponsor: Sponsor): Observable<{ message: string, sponsor: Sponsor }> {
    return this.http.post<{ message: string, sponsor: Sponsor }>(`${this.baseUrl}/sponsors`, sponsor);
  }

  deleteSponsor(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/sponsors/${id}`);
  }

  // --- Races & Athletes ---
  getRaces(): Observable<Race[]> {
    return this.http.get<Race[]>(`${this.baseUrl}/races`);
  }

  getAthletesByRace(raceId: number): Observable<Athlete[]> {
    return this.http.get<Athlete[]>(`${this.baseUrl}/races/${raceId}/athletes`);
  }

  addAthlete(athlete: Omit<Athlete, 'id'>): Observable<{ message: string, athlete: Athlete }> {
    return this.http.post<{ message: string, athlete: Athlete }>(`${this.baseUrl}/races/athletes`, athlete);
  }

  updateAthlete(id: number, athlete: Omit<Athlete, 'id'>): Observable<{ message: string, athlete: Athlete }> {
    return this.http.put<{ message: string, athlete: Athlete }>(`${this.baseUrl}/races/athletes/${id}`, athlete);
  }

  deleteAthlete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/races/athletes/${id}`);
  }

  // --- Teams ---
  getUserTeams(): Observable<Team[]> {
    return this.http.get<Team[]>(`${this.baseUrl}/teams`);
  }

  getTeamForRace(raceId: number): Observable<Team> {
    return this.http.get<Team>(`${this.baseUrl}/teams/race/${raceId}`);
  }

  saveTeam(teamData: {
    race_id: number;
    team_name: string;
    sports_director: string;
    jersey_icon: string;
    country: string;
    athlete_ids: number[];
  }): Observable<{ message: string, teamId: number, totalSpent: number }> {
    return this.http.post<{ message: string, teamId: number, totalSpent: number }>(`${this.baseUrl}/teams`, teamData);
  }

  // --- User Administration (Admin only) ---
  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.baseUrl}/auth/users`);
  }

  toggleUserAdmin(id: number): Observable<{ message: string, is_admin: boolean }> {
    return this.http.put<{ message: string, is_admin: boolean }>(`${this.baseUrl}/auth/users/${id}/toggle-admin`, {});
  }

  deleteUser(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/auth/users/${id}`);
  }

  createAdmin(email: string, password: string): Observable<{ message: string, user: User }> {
    return this.http.post<{ message: string, user: User }>(`${this.baseUrl}/auth/users/admin`, { email, password });
  }

  // --- Leagues and Stages ---
  createLeague(name: string, raceId: number): Observable<{ message: string, league: any, joinedCreatorTeam: boolean }> {
    return this.http.post<{ message: string, league: any, joinedCreatorTeam: boolean }>(`${this.baseUrl}/leagues`, { name, race_id: raceId });
  }

  joinLeague(code: string): Observable<{ message: string, league: any }> {
    return this.http.post<{ message: string, league: any }>(`${this.baseUrl}/leagues/join`, { code });
  }

  getLeagues(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/leagues`);
  }

  getLeagueDetails(id: number): Observable<{ league: any, standings: any[] }> {
    return this.http.get<{ league: any, standings: any[] }>(`${this.baseUrl}/leagues/${id}`);
  }

  getRaceStages(raceId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/races/${raceId}/stages`);
  }

  addRace(raceData: { name: string, description: string, year: number, start_date: string, end_date: string }): Observable<{ message: string, race: Race }> {
    return this.http.post<{ message: string, race: Race }>(`${this.baseUrl}/races`, raceData);
  }

  updateRace(id: number, raceData: { name: string, description: string, year: number, start_date: string, end_date: string }): Observable<{ message: string, race: Race }> {
    return this.http.put<{ message: string, race: Race }>(`${this.baseUrl}/races/${id}`, raceData);
  }

  getTelemetrySummary(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/telemetry`);
  }
}
