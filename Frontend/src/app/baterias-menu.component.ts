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
          <a routerLink="/modulos/baterias/listar" [queryParams]="{ estado: 'Por vencer' }">Ver en listado</a>
        </div>
        <p class="empty" *ngIf="isLoadingDashboard">Cargando indicadores...</p>
        <p class="empty" *ngIf="!isLoadingDashboard && attentionItems.length === 0">Sin baterias por vencer.</p>
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
      color: #f8fafc;
    }

    .view-header p {
      margin-top: 0.75rem;
      color: #94a3b8;
    }

    .sync-status {
      font-weight: 600;
      color: #2dd4bf;
    }

    .sync-status.error {
      color: #f87171;
    }

    .back-link {
      display: inline-block;
      margin-top: 0.9rem;
      color: #7dd3fc;
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
      margin: 1.1rem 0 0;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      grid-template-areas:
        'agregar listar exportar'
        'editar eliminar exportar';
      grid-auto-rows: minmax(180px, auto);
      column-gap: 1.5rem;
      row-gap: 1.35rem;
      align-items: stretch;
    }

    .stats-grid {
      margin: 0 0 0.85rem;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 0.7rem;
    }

    .stat-card {
      background: #111827;
      border: 1px solid #263244;
      border-radius: 12px;
      padding: 0.7rem 0.85rem;
    }

    .stat-card span {
      display: block;
      color: #94a3b8;
      font-size: 0.85rem;
    }

    .stat-card strong {
      display: block;
      margin-top: 0.2rem;
      font-size: 1.4rem;
      color: #f8fafc;
    }

    .stat-card.danger {
      border-color: #7f1d1d;
      background: #2a1215;
    }

    .stat-card.warning {
      border-color: #854d0e;
      background: #2b2112;
    }

    .stat-card.ok {
      border-color: #14532d;
      background: #11281d;
    }

    .attention-card {
      position: sticky;
      top: 1rem;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 0.75rem;
      max-height: calc(100vh - 2rem);
      overflow: auto;
      box-shadow: 0 14px 30px rgba(0, 0, 0, 0.35);
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
      color: #f1f5f9;
    }

    .attention-head a {
      color: #7dd3fc;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.8rem;
    }

    .attention-list {
      display: grid;
      gap: 0.4rem;
    }

    .attention-item {
      border: 1px solid #2a374d;
      background: #111827;
      border-radius: 10px;
      padding: 0.5rem;
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      align-items: center;
    }

    .attention-item strong {
      color: #f8fafc;
    }

    .attention-item p {
      margin: 0.2rem 0 0;
      color: #94a3b8;
      font-size: 0.8rem;
    }

    .badge {
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.25rem 0.6rem;
      background: #1f2937;
      color: #e2e8f0;
      white-space: nowrap;
    }

    .badge.danger {
      background: #3b1418;
      color: #fca5a5;
    }

    .badge.warning {
      background: #3a2a12;
      color: #fcd34d;
    }

    .empty {
      margin: 0;
      color: #94a3b8;
    }

    .menu-card {
      display: block;
      text-decoration: none;
      background: #0f172a;
      border: 1px solid #2b3a52;
      border-radius: 12px;
      padding: 1.05rem;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      min-height: 100%;
    }

    .menu-grid > .menu-card:not(.export-card) {
      min-height: 185px;
    }

    .menu-grid > .menu-card:nth-child(1) {
      grid-area: agregar;
    }

    .menu-grid > .menu-card:nth-child(2) {
      grid-area: listar;
    }

    .menu-grid > .menu-card.export-card {
      grid-area: exportar;
    }

    .menu-grid > .menu-card:nth-child(4) {
      grid-area: editar;
    }

    .menu-grid > .menu-card:nth-child(5) {
      grid-area: eliminar;
    }

    .menu-card h2 {
      margin: 0;
      font-size: 1.1rem;
      color: #7dd3fc;
    }

    .menu-card p {
      margin: 0.4rem 0 0;
      color: #cbd5e1;
      line-height: 1.4;
      font-size: 0.9rem;
    }

    .export-card {
      display: flex;
      flex-direction: column;
      gap: 0.7rem;
      justify-content: space-between;
    }

    .field-inline {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      color: #cbd5e1;
      font-size: 0.85rem;
    }

    .field-inline select {
      border: 1px solid #3b4b67;
      border-radius: 10px;
      padding: 0.5rem 0.65rem;
      font-size: 0.9rem;
      background: #111827;
      color: #f8fafc;
      outline: none;
    }

    .btn-export {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      border: 1px solid #3b4b67;
      border-radius: 999px;
      padding: 0.5rem 0.9rem;
      color: #e2e8f0;
      font-weight: 600;
      background: #111827;
      width: fit-content;
    }

    .menu-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 14px 28px rgba(0, 0, 0, 0.35);
      border-color: #38bdf8;
    }

    @media (max-width: 980px) {
      .menu-layout {
        grid-template-columns: 1fr;
      }

      .menu-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        grid-template-areas:
          'agregar listar'
          'exportar exportar'
          'editar eliminar';
        column-gap: 1rem;
        row-gap: 1rem;
      }

      .attention-card {
        position: static;
        max-height: none;
        margin-top: 0.5rem;
      }
    }

    @media (max-width: 640px) {
      .menu-grid {
        grid-template-columns: 1fr;
        grid-template-areas:
          'agregar'
          'listar'
          'exportar'
          'editar'
          'eliminar';
        row-gap: 0.95rem;
      }

      .menu-grid > .menu-card:not(.export-card) {
        min-height: 0;
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

        this.attentionItems = mapped
          .filter((item) => item.estado === 'Por vencer')
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