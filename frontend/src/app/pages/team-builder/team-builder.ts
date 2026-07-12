import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, Athlete, Race } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-team-builder',
  imports: [FormsModule, RouterLink],
  templateUrl: './team-builder.html',
  styleUrl: './team-builder.css'
})
export class TeamBuilderComponent implements OnInit {
  private readonly apiService = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);

  raceId!: number;
  race: Race | null = null;
  isLoading = true;
  isSaving = signal(false);
  errorMessage = '';
  successMessage = '';

  // Form Fields
  teamName = signal('');
  sportsDirector = signal('');
  country = signal('');
  selectedJersey = signal('jersey-yellow');

  // Lists
  athletes = signal<Athlete[]>([]);
  selectedAthletes = signal<Athlete[]>([]);

  // Search & Filter
  searchTerm = signal('');
  selectedTeamFilter = signal('');
  sortBy = signal('value-desc'); // value-desc, value-asc, name-asc

  // Jersey Options
  jerseys = [
    { id: 'jersey-yellow', name: 'Amarela (Tour)', class: 'jersey-yellow', icon: '🟡' },
    { id: 'jersey-pink', name: 'Rosa (Giro)', class: 'jersey-pink', icon: '🌸' },
    { id: 'jersey-red', name: 'Vermelha (Vuelta)', class: 'jersey-red', icon: '🔴' },
    { id: 'jersey-green', name: 'Verde (Pontos)', class: 'jersey-green', icon: '🟢' },
    { id: 'jersey-polka', name: 'Bolinhas (Montanha)', class: 'jersey-polka', icon: '⚪🔴' },
    { id: 'jersey-rainbow', name: 'Arco-Íris (Mundial)', class: 'jersey-rainbow', icon: '🌈' },
    { id: 'jersey-dark', name: 'Preta & Ouro', class: 'jersey-dark', icon: '⚫🏆' },
    { id: 'jersey-blue', name: 'Azul Elétrico', class: 'jersey-blue', icon: '🔵' }
  ];

  // Unique team names list for filtering
  officialTeams = computed(() => {
    const teams = this.athletes().map(a => a.official_team);
    return [...new Set(teams)].sort();
  });

  // Filtered Athletes
  filteredAthletes = computed(() => {
    let result = [...this.athletes()];

    // Search filter
    const search = this.searchTerm().toLowerCase().trim();
    if (search) {
      result = result.filter(a => a.name.toLowerCase().includes(search) || a.nationality.toLowerCase().includes(search));
    }

    // Official Team filter
    const teamFilter = this.selectedTeamFilter();
    if (teamFilter) {
      result = result.filter(a => a.official_team === teamFilter);
    }

    // Sort
    const sort = this.sortBy();
    if (sort === 'value-desc') {
      result.sort((a, b) => b.value - a.value);
    } else if (sort === 'value-asc') {
      result.sort((a, b) => a.value - b.value);
    } else if (sort === 'name-asc') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  });

  // Budget Calculations
  totalSpent = computed(() => {
    return this.selectedAthletes().reduce((sum, a) => sum + a.value, 0);
  });

  budgetRemaining = computed(() => {
    return 1000 - this.totalSpent();
  });

  isBudgetExceeded = computed(() => {
    return this.totalSpent() > 1000;
  });

  athleteCount = computed(() => {
    return this.selectedAthletes().length;
  });

  isTeamValid = computed(() => {
    return (
      this.teamName().trim().length > 0 &&
      this.sportsDirector().trim().length > 0 &&
      this.country().trim().length > 0 &&
      this.athleteCount() === 8 &&
      !this.isBudgetExceeded()
    );
  });

  ngOnInit(): void {
    const raceIdParam = this.route.snapshot.paramMap.get('raceId');
    if (!raceIdParam) {
      this.router.navigate(['/dashboard']);
      return;
    }
    
    this.raceId = parseInt(raceIdParam);
    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    // 1. Fetch races to find details of the selected race
    this.apiService.getRaces().subscribe({
      next: (races) => {
        const foundRace = races.find(r => r.id === this.raceId);
        if (!foundRace || !foundRace.is_active) {
          this.router.navigate(['/dashboard']);
          return;
        }
        this.race = foundRace;

        // 2. Fetch athletes of this race
        this.apiService.getAthletesByRace(this.raceId).subscribe({
          next: (athletesData) => {
            this.athletes.set(athletesData);

            // 3. Check if user already has a team for this race to edit
            this.apiService.getTeamForRace(this.raceId).subscribe({
              next: (existingTeam) => {
                if (existingTeam) {
                  this.teamName.set(existingTeam.team_name);
                  this.sportsDirector.set(existingTeam.sports_director);
                  this.country.set(existingTeam.country);
                  this.selectedJersey.set(existingTeam.jersey_icon);
                  
                  if (existingTeam.athletes) {
                    this.selectedAthletes.set(existingTeam.athletes);
                  }
                }
                this.isLoading = false;
              },
              error: (err) => {
                // If 404 (no team), it's normal. Just stop loading.
                if (err.status === 404 || err.error?.noTeam) {
                  this.isLoading = false;
                } else {
                  console.error('Error fetching existing team:', err);
                  this.errorMessage = 'Erro ao verificar equipe existente.';
                  this.isLoading = false;
                }
              }
            });
          },
          error: (err) => {
            console.error('Error fetching athletes:', err);
            this.errorMessage = 'Erro ao carregar atletas.';
            this.isLoading = false;
          }
        });
      },
      error: (err) => {
        console.error('Error fetching races:', err);
        this.errorMessage = 'Erro ao carregar prova.';
        this.isLoading = false;
      }
    });
  }

  // Add athlete to squad
  addAthlete(athlete: Athlete): void {
    const currentList = this.selectedAthletes();
    
    // Check if already in list
    if (currentList.some(a => a.id === athlete.id)) {
      return;
    }

    // Limit to 8 athletes
    if (currentList.length >= 8) {
      this.errorMessage = 'Sua equipe já tem o limite de 8 atletas. Remova um para adicionar outro.';
      return;
    }

    this.errorMessage = '';
    this.selectedAthletes.set([...currentList, athlete]);
  }

  // Remove athlete from squad
  removeAthlete(athleteId: number): void {
    const currentList = this.selectedAthletes();
    this.selectedAthletes.set(currentList.filter(a => a.id !== athleteId));
    this.errorMessage = '';
  }

  // Toggle selection
  toggleAthlete(athlete: Athlete): void {
    const isSelected = this.selectedAthletes().some(a => a.id === athlete.id);
    if (isSelected) {
      this.removeAthlete(athlete.id);
    } else {
      this.addAthlete(athlete);
    }
  }

  isAthleteSelected(athleteId: number): boolean {
    return this.selectedAthletes().some(a => a.id === athleteId);
  }

  // Save/Submit Team
  saveTeam(): void {
    if (!this.isTeamValid()) {
      return;
    }

    this.isSaving.set(true);
    this.errorMessage = '';
    this.successMessage = '';

    const teamData = {
      race_id: this.raceId,
      team_name: this.teamName(),
      sports_director: this.sportsDirector(),
      jersey_icon: this.selectedJersey(),
      country: this.country(),
      athlete_ids: this.selectedAthletes().map(a => a.id)
    };

    this.apiService.saveTeam(teamData).subscribe({
      next: (res) => {
        this.successMessage = 'Equipe salva com sucesso! Redirecionando...';
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 1500);
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = err.error?.message || 'Erro ao salvar sua equipe. Verifique as restrições.';
        this.isSaving.set(false);
      }
    });
  }
}
