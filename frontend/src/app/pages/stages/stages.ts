import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { ApiService, Race } from '../../services/api.service';

@Component({
  selector: 'app-stages',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './stages.html',
  styleUrls: ['./stages.css']
})
export class StagesComponent implements OnInit {
  private readonly apiService = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  raceId!: number;
  race = signal<Race | null>(null);
  stages = signal<any[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');

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
    this.isLoading.set(true);
    this.errorMessage.set('');

    // 1. Fetch races to find details of the selected race
    this.apiService.getRaces().subscribe({
      next: (races) => {
        const foundRace = races.find(r => r.id === this.raceId);
        if (!foundRace) {
          this.router.navigate(['/dashboard']);
          return;
        }
        this.race.set(foundRace);

        // 2. Fetch stages of this race
        this.apiService.getRaceStages(this.raceId).subscribe({
          next: (stagesData) => {
            this.stages.set(stagesData);
            this.isLoading.set(false);

            // Auto-scroll to the closest stage
            setTimeout(() => {
              this.scrollToClosestStage();
            }, 150);
          },
          error: (err) => {
            console.error('Error fetching stages:', err);
            this.errorMessage.set('Erro ao carregar as etapas da prova.');
            this.isLoading.set(false);
          }
        });
      },
      error: (err) => {
        console.error('Error fetching races:', err);
        this.errorMessage.set('Erro ao carregar dados da prova.');
        this.isLoading.set(false);
      }
    });
  }

  scrollToClosestStage(): void {
    const stagesList = this.stages();
    if (stagesList.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let closestStageIndex = -1;
    let minDiff = Infinity;

    stagesList.forEach((stage, index) => {
      stage.isClosest = false;
      if (stage.date) {
        const parts = stage.date.split('-');
        if (parts.length === 3) {
          const stageDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          const diff = Math.abs(stageDate.getTime() - today.getTime());
          if (diff < minDiff) {
            minDiff = diff;
            closestStageIndex = index;
          }
        }
      }
    });

    if (closestStageIndex !== -1) {
      stagesList[closestStageIndex].isClosest = true;
      const element = document.getElementById(`stage-card-${closestStageIndex}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }
}
