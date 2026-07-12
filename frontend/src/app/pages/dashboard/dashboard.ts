import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService, Race, Team } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {
  private readonly apiService = inject(ApiService);
  readonly authService = inject(AuthService);

  races: Race[] = [];
  userTeams: Team[] = [];
  isLoading = true;
  errorMessage = '';

  // Stages viewer state
  stages: any[] = [];
  selectedStagesRaceName = '';
  showStagesPanel = false;
  isStagesLoading = false;

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    console.log('Starting dashboard data load...');
    this.isLoading = true;
    
    // Fetch races first
    this.apiService.getRaces().subscribe({
      next: (racesData) => {
        console.log('Races loaded in component:', racesData);
        // Only display races that are active for the current period
        this.races = racesData.filter(r => r.is_active);
        
        // Then fetch user's created teams
        this.apiService.getUserTeams().subscribe({
          next: (teamsData) => {
            console.log('Teams loaded in component:', teamsData);
            this.userTeams = teamsData;
            this.isLoading = false;
            console.log('Dashboard loading finished. isLoading =', this.isLoading);
          },
          error: (err) => {
            console.error('Error fetching user teams:', err);
            this.errorMessage = 'Erro ao carregar suas equipes.';
            this.isLoading = false;
          }
        });
      },
      error: (err) => {
        console.error('Error fetching races:', err);
        this.errorMessage = 'Erro ao carregar as provas de ciclismo.';
        this.isLoading = false;
      }
    });
  }

  // Helper to find a team by race id
  getTeamForRace(raceId: number): Team | undefined {
    return this.userTeams.find(t => t.race_id === raceId);
  }

  // Load and show stages for a race
  viewStages(race: Race): void {
    this.selectedStagesRaceName = race.name;
    this.showStagesPanel = true;
    this.isStagesLoading = true;
    this.stages = [];

    this.apiService.getRaceStages(race.id).subscribe({
      next: (data) => {
        this.stages = data;
        this.isStagesLoading = false;
      },
      error: (err) => {
        console.error('Error fetching stages:', err);
        this.errorMessage = 'Erro ao carregar etapas desta prova.';
        this.isStagesLoading = false;
      }
    });
  }

  closeStages(): void {
    this.showStagesPanel = false;
  }
}
