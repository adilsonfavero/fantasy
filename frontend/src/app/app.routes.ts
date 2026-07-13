import { Routes } from '@angular/router';
import { LandingComponent } from './pages/landing/landing';
import { LoginComponent } from './pages/login/login';
import { RegisterComponent } from './pages/register/register';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { TeamBuilderComponent } from './pages/team-builder/team-builder';
import { AdminComponent } from './pages/admin/admin';
import { LeaguesComponent } from './pages/leagues/leagues.component';
import { StagesComponent } from './pages/stages/stages';
import { authGuard, adminGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'team-builder/:raceId', component: TeamBuilderComponent, canActivate: [authGuard] },
  { path: 'stages/:raceId', component: StagesComponent, canActivate: [authGuard] },
  { path: 'leagues', component: LeaguesComponent, canActivate: [authGuard] },
  { path: 'admin', component: AdminComponent, canActivate: [adminGuard] },
  { path: '**', redirectTo: '' }
];
