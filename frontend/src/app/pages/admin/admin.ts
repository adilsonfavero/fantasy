import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Sponsor, Race, Athlete, User } from '../../services/api.service';
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

  ngOnInit(): void {
    this.loadSponsors();
    this.loadRaces();
  }

  setTab(tab: 'sponsors' | 'athletes' | 'users' | 'telemetry'): void {
    this.activeTab.set(tab);
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
}
