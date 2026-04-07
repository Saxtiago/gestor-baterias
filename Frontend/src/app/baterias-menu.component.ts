import { NgFor, NgIf } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { environment } from '../environments/environment';

type RegistroApi = Record<string, string | number>;

interface DashboardItem {
  negocio: string;
  modelo: string;
  serial: string;
  estado: string;
  fechaVencimiento: string;
}

@Component({
  selector: 'app-baterias-menu',
  imports: [NgFor, NgIf, RouterLink, HttpClientModule],
  template: `
    <section class="view-header">
      <h1>Gestión de Baterías</h1>
      <p>Selecciona la acción que deseas realizar.</p>
      <p class="sync-status" *ngIf="isSyncing">Actualizando datos...</p>
      <p class="sync-status error" *ngIf="syncError">{{ syncError }}</p>
      <a class="back-link" routerLink="/">← Volver a módulos</a>
    </section>

    <section class="stats-grid">
      <article class="stat-card">
        <span>Total</span>
        <strong>{{ totalBaterias }}</strong>
      </article>
      <article class="stat-card danger">
        <span>Vencidas</span>
        <strong>{{ totalVencidas }}</strong>
      </article>
      <article class="stat-card warning">
        <span>Por vencer</span>
        <strong>{{ totalPorVencer }}</strong>
      </article>
      <article class="stat-card ok">
        <span>Vigentes</span>
        <strong>{{ totalVigentes }}</strong>
      </article>
    </section>

    <section class="quick-filters">
      <a class="filter-chip" routerLink="/modulos/baterias/listar">Ver todo</a>
      <a class="filter-chip danger" routerLink="/modulos/baterias/listar" [queryParams]="{ estado: 'Vencido' }">
        Vencidas
      </a>
      <a class="filter-chip warning" routerLink="/modulos/baterias/listar" [queryParams]="{ estado: 'Por vencer' }">
        Por vencer
      </a>
      <a class="filter-chip" routerLink="/modulos/baterias/listar" [queryParams]="{ estado: 'Vigente' }">
        Vigentes
      </a>
    </section>

    <section class="attention-card">
      <div class="attention-head">
        <h2>Atención hoy</h2>
        <a routerLink="/modulos/baterias/listar" [queryParams]="{ estado: 'Por vencer' }">Ver en listado</a>
      </div>
      <p class="empty" *ngIf="isLoadingDashboard">Cargando indicadores...</p>
      <p class="empty" *ngIf="!isLoadingDashboard && attentionItems.length === 0">Sin alertas prioritarias.</p>
      <div class="attention-list" *ngIf="attentionItems.length > 0">
        <article class="attention-item" *ngFor="let item of attentionItems">
          <div>
            <strong>{{ item.negocio }}</strong>
            <p>{{ item.modelo }} - {{ item.serial }}</p>
          </div>
          <div class="badge" [class.danger]="item.estado === 'Vencido'" [class.warning]="item.estado === 'Por vencer'">
            {{ item.estado }}
          </div>
        </article>
      </div>
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
      margin: 1.25rem auto 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
    }

    .stats-grid {
      max-width: 900px;
      margin: 0 auto 1rem;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 0.85rem;
    }

    .stat-card {
      background: #ffffff;
      border: 1px solid #dbe3ee;
      border-radius: 12px;
      padding: 0.9rem 1rem;
    }

    .stat-card span {
      display: block;
      color: #64748b;
      font-size: 0.85rem;
    }

    .stat-card strong {
      display: block;
      margin-top: 0.3rem;
      font-size: 1.5rem;
      color: #0f172a;
    }

    .stat-card.danger {
      border-color: #fecaca;
      background: #fef2f2;
    }

    .stat-card.warning {
      border-color: #fde68a;
      background: #fffbeb;
    }

    .stat-card.ok {
      border-color: #bbf7d0;
      background: #f0fdf4;
    }

    .quick-filters {
      max-width: 900px;
      margin: 0 auto 1rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
    }

    .filter-chip {
      text-decoration: none;
      border: 1px solid #dbe3ee;
      border-radius: 999px;
      padding: 0.35rem 0.8rem;
      color: #334155;
      background: #ffffff;
      font-weight: 600;
      font-size: 0.85rem;
    }

    .filter-chip.danger {
      border-color: #fecaca;
      color: #991b1b;
      background: #fef2f2;
    }

    .filter-chip.warning {
      border-color: #fde68a;
      color: #92400e;
      background: #fffbeb;
    }

    .attention-card {
      max-width: 900px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #dbe3ee;
      border-radius: 12px;
      padding: 1rem;
    }

    .attention-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 0.75rem;
    }

    .attention-head h2 {
      margin: 0;
      font-size: 1rem;
      color: #1f2937;
    }

    .attention-head a {
      color: #1d4ed8;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.85rem;
    }

    .attention-list {
      display: grid;
      gap: 0.6rem;
    }

    .attention-item {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 0.7rem;
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      align-items: center;
    }

    .attention-item p {
      margin: 0.25rem 0 0;
      color: #64748b;
      font-size: 0.85rem;
    }

    .badge {
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.25rem 0.6rem;
      background: #e2e8f0;
      color: #0f172a;
      white-space: nowrap;
    }

    .badge.danger {
      background: #fee2e2;
      color: #991b1b;
    }

    .badge.warning {
      background: #fef3c7;
      color: #92400e;
    }

    .empty {
      margin: 0;
      color: #64748b;
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
  private readonly listUrl = `${environment.apiBaseUrl}/api/baterias?all=1`;
  private readonly syncUrl = `${environment.apiBaseUrl}/api/baterias/sync`;

  protected isSyncing = false;
  protected isLoadingDashboard = false;
  protected syncError = '';
  protected totalBaterias = 0;
  protected totalVencidas = 0;
  protected totalPorVencer = 0;
  protected totalVigentes = 0;
  protected attentionItems: DashboardItem[] = [];

  constructor(
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.syncData();
    this.loadDashboard();
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

  private loadDashboard(): void {
    this.isLoadingDashboard = true;
    this.cdr.markForCheck();

    this.http.get<RegistroApi[]>(this.listUrl).pipe(
      finalize(() => {
        this.isLoadingDashboard = false;
        this.cdr.markForCheck();
      }),
    ).subscribe({
      next: (rows) => {
        const mapped = rows.map((row) => this.toDashboardItem(row));
        this.totalBaterias = mapped.length;
        this.totalVencidas = mapped.filter((item) => item.estado === 'Vencido').length;
        this.totalPorVencer = mapped.filter((item) => item.estado === 'Por vencer').length;
        this.totalVigentes = mapped.filter((item) => item.estado === 'Vigente').length;

        const prioridad = { 'Vencido': 0, 'Por vencer': 1, 'Vigente': 2 } as const;
        this.attentionItems = mapped
          .filter((item) => item.estado === 'Vencido' || item.estado === 'Por vencer')
          .sort((a, b) => prioridad[a.estado as keyof typeof prioridad] - prioridad[b.estado as keyof typeof prioridad])
          .slice(0, 6);
      },
      error: () => {
        this.attentionItems = [];
      },
    });
  }

  private toDashboardItem(row: RegistroApi): DashboardItem {
    const normalizeKey = (key: string) =>
      key
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    const normalizedMap = Object.keys(row).reduce<Record<string, string>>((acc, key) => {
      acc[normalizeKey(key)] = String(row[key] ?? '');
      return acc;
    }, {});

    const get = (keys: string[]) => {
      for (const key of keys) {
        const value = normalizedMap[normalizeKey(key)];
        if (value !== undefined) {
          return value;
        }
      }
      return '';
    };

    const estado = get(['ESTADO', 'Estado']) || 'Vigente';

    return {
      negocio: get(['Negocio']),
      modelo: get(['Modelo', 'Modelo/Referencia']),
      serial: get(['Serial', 'No Serial']),
      estado,
      fechaVencimiento: get(['FECHA DE VENCIMIENTO', 'Fecha de vencimiento']),
    };
  }
}