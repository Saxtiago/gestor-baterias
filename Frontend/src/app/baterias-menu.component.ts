import { NgFor, NgIf } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  imports: [FormsModule, NgFor, NgIf, RouterLink, HttpClientModule],
  template: `
    <section class="view-header">
      <h1>Gestión de Baterías</h1>
      <p>Selecciona la acción que deseas realizar.</p>
      <p class="sync-status" *ngIf="isSyncing">Actualizando datos...</p>
      <p class="sync-status error" *ngIf="syncError">{{ syncError }}</p>
      <a class="back-link" routerLink="/">← Volver a módulos</a>
    </section>

    <section class="menu-layout">
      <div class="menu-main">
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

        <section class="menu-grid">
          <a class="menu-card" routerLink="/modulos/baterias/agregar">
            <h2>Agregar</h2>
            <p>Registrar una nueva batería.</p>
          </a>

          <a class="menu-card" routerLink="/modulos/baterias/listar">
            <h2>Buscar / Listar</h2>
            <p>Consultar baterías registradas.</p>
          </a>

          <div class="menu-card export-card">
            <h2>Exportar Excel</h2>
            <p>Descargar por tipo: todo, vigente, por vencer o vencido.</p>
            <label class="field-inline">
              <span>Tipo de exportacion</span>
              <select [(ngModel)]="exportFilter">
                <option *ngFor="let option of exportOptions" [value]="option.value">{{ option.label }}</option>
              </select>
            </label>
            <a class="btn-export" [href]="getExportUrl()" target="_blank" rel="noopener">Descargar Excel</a>
          </div>

          <a class="menu-card" routerLink="/modulos/baterias/editar">
            <h2>Editar</h2>
            <p>Modificar información existente.</p>
          </a>

          <a class="menu-card" routerLink="/modulos/baterias/eliminar">
            <h2>Eliminar</h2>
            <p>Quitar registros que ya no se necesiten.</p>
          </a>
        </section>
      </div>

      <aside class="attention-card">
        <div class="attention-head">
          <h2>Atención hoy</h2>
          <a routerLink="/modulos/baterias/listar" [queryParams]="{ estados: 'Vencido,Por vencer' }">Ver en listado</a>
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
      </aside>
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

    .menu-layout {
      max-width: 1150px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 290px;
      gap: 1rem;
      align-items: start;
    }

    .menu-main {
      min-width: 0;
    }

    .menu-grid {
      margin: 0.85rem 0 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0.8rem;
    }

    .stats-grid {
      margin: 0 0 0.85rem;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 0.7rem;
    }

    .stat-card {
      background: #ffffff;
      border: 1px solid #dbe3ee;
      border-radius: 12px;
      padding: 0.7rem 0.85rem;
    }

    .stat-card span {
      display: block;
      color: #64748b;
      font-size: 0.85rem;
    }

    .stat-card strong {
      display: block;
      margin-top: 0.2rem;
      font-size: 1.4rem;
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
      margin: 0 0 1rem;
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
      position: sticky;
      top: 1rem;
      background: #ffffff;
      border: 1px solid #dbe3ee;
      border-radius: 12px;
      padding: 0.75rem;
      max-height: calc(100vh - 2rem);
      overflow: auto;
    }

    .attention-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 0.6rem;
    }

    .attention-head h2 {
      margin: 0;
      font-size: 0.95rem;
      color: #1f2937;
    }

    .attention-head a {
      color: #1d4ed8;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.8rem;
    }

    .attention-list {
      display: grid;
      gap: 0.4rem;
    }

    .attention-item {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 0.5rem;
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      align-items: center;
    }

    .attention-item p {
      margin: 0.2rem 0 0;
      color: #64748b;
      font-size: 0.8rem;
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
      padding: 0.9rem;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .menu-card h2 {
      margin: 0;
      font-size: 1.1rem;
      color: #1d4ed8;
    }

    .menu-card p {
      margin: 0.4rem 0 0;
      color: #374151;
      line-height: 1.4;
      font-size: 0.9rem;
    }

    .export-card {
      display: flex;
      flex-direction: column;
      gap: 0.7rem;
    }

    .field-inline {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      color: #334155;
      font-size: 0.85rem;
    }

    .field-inline select {
      border: 1px solid #cbd5f5;
      border-radius: 10px;
      padding: 0.5rem 0.65rem;
      font-size: 0.9rem;
      background: #ffffff;
      color: #0f172a;
      outline: none;
    }

    .btn-export {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      border: 1px solid #cbd5f5;
      border-radius: 999px;
      padding: 0.5rem 0.9rem;
      color: #0f172a;
      font-weight: 600;
      background: #f8fafc;
      width: fit-content;
    }

    .menu-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
    }

    @media (max-width: 980px) {
      .menu-layout {
        grid-template-columns: 1fr;
      }

      .attention-card {
        position: static;
        max-height: none;
        margin-top: 0.5rem;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BateriasMenuComponent implements OnInit {
  protected readonly exportBaseUrl = `${environment.apiBaseUrl}/api/baterias/export`;
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
  protected exportFilter = 'all';
  protected readonly exportOptions = [
    { value: 'all', label: 'Todo' },
    { value: 'vigente', label: 'Solo vigentes' },
    { value: 'por vencer', label: 'Solo por vencer' },
    { value: 'vencido', label: 'Solo vencidos' },
  ];

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

  protected getExportUrl(): string {
    const estado = encodeURIComponent(this.exportFilter || 'all');
    return `${this.exportBaseUrl}?estado=${estado}`;
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

    const parseDate = (value: string) => {
      if (!value) {
        return null;
      }
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const computeEstado = (dueDateText: string) => {
      const dueDate = parseDate(dueDateText);
      if (!dueDate) {
        return 'Vigente';
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / 86400000);
      if (diffDays < 0) {
        return 'Vencido';
      }
      if (diffDays <= 30) {
        return 'Por vencer';
      }
      return 'Vigente';
    };

    const fechaVencimiento = get(['FECHA DE VENCIMIENTO', 'Fecha de vencimiento']);
    const estadoApi = get(['ESTADO', 'Estado']);
    const estado = estadoApi || computeEstado(fechaVencimiento);

    return {
      negocio: get(['Negocio']),
      modelo: get(['Modelo', 'Modelo/Referencia']),
      serial: get(['Serial', 'No Serial']),
      estado,
      fechaVencimiento,
    };
  }
}