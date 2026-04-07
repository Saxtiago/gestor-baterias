import { NgIf } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

import { finalize } from 'rxjs';

import { environment } from '../environments/environment';

@Component({
  selector: 'app-baterias-menu',
  imports: [NgIf, RouterLink, HttpClientModule],
  template: `
    <section class="view-header">
      <h1>Gestión de Baterías</h1>
      <p>Selecciona la acción que deseas realizar.</p>
      <p class="sync-status" *ngIf="isSyncing">Actualizando datos...</p>
      <p class="sync-status error" *ngIf="syncError">{{ syncError }}</p>
      <a class="back-link" routerLink="/">← Volver a módulos</a>
    </section>

    <section class="menu-grid">
      <a class="menu-card" routerLink="/modulos/baterias/agregar">
        <h2>Agregar</h2>
        <p>Registrar una nueva batería.</p>
      </a>

      <a class="menu-card" routerLink="/modulos/baterias/listar">
        <h2>Buscar / Listar</h2>
        <p>Consultar baterías registradas.</p>
      </a>

      <a class="menu-card" [href]="exportUrl" target="_blank" rel="noopener">
        <h2>Exportar Excel</h2>
        <p>Descargar el archivo Excel</p>
      </a>

      <a class="menu-card" routerLink="/modulos/baterias/editar">
        <h2>Editar</h2>
        <p>Modificar información existente.</p>
      </a>

      <a class="menu-card" routerLink="/modulos/baterias/eliminar">
        <h2>Eliminar</h2>
        <p>Quitar registros que ya no se necesiten.</p>
      </a>
    </section>
  `,
  styles: `
    .view-header {
      max-width: 900px;
      margin: 0 auto 2rem;
      text-align: center;
    }

    .view-header h1 {
      margin: 0;
      font-size: 2rem;
      color: #1f2937;
    }

    .view-header p {
      margin-top: 0.75rem;
      color: #4b5563;
    }

    .sync-status {
      font-weight: 600;
      color: #0f766e;
    }

    .sync-status.error {
      color: #b91c1c;
    }

    .back-link {
      display: inline-block;
      margin-top: 0.9rem;
      color: #1d4ed8;
      text-decoration: none;
      font-weight: 600;
    }

    .menu-grid {
      max-width: 900px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
    }

    .menu-card {
      display: block;
      text-decoration: none;
      background: #ffffff;
      border: 1px solid #dbe3ee;
      border-radius: 12px;
      padding: 1.25rem;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .menu-card h2 {
      margin: 0;
      font-size: 1.2rem;
      color: #1d4ed8;
    }

    .menu-card p {
      margin: 0.6rem 0 0;
      color: #374151;
      line-height: 1.4;
    }

    .menu-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BateriasMenuComponent implements OnInit {
  protected readonly exportUrl = `${environment.apiBaseUrl}/api/baterias/export`;
  private readonly syncUrl = `${environment.apiBaseUrl}/api/baterias/sync`;

  protected isSyncing = false;
  protected syncError = '';

  constructor(
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.syncData();
  }

  private syncData(): void {
    this.isSyncing = true;
    this.syncError = '';
    this.cdr.markForCheck();

    this.http.post(this.syncUrl, {}).pipe(
      finalize(() => {
        this.isSyncing = false;
        this.cdr.markForCheck();
      }),
    ).subscribe({
      error: () => {
        this.syncError = 'No se pudo actualizar la informacion automaticamente.';
        this.cdr.markForCheck();
      },
    });
  }
}