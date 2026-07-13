import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Sponsor, Race, Athlete, User, JerseyType, ScoringRule, StageResult, StageJerseyLeader } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class AdminComponent implements OnInit {
  private readonly apiService = inject(ApiService);
  readonly authService = inject(AuthService);

  // Tabs: 'sponsors' | 'athletes' | 'users' | 'telemetry'
  activeTab = signal<'sponsors' | 'athletes' | 'users' | 'telemetry'>('sponsors');

  // General State
  isLoading = true;
  isSubmitting = signal(false);
  errorMessage = '';
  successMessage = '';

  // Sponsors State & Form
  sponsors: Sponsor[] = [];
  name = '';
  logoUrl = '';
  websiteUrl = '';
  description = '';
  editingSponsorId = signal<number | null>(null);

  // Athletes State & Forms
  races: Race[] = [];
  selectedRaceId = signal<number | null>(null);
  athletes: Athlete[] = [];
  
  // Athlete Form fields
  athleteName = '';
  athleteNationality = '';
  athleteTeam = '';
  athleteValue = 150;
  editingAthleteId = signal<number | null>(null);

  // Race/Event Form fields
  raceName = '';
  raceDescription = '';
  raceYear = new Date().getFullYear();
  raceStartDate = '';
  raceEndDate = '';
  editingRaceId = signal<number | null>(null);

  // Users State
  users: User[] = [];

  // Telemetry State
  telemetryData: any = null;

  // ---- Jersey Types State ----
  jerseyTypes: JerseyType[] = [];
  jerseyName = '';
  jerseyColor = '#FFD700';
  jerseyIcon = '👕';
  jerseyPointsPerStage = 10;
  editingJerseyId = signal<number | null>(null);

  availableJerseyIcons = [
    { icon: '🟡', name: 'Amarela (Líder Geral - Tour)' },
    { icon: '🟢', name: 'Verde (Pontos - Tour/Vuelta)' },
    { icon: '⚪🔴', name: 'Bolinhas Vermelhas (Montanha - Tour)' },
    { icon: '⚪', name: 'Branca (Jovem - Tour/Giro/Vuelta)' },
    { icon: '💖', name: 'Rosa (Líder Geral - Giro)' },
    { icon: '💜', name: 'Ciclamino (Pontos - Giro)' },
    { icon: '🔵', name: 'Azul (Montanha - Giro)' },
    { icon: '🔴', name: 'Vermelha (Líder Geral - Vuelta)' },
    { icon: '⚪🔵', name: 'Bolinhas Azuis (Montanha - Vuelta)' },
    { icon: '🌈', name: 'Arco-íris (Campeão Mundial)' },
    { icon: '👕', name: 'Padrão' }
  ];

  // ---- Scoring Rules State ----
  scoringRules: ScoringRule[] = [];

  // ---- Stage Results State ----
  stages: any[] = [];
  selectedStageId = signal<number | null>(null);
  stageResultEntries: { position: number; athlete_id: number | null; points_awarded: number }[] = [];
  jerseyLeaderEntries: { jersey_type_id: number; athlete_id: number | null }[] = [];
  savedStageResults: StageResult[] = [];
  savedJerseyLeaders: StageJerseyLeader[] = [];

  // Active event sub-tab: 'event-info' | 'jerseys' | 'scoring' | 'results' | 'athletes-mgmt'
  activeEventSubTab = signal<'event-info' | 'jerseys' | 'scoring' | 'results' | 'athletes-mgmt'>('event-info');

  ngOnInit(): void {
    this.loadSponsors();
    this.loadRaces();
  }

  setTab(tab: 'sponsors' | 'athletes' | 'users' | 'telemetry'): void {
    this.activeTab.set(tab);
    this.activeEventSubTab.set('event-info');
    this.errorMessage = '';
    this.successMessage = '';
    
    if (tab === 'users') {
      this.loadUsers();
    } else if (tab === 'sponsors') {
      this.loadSponsors();
    } else if (tab === 'athletes') {
      this.loadRaces();
      this.loadAthletesForSelectedRace();
    } else if (tab === 'telemetry') {
      this.loadTelemetry();
    }
  }

  setEventSubTab(sub: 'event-info' | 'jerseys' | 'scoring' | 'results' | 'athletes-mgmt'): void {
    this.activeEventSubTab.set(sub);
    this.errorMessage = '';
    this.successMessage = '';
    const raceId = this.selectedRaceId();
    if (!raceId) return;
    if (sub === 'jerseys') this.loadJerseyTypes(raceId);
    if (sub === 'scoring') this.loadScoringRules(raceId);
    if (sub === 'results') {
      this.loadStages(raceId);
      this.loadJerseyTypes(raceId);
    }
  }

  // --- Sponsors ---
  loadSponsors(): void {
    this.isLoading = true;
    this.apiService.getSponsors().subscribe({
      next: (data) => {
        this.sponsors = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching sponsors:', err);
        this.errorMessage = 'Erro ao buscar patrocinadores.';
        this.isLoading = false;
      }
    });
  }

  onSubmitSponsor(): void {
    if (!this.name || !this.description) {
      this.errorMessage = 'Nome e Descrição são obrigatórios.';
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.isSubmitting.set(true);

    const sponsorData: Sponsor = {
      name: this.name,
      logo_url: this.logoUrl || '',
      website_url: this.websiteUrl || '',
      description: this.description
    };

    const editId = this.editingSponsorId();
    if (editId) {
      // Update existing sponsor
      this.apiService.updateSponsor(editId, sponsorData).subscribe({
        next: () => {
          this.successMessage = 'Patrocinador atualizado com sucesso!';
          this.cancelEditSponsor();
          this.loadSponsors();
          this.isSubmitting.set(false);
        },
        error: (err) => {
          console.error(err);
          this.errorMessage = err.error?.message || 'Erro ao atualizar patrocinador.';
          this.isSubmitting.set(false);
        }
      });
    } else {
      // Create new sponsor
      this.apiService.addSponsor(sponsorData).subscribe({
        next: () => {
          this.successMessage = 'Patrocinador adicionado com sucesso!';
          this.cancelEditSponsor();
          this.loadSponsors();
          this.isSubmitting.set(false);
        },
        error: (err) => {
          console.error(err);
          this.errorMessage = err.error?.message || 'Erro ao cadastrar patrocinador.';
          this.isSubmitting.set(false);
        }
      });
    }
  }

  startEditSponsor(sponsor: Sponsor): void {
    this.editingSponsorId.set(sponsor.id!);
    this.name = sponsor.name;
    this.logoUrl = sponsor.logo_url || '';
    this.websiteUrl = sponsor.website_url || '';
    this.description = sponsor.description;
    this.errorMessage = '';
    this.successMessage = '';
    // Scroll to top of admin panel so user sees the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEditSponsor(): void {
    this.editingSponsorId.set(null);
    this.name = '';
    this.logoUrl = '';
    this.websiteUrl = '';
    this.description = '';
    this.errorMessage = '';
  }

  deleteSponsor(id: number): void {
    if (!confirm('Deseja realmente remover esta empresa patrocinadora?')) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    this.apiService.deleteSponsor(id).subscribe({
      next: () => {
        this.successMessage = 'Patrocinador removido com sucesso!';
        this.loadSponsors();
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = 'Erro ao remover patrocinador.';
      }
    });
  }

  // --- Athletes ---
  loadRaces(): void {
    this.apiService.getRaces().subscribe({
      next: (data) => {
        this.races = data;
        if (data.length > 0 && !this.selectedRaceId()) {
          this.selectedRaceId.set(data[0].id);
          this.loadAthletesForSelectedRace();
        }
      },
      error: (err) => {
        console.error('Error fetching races:', err);
      }
    });
  }

  onRaceChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedRaceId.set(parseInt(target.value));
    this.cancelEditAthlete();
    this.loadAthletesForSelectedRace();
  }

  loadAthletesForSelectedRace(): void {
    const raceId = this.selectedRaceId();
    if (!raceId) return;

    this.isLoading = true;
    this.apiService.getAthletesByRace(raceId).subscribe({
      next: (data) => {
        this.athletes = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching athletes for race:', err);
        this.errorMessage = 'Erro ao buscar atletas da prova selecionada.';
        this.isLoading = false;
      }
    });
  }

  onSubmitAthlete(): void {
    const raceId = this.selectedRaceId();
    if (!raceId) {
      this.errorMessage = 'Nenhum evento selecionado.';
      return;
    }

    if (!this.athleteName || !this.athleteNationality || !this.athleteTeam || this.athleteValue === undefined) {
      this.errorMessage = 'Todos os campos do atleta são obrigatórios.';
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.isSubmitting.set(true);

    const athleteData = {
      race_id: raceId,
      name: this.athleteName,
      nationality: this.athleteNationality,
      official_team: this.athleteTeam,
      value: this.athleteValue
    };

    const editId = this.editingAthleteId();
    if (editId) {
      // Update
      this.apiService.updateAthlete(editId, athleteData).subscribe({
        next: () => {
          this.successMessage = 'Atleta atualizado com sucesso!';
          this.cancelEditAthlete();
          this.loadAthletesForSelectedRace();
          this.isSubmitting.set(false);
        },
        error: (err) => {
          console.error(err);
          this.errorMessage = err.error?.message || 'Erro ao atualizar atleta.';
          this.isSubmitting.set(false);
        }
      });
    } else {
      // Create
      this.apiService.addAthlete(athleteData).subscribe({
        next: () => {
          this.successMessage = 'Atleta cadastrado com sucesso!';
          this.athleteName = '';
          this.athleteNationality = '';
          this.athleteTeam = '';
          this.athleteValue = 150;
          this.loadAthletesForSelectedRace();
          this.isSubmitting.set(false);
        },
        error: (err) => {
          console.error(err);
          this.errorMessage = err.error?.message || 'Erro ao cadastrar atleta.';
          this.isSubmitting.set(false);
        }
      });
    }
  }

  startEditAthlete(athlete: Athlete): void {
    this.editingAthleteId.set(athlete.id);
    this.athleteName = athlete.name;
    this.athleteNationality = athlete.nationality;
    this.athleteTeam = athlete.official_team;
    this.athleteValue = athlete.value;
    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelEditAthlete(): void {
    this.editingAthleteId.set(null);
    this.athleteName = '';
    this.athleteNationality = '';
    this.athleteTeam = '';
    this.athleteValue = 150;
    this.errorMessage = '';
  }

  deleteAthlete(id: number): void {
    if (!confirm('Deseja realmente excluir este atleta?')) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    this.apiService.deleteAthlete(id).subscribe({
      next: () => {
        this.successMessage = 'Atleta excluído com sucesso!';
        this.loadAthletesForSelectedRace();
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = 'Erro ao excluir atleta.';
      }
    });
  }

  // --- Users ---
  loadUsers(): void {
    this.isLoading = true;
    this.apiService.getUsers().subscribe({
      next: (data) => {
        this.users = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching users:', err);
        this.errorMessage = 'Erro ao buscar usuários.';
        this.isLoading = false;
      }
    });
  }

  toggleUserAdmin(user: User): void {
    const currentUserId = this.authService.currentUser()?.id;
    if (user.id === currentUserId) {
      alert('Você não pode revogar seus próprios privilégios de administrador.');
      return;
    }

    if (!confirm(`Deseja alterar as permissões de administrador para ${user.email}?`)) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    this.apiService.toggleUserAdmin(user.id).subscribe({
      next: (res) => {
        this.successMessage = res.message;
        this.loadUsers();
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = err.error?.message || 'Erro ao alterar privilégios do usuário.';
      }
    });
  }

  deleteUser(user: User): void {
    const currentUserId = this.authService.currentUser()?.id;
    if (user.id === currentUserId) {
      alert('Você não pode excluir sua própria conta de administrador.');
      return;
    }

    if (!confirm(`Deseja realmente excluir permanentemente a conta de ${user.email}? Isso apagará todas as equipes criadas por ele!`)) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    this.apiService.deleteUser(user.id).subscribe({
      next: (res) => {
        this.successMessage = res.message;
        this.loadUsers();
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = err.error?.message || 'Erro ao excluir usuário.';
      }
    });
  }

  // --- Create Administrator ---
  adminEmail = '';
  adminPassword = '';

  onSubmitAdmin(): void {
    if (!this.adminEmail || !this.adminPassword) {
      this.errorMessage = 'E-mail e Senha são obrigatórios para criar um administrador.';
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.isSubmitting.set(true);

    this.apiService.createAdmin(this.adminEmail, this.adminPassword).subscribe({
      next: (res) => {
        this.successMessage = res.message || 'Novo administrador cadastrado com sucesso!';
        this.adminEmail = '';
        this.adminPassword = '';
        this.loadUsers();
        this.isSubmitting.set(false);
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = err.error?.message || 'Erro ao cadastrar novo administrador.';
        this.isSubmitting.set(false);
      }
    });
  }

  // --- Telemetry & Event Management ---
  loadTelemetry(): void {
    this.isLoading = true;
    this.apiService.getTelemetrySummary().subscribe({
      next: (data) => {
        this.telemetryData = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading telemetry:', err);
        this.errorMessage = 'Erro ao carregar dados de telemetria.';
        this.isLoading = false;
      }
    });
  }

  onSubmitRace(): void {
    if (!this.raceName || !this.raceYear || !this.raceStartDate || !this.raceEndDate) {
      this.errorMessage = 'Nome, ano, data de início e data de fim são obrigatórios.';
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.isSubmitting.set(true);

    const raceData = {
      name: this.raceName,
      description: this.raceDescription,
      year: parseInt(this.raceYear as any),
      start_date: this.raceStartDate,
      end_date: this.raceEndDate
    };

    const editId = this.editingRaceId();
    if (editId) {
      this.apiService.updateRace(editId, raceData).subscribe({
        next: () => {
          this.successMessage = 'Evento atualizado com sucesso!';
          this.cancelEditRace();
          this.loadRaces();
          this.isSubmitting.set(false);
        },
        error: (err) => {
          console.error(err);
          this.errorMessage = err.error?.message || 'Erro ao atualizar evento.';
          this.isSubmitting.set(false);
        }
      });
    } else {
      this.apiService.addRace(raceData).subscribe({
        next: () => {
          this.successMessage = 'Evento criado com sucesso!';
          this.cancelEditRace();
          this.loadRaces();
          this.isSubmitting.set(false);
        },
        error: (err) => {
          console.error(err);
          this.errorMessage = err.error?.message || 'Erro ao criar evento.';
          this.isSubmitting.set(false);
        }
      });
    }
  }

  startEditRace(race: Race): void {
    this.editingRaceId.set(race.id);
    this.raceName = race.name;
    this.raceDescription = race.description || '';
    this.raceYear = race.year;
    this.raceStartDate = race.start_date || '';
    this.raceEndDate = race.end_date || '';
    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelEditRace(): void {
    this.editingRaceId.set(null);
    this.raceName = '';
    this.raceDescription = '';
    this.raceYear = new Date().getFullYear();
    this.raceStartDate = '';
    this.raceEndDate = '';
    this.errorMessage = '';
  }

  // ---- Jersey Types Methods ----
  loadJerseyTypes(raceId: number): void {
    this.apiService.getJerseyTypes(raceId).subscribe({
      next: (data) => { this.jerseyTypes = data; },
      error: (err) => console.error('Error loading jersey types:', err)
    });
  }

  onSubmitJersey(): void {
    const raceId = this.selectedRaceId();
    if (!raceId || !this.jerseyName) {
      this.errorMessage = 'Selecione um evento e preencha o nome da camisa.';
      return;
    }
    this.isSubmitting.set(true);
    this.errorMessage = '';
    this.successMessage = '';
    const jerseyData = { name: this.jerseyName, color: this.jerseyColor, icon: this.jerseyIcon, points_per_stage: this.jerseyPointsPerStage };
    const editId = this.editingJerseyId();
    const obs$ = editId
      ? this.apiService.updateJerseyType(editId, jerseyData)
      : this.apiService.addJerseyType(raceId, jerseyData);

    obs$.subscribe({
      next: () => {
        this.successMessage = editId ? 'Camisa atualizada com sucesso!' : 'Camisa criada com sucesso!';
        this.cancelEditJersey();
        this.loadJerseyTypes(raceId);
        this.isSubmitting.set(false);
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Erro ao salvar camisa.';
        this.isSubmitting.set(false);
      }
    });
  }

  startEditJersey(jersey: JerseyType): void {
    this.editingJerseyId.set(jersey.id!);
    this.jerseyName = jersey.name;
    this.jerseyColor = jersey.color;
    this.jerseyIcon = jersey.icon;
    this.jerseyPointsPerStage = jersey.points_per_stage;
    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelEditJersey(): void {
    this.editingJerseyId.set(null);
    this.jerseyName = '';
    this.jerseyColor = '#FFD700';
    this.jerseyIcon = '🟡';
    this.jerseyPointsPerStage = 10;
    this.errorMessage = '';
  }

  deleteJersey(id: number): void {
    if (!confirm('Deseja realmente remover esta camisa?')) return;
    this.apiService.deleteJerseyType(id).subscribe({
      next: () => {
        this.successMessage = 'Camisa removida com sucesso!';
        const raceId = this.selectedRaceId();
        if (raceId) this.loadJerseyTypes(raceId);
      },
      error: () => { this.errorMessage = 'Erro ao remover camisa.'; }
    });
  }

  // ---- Scoring Rules Methods ----
  loadScoringRules(raceId: number): void {
    this.apiService.getScoringRules(raceId).subscribe({
      next: (data) => {
        // If no rules saved yet, build default 20 positions
        if (data.length === 0) {
          const defaults = [50, 30, 20, 16, 14, 12, 10, 8, 6, 5, 4, 3, 2, 1, 1, 0, 0, 0, 0, 0];
          this.scoringRules = defaults.map((pts, i) => ({ race_id: raceId, position: i + 1, points: pts }));
        } else {
          this.scoringRules = data;
        }
      },
      error: (err) => console.error('Error loading scoring rules:', err)
    });
  }

  saveScoringRules(): void {
    const raceId = this.selectedRaceId();
    if (!raceId) return;
    this.isSubmitting.set(true);
    this.errorMessage = '';
    this.successMessage = '';
    this.apiService.saveScoringRules(raceId, this.scoringRules.map(r => ({ position: r.position, points: r.points }))).subscribe({
      next: () => {
        this.successMessage = 'Tabela de pontuação salva com sucesso!';
        this.isSubmitting.set(false);
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Erro ao salvar pontuação.';
        this.isSubmitting.set(false);
      }
    });
  }

  // ---- Stage Results Methods ----
  loadStages(raceId: number): void {
    this.apiService.getRaceStages(raceId).subscribe({
      next: (data) => {
        this.stages = data;
        // Auto-select first stage if none selected
        if (data.length > 0 && !this.selectedStageId()) {
          this.selectedStageId.set(data[0].id);
          this.loadStageData(data[0].id);
        }
      },
      error: (err) => console.error('Error loading stages:', err)
    });
  }

  onStageSelect(stageId: number): void {
    this.selectedStageId.set(stageId);
    this.loadStageData(stageId);
  }

  loadStageData(stageId: number): void {
    // Load saved results
    this.apiService.getStageResults(stageId).subscribe({
      next: (data) => {
        this.savedStageResults = data;
        // Rebuild result entries (top 10 positions)
        this.stageResultEntries = Array.from({ length: 10 }, (_, i) => {
          const existing = data.find(r => r.position === i + 1);
          const rule = this.scoringRules.find(r => r.position === i + 1);
          return { position: i + 1, athlete_id: existing?.athlete_id ?? null, points_awarded: existing?.points_awarded ?? rule?.points ?? 0 };
        });
      },
      error: (err) => console.error('Error loading stage results:', err)
    });
    // Load saved jersey leaders
    this.apiService.getStageJerseyLeaders(stageId).subscribe({
      next: (data) => {
        this.savedJerseyLeaders = data;
        // Rebuild jersey leader entries from current jersey types
        this.jerseyLeaderEntries = this.jerseyTypes.map(jt => {
          const existing = data.find(l => l.jersey_type_id === jt.id);
          return { jersey_type_id: jt.id!, athlete_id: existing?.athlete_id ?? null };
        });
      },
      error: (err) => console.error('Error loading jersey leaders:', err)
    });
  }

  onResultAthleteChange(index: number, athleteId: string): void {
    const id = athleteId ? parseInt(athleteId) : null;
    this.stageResultEntries[index].athlete_id = id;
    // Auto-fill points from scoring rules
    if (id) {
      const rule = this.scoringRules.find(r => r.position === index + 1);
      if (rule) this.stageResultEntries[index].points_awarded = rule.points;
    }
  }

  saveStageData(): void {
    const stageId = this.selectedStageId();
    if (!stageId) return;
    this.isSubmitting.set(true);
    this.errorMessage = '';
    this.successMessage = '';

    // Save results and jersey leaders in parallel using nested subscribes (simple approach)
    this.apiService.saveStageResults(stageId, this.stageResultEntries).subscribe({
      next: () => {
        this.apiService.saveStageJerseyLeaders(stageId, this.jerseyLeaderEntries).subscribe({
          next: () => {
            this.successMessage = 'Resultado e camisas da etapa salvos com sucesso!';
            this.loadStageData(stageId);
            this.isSubmitting.set(false);
          },
          error: (err) => {
            this.errorMessage = err.error?.message || 'Erro ao salvar camisas da etapa.';
            this.isSubmitting.set(false);
          }
        });
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Erro ao salvar resultado da etapa.';
        this.isSubmitting.set(false);
      }
    });
  }
}
