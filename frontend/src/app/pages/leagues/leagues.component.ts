import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-leagues',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './leagues.component.html',
  styleUrls: ['./leagues.component.css']
})
export class LeaguesComponent implements OnInit {
  leagues: any[] = [];
  races: any[] = [];
  selectedRaceId: number | null = null;
  leagueName = '';
  joinCode = '';
  
  selectedLeague: any = null;
  selectedLeagueStandings: any[] = [];
  
  errorMessage = '';
  successMessage = '';
  isLoading = false;
  isSubmitting = false;
  isDetailsLoading = false;

  constructor(
    private apiService: ApiService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadLeagues();
    this.loadRaces();
  }

  loadLeagues(): void {
    this.isLoading = true;
    this.apiService.getLeagues().subscribe({
      next: (data) => {
        this.leagues = data;
        this.isLoading = false;
        // Auto-select first league if available and none selected
        if (this.leagues.length > 0 && !this.selectedLeague) {
          this.selectLeague(this.leagues[0]);
        }
      },
      error: (err) => {
        console.error('Error fetching leagues:', err);
        this.errorMessage = 'Erro ao carregar suas ligas.';
        this.isLoading = false;
      }
    });
  }

  loadRaces(): void {
    this.apiService.getRaces().subscribe({
      next: (data) => {
        // Only allow creating leagues for active events
        this.races = data.filter(r => r.is_active);
        if (this.races.length > 0) {
          this.selectedRaceId = this.races[0].id;
        }
      },
      error: (err) => {
        console.error('Error fetching races:', err);
      }
    });
  }

  onCreateLeague(): void {
    if (!this.leagueName || !this.selectedRaceId) {
      this.errorMessage = 'Por favor, informe o nome da liga e selecione a prova.';
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.isSubmitting = true;

    this.apiService.createLeague(this.leagueName, this.selectedRaceId).subscribe({
      next: (res) => {
        this.successMessage = res.joinedCreatorTeam 
          ? `Liga "${res.league.name}" criada! Código: ${res.league.code}. Sua equipe foi adicionada.`
          : `Liga "${res.league.name}" criada com sucesso! Código: ${res.league.code}. Monte sua equipe para participar do ranking!`;
        
        this.leagueName = '';
        this.loadLeagues();
        this.isSubmitting = false;
        
        // Auto-select the newly created league
        this.selectLeague(res.league);
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = err.error?.message || 'Erro ao criar liga de fantasy.';
        this.isSubmitting = false;
      }
    });
  }

  onJoinLeague(): void {
    if (!this.joinCode) {
      this.errorMessage = 'Por favor, insira o código numérico da liga.';
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.isSubmitting = true;

    this.apiService.joinLeague(this.joinCode).subscribe({
      next: (res) => {
        this.successMessage = `Você entrou na liga "${res.league.name}" com sucesso!`;
        this.joinCode = '';
        this.loadLeagues();
        this.isSubmitting = false;
        
        // Auto-select the newly joined league
        this.selectLeague(res.league);
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = err.error?.message || 'Erro ao ingressar na liga.';
        this.isSubmitting = false;
      }
    });
  }

  selectLeague(league: any): void {
    this.selectedLeague = league;
    this.isDetailsLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.apiService.getLeagueDetails(league.id).subscribe({
      next: (res) => {
        this.selectedLeague = res.league;
        this.selectedLeagueStandings = res.standings;
        this.isDetailsLoading = false;
      },
      error: (err) => {
        console.error('Error fetching league details:', err);
        this.errorMessage = 'Erro ao carregar detalhes e classificação da liga.';
        this.isDetailsLoading = false;
      }
    });
  }
}
