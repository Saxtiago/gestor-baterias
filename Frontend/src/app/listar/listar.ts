import { AsyncPipe, isPlatformBrowser, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BehaviorSubject, Observable, Subject, asyncScheduler, catchError, combineLatest, finalize, map, observeOn, of, shareReplay, startWith, switchMap } from 'rxjs';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { environment } from '../../environments/environment';

type RegistroApi = Record<string, string | number>;

interface RegistroListado {
  cod: string;
  negocio: string;
  upsMarca: string;
  modelo: string;
  capacidad: string;
  serial: string;
  inventarioNo: string;
  fechaInstalacion: string;
  referencia: string;
  cantidad: string;
  fechaVencimiento: string;
  estado: string;
  anosMesesDias: string;
}

interface FiltrosListado {
  searchText: string;
  negocioFilter: string;
  marcaFilter: string;
  fechaDesde: string;
  fechaHasta: string;
  selectedEstados: string[];
}

interface ChartItem {
  label: string;
  count: number;
}

@Component({
  selector: 'app-listar',
  imports: [AsyncPipe, FormsModule, NgFor, NgIf, RouterLink, HttpClientModule, BaseChartDirective],
  templateUrl: './listar.html',
  styleUrl: './listar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Listar implements OnInit {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/baterias?all=1`;
  private readonly filtrosSubject = new BehaviorSubject<FiltrosListado>({
    searchText: '',
    negocioFilter: '',
    marcaFilter: '',
    fechaDesde: '',
    fechaHasta: '',
    selectedEstados: [],
  });
  private readonly refreshSubject = new Subject<void>();

  protected searchText = '';
  protected negocioFilter = '';
  protected marcaFilter = '';
  protected fechaDesde = '';
  protected fechaHasta = '';
  protected selectedEstados: string[] = [];
  protected isLoading = false;
  protected errorMessage = '';
  protected maxEstadoCount = 1;
  protected maxMarcaCount = 1;

  protected readonly estados = ['Vigente', 'Por vencer', 'Vencido'];
  protected registros$!: Observable<RegistroListado[] | null>;
  protected registrosFiltrados$!: Observable<RegistroListado[] | null>;
  protected estadoChart$!: Observable<ChartItem[]>;
  protected marcaChart$!: Observable<ChartItem[]>;
  protected marcasDisponibles$!: Observable<string[]>;
  protected estadoPieData$!: Observable<ChartConfiguration<'pie'>['data']>;
  protected marcaBarData$!: Observable<ChartConfiguration<'bar'>['data']>;
  protected readonly estadoPieOptions: ChartConfiguration<'pie'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#cbd5e1',
          usePointStyle: true,
          boxWidth: 10,
          boxHeight: 10,
        },
      },
      tooltip: {
        backgroundColor: '#0b1220',
        borderColor: '#334155',
        borderWidth: 1,
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
      },
    },
  };
  protected readonly marcaBarOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0b1220',
        borderColor: '#334155',
        borderWidth: 1,
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
      },
    },
    scales: {
      x: {
        ticks: { color: '#94a3b8', font: { size: 11 } },
        grid: { color: 'rgba(148, 163, 184, 0.15)' },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#94a3b8',
          precision: 0,
          stepSize: 1,
          font: { size: 11 },
        },
        grid: { color: 'rgba(148, 163, 184, 0.15)' },
      },
    },
  };

  constructor(
    private readonly http: HttpClient,
    private readonly route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {
    this.registros$ = this.refreshSubject.pipe(
      startWith(undefined),
      switchMap(() =>
        this.http.get<RegistroApi[]>(this.apiUrl).pipe(
          map((data) => data.map((registro) => this.mapRegistro(registro))),
          catchError(() => {
            this.errorMessage = 'No se pudo cargar la informacion del Excel.';
            this.cdr.markForCheck();
            return of(null);
          }),
          finalize(() => {
            this.isLoading = false;
            this.cdr.markForCheck();
          }),
        ),
      ),
      observeOn(asyncScheduler),
      shareReplay(1),
    );

    this.registrosFiltrados$ = combineLatest([
      this.registros$,
      this.filtrosSubject.asObservable(),
    ]).pipe(
      map(([registros, filtros]) =>
        registros ? this.applyFilters(registros, filtros) : null,
      ),
      observeOn(asyncScheduler),
      shareReplay(1),
    );

    this.estadoChart$ = combineLatest([
      this.registros$,
      this.filtrosSubject.asObservable(),
    ]).pipe(
      map(([registros, filtros]) => {
        if (!registros) {
          this.maxEstadoCount = 1;
          return [];
        }

        const base = this.applyFilters(registros, filtros, true);
        const chart = this.estados.map((estado) => ({
          label: estado,
          count: base.filter((item) => item.estado === estado).length,
        }));

        this.maxEstadoCount = Math.max(1, ...chart.map((item) => item.count));
        return chart;
      }),
      observeOn(asyncScheduler),
      shareReplay(1),
    );

    this.marcaChart$ = combineLatest([
      this.registros$,
      this.filtrosSubject.asObservable(),
    ]).pipe(
      map(([registros, filtros]) => {
        if (!registros) {
          this.maxMarcaCount = 1;
          return [];
        }

        const base = this.applyFilters(registros, filtros, false, true);
        const counters = new Map<string, number>();

        base.forEach((item) => {
          const marca = item.upsMarca || 'Sin marca';
          counters.set(marca, (counters.get(marca) ?? 0) + 1);
        });

        const chart = Array.from(counters.entries())
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8);

        this.maxMarcaCount = Math.max(1, ...chart.map((item) => item.count));
        return chart;
      }),
      observeOn(asyncScheduler),
      shareReplay(1),
    );

    this.estadoPieData$ = this.estadoChart$.pipe(
      map((chart) => ({
        labels: chart.map((item) => item.label),
        datasets: [
          {
            data: chart.map((item) => item.count),
            backgroundColor: ['#22d3ee', '#f59e0b', '#ef4444'],
            borderColor: '#0f172a',
            borderWidth: 2,
            hoverOffset: 8,
          },
        ],
      })),
      observeOn(asyncScheduler),
      shareReplay(1),
    );

    this.marcaBarData$ = this.marcaChart$.pipe(
      map((chart) => ({
        labels: chart.map((item) => item.label),
        datasets: [
          {
            data: chart.map((item) => item.count),
            backgroundColor: '#0ea5e9',
            borderColor: '#38bdf8',
            borderWidth: 1,
            borderRadius: 6,
            maxBarThickness: 26,
          },
        ],
      })),
      observeOn(asyncScheduler),
      shareReplay(1),
    );

    this.marcasDisponibles$ = this.registros$.pipe(
      map((registros) => {
        if (!registros) {
          return [];
        }

        return Array.from(
          new Set(registros.map((item) => item.upsMarca).filter((item) => item.trim().length > 0)),
        ).sort((a, b) => a.localeCompare(b));
      }),
      observeOn(asyncScheduler),
      shareReplay(1),
    );
  }

  ngOnInit(): void {
    this.applyInitialFiltersFromQuery();
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => this.fetchRegistros(), 0);
    }
  }

  private applyInitialFiltersFromQuery(): void {
    const queryParams = this.route.snapshot.queryParamMap;
    const estadosParam = queryParams.get('estados')?.trim() ?? '';
    const estadoParam = queryParams.get('estado')?.trim() ?? '';
    const searchText = queryParams.get('q')?.trim() ?? '';
    const negocio = queryParams.get('negocio')?.trim() ?? '';
    const marca = queryParams.get('marca')?.trim() ?? '';
    const fechaDesde = queryParams.get('desde')?.trim() ?? '';
    const fechaHasta = queryParams.get('hasta')?.trim() ?? '';

    if (!estadosParam && !estadoParam && !searchText && !negocio && !marca && !fechaDesde && !fechaHasta) {
      return;
    }

    // Parsear múltiples estados (separados por coma) o un único estado
    if (estadosParam) {
      this.selectedEstados = estadosParam.split(',').map((e) => e.trim()).filter((e) => this.estados.includes(e));
    } else if (estadoParam) {
      this.selectedEstados = this.estados.includes(estadoParam) ? [estadoParam] : [];
    }

    this.searchText = searchText;
    this.negocioFilter = negocio;
    this.marcaFilter = marca;
    this.fechaDesde = fechaDesde;
    this.fechaHasta = fechaHasta;
    this.onFiltersChange();
  }

  fetchRegistros(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();
    this.refreshSubject.next();
  }

  onFiltersChange(): void {
    this.filtrosSubject.next({
      searchText: this.searchText,
      negocioFilter: this.negocioFilter,
      marcaFilter: this.marcaFilter,
      fechaDesde: this.fechaDesde,
      fechaHasta: this.fechaHasta,
      selectedEstados: this.selectedEstados,
    });
  }

  onEstadoCheckboxChange(estado: string, checked: boolean): void {
    if (checked) {
      if (!this.selectedEstados.includes(estado)) {
        this.selectedEstados = [...this.selectedEstados, estado];
      }
    } else {
      this.selectedEstados = this.selectedEstados.filter((item) => item !== estado);
    }

    this.onFiltersChange();
  }

  onChartEstadoClick(estado: string): void {
    if (this.selectedEstados.includes(estado)) {
      this.selectedEstados = this.selectedEstados.filter((item) => item !== estado);
    } else {
      this.selectedEstados = [...this.selectedEstados, estado];
    }

    this.onFiltersChange();
  }

  onChartMarcaClick(marca: string): void {
    this.marcaFilter = this.marcaFilter === marca ? '' : marca;
    this.onFiltersChange();
  }

  isEstadoActivo(estado: string): boolean {
    return this.selectedEstados.includes(estado);
  }

  isMarcaActiva(marca: string): boolean {
    return this.marcaFilter.toLowerCase() === marca.toLowerCase();
  }

  getEstadoBarWidth(count: number): string {
    return `${Math.max(8, Math.round((count / this.maxEstadoCount) * 100))}%`;
  }

  getMarcaBarWidth(count: number): string {
    return `${Math.max(8, Math.round((count / this.maxMarcaCount) * 100))}%`;
  }

  onClearFilters(): void {
    this.searchText = '';
    this.negocioFilter = '';
    this.marcaFilter = '';
    this.fechaDesde = '';
    this.fechaHasta = '';
    this.selectedEstados = [];
    this.onFiltersChange();
  }

  private applyFilters(
    registros: RegistroListado[],
    filtros: FiltrosListado,
    ignoreEstado = false,
    ignoreMarca = false,
  ): RegistroListado[] {
    const texto = filtros.searchText.trim().toLowerCase();
    const negocio = filtros.negocioFilter.trim().toLowerCase();
    const marca = filtros.marcaFilter.trim().toLowerCase();
    const fechaDesde = this.parseDate(filtros.fechaDesde);
    const fechaHasta = this.parseDate(filtros.fechaHasta);

    return registros.filter((registro) => {
      const textoCoincide =
        !texto ||
        Object.values(registro).some((value) =>
          String(value).toLowerCase().includes(texto),
        );

      const negocioCoincide =
        !negocio || registro.negocio.toLowerCase().includes(negocio);

      const estadoCoincide =
        ignoreEstado || filtros.selectedEstados.length === 0 || filtros.selectedEstados.includes(registro.estado);

      const marcaCoincide =
        ignoreMarca || !marca || registro.upsMarca.toLowerCase().includes(marca);

      const dueDate = this.parseDate(registro.fechaVencimiento);
      const fechaDesdeCoincide = !fechaDesde || (!!dueDate && dueDate >= fechaDesde);
      const fechaHastaCoincide = !fechaHasta || (!!dueDate && dueDate <= fechaHasta);

      return textoCoincide && negocioCoincide && estadoCoincide && marcaCoincide && fechaDesdeCoincide && fechaHastaCoincide;
    });
  }

  private parseDate(value: string): Date | null {
    const raw = value.trim();
    if (!raw) {
      return null;
    }

    const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymdMatch) {
      const parsed = new Date(Number(ymdMatch[1]), Number(ymdMatch[2]) - 1, Number(ymdMatch[3]));
      parsed.setHours(0, 0, 0, 0);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const dmyMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmyMatch) {
      const parsed = new Date(Number(dmyMatch[3]), Number(dmyMatch[2]) - 1, Number(dmyMatch[1]));
      parsed.setHours(0, 0, 0, 0);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const fallback = new Date(raw);
    fallback.setHours(0, 0, 0, 0);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  private mapRegistro(registro: RegistroApi): RegistroListado {
    const normalizeKey = (key: string) =>
      key
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[\s\u00a0\u202f]+/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    const normalizedMap = Object.keys(registro).reduce<Record<string, string>>(
      (acc, key) => {
        acc[normalizeKey(key)] = String(registro[key] ?? '');
        return acc;
      },
      {},
    );

    const getValue = (keys: string[]) => {
      for (const key of keys) {
        const value = normalizedMap[normalizeKey(key)];
        if (value !== undefined) {
          return value;
        }
      }
      return '';
    };

    const getValueByContains = (tokens: string[]) => {
      const normalizedTokens = tokens.map((token) => normalizeKey(token));
      const matchedKey = Object.keys(normalizedMap).find((key) =>
        normalizedTokens.every((token) => key.includes(token)),
      );
      return matchedKey ? normalizedMap[matchedKey] : '';
    };

    const getValueByRawContains = (tokens: string[]) => {
      const normalizedTokens = tokens.map((token) => normalizeKey(token));
      for (const [key, value] of Object.entries(registro)) {
        const normalizedKey = normalizeKey(key);
        if (normalizedTokens.every((token) => normalizedKey.includes(token))) {
          return String(value ?? '');
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
        return '';
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

    const diffInYearsMonthsDays = (start: Date, end: Date) => {
      let years = end.getFullYear() - start.getFullYear();
      let months = end.getMonth() - start.getMonth();
      let days = end.getDate() - start.getDate();

      if (days < 0) {
        const previousMonth = new Date(end.getFullYear(), end.getMonth(), 0);
        days += previousMonth.getDate();
        months -= 1;
      }

      if (months < 0) {
        months += 12;
        years -= 1;
      }

      return { years, months, days };
    };

    const computeTiempoDetalle = (dueDateText: string) => {
      const dueDate = parseDate(dueDateText);
      if (!dueDate) {
        return '';
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);
      const [start, end] = dueDate < today ? [dueDate, today] : [today, dueDate];
      const { years, months, days } = diffInYearsMonthsDays(start, end);
      return `${years} AÑOS ${months} MESES ${days} DIAS`;
    };

    const fechaVencimiento = getValue([
      'FECHA DE VENCIMIENTO',
      'Fecha de vencimiento',
      'Fecha vencimiento',
    ]);

    const estadoApi = getValue(['ESTADO', 'Estado']);
    const estado = estadoApi || computeEstado(fechaVencimiento);
    const anosMesesDiasApi = getValue([
      'AÑOS/ MESES/ DIAS',
      'ANOS/ MESES/ DIAS',
      'Años/ Meses/ Dias',
      'Anos/ Meses/ Dias',
      'Años meses dias',
      'Anos meses dias',
    ]);
    const anosMesesDias = anosMesesDiasApi || computeTiempoDetalle(fechaVencimiento);

    return {
      cod: getValue(['COD', 'Cod']),
      negocio: getValue(['Negocio']),
      upsMarca: getValue(['UPS Marca', 'UPS marca', 'UPS_Marca']),
      modelo: getValue(['Modelo', 'Modelo/Referencia', 'Modelo Referencia']) ||
        getValueByContains(['modelo']) ||
        getValueByRawContains(['modelo']),
      capacidad: getValue(['Capacidad']),
      serial: getValue(['Serial', 'Serial No', 'Numero de serial', 'No Serial']) ||
        getValueByContains(['serial']) ||
        getValueByRawContains(['serial']),
      inventarioNo: getValue(['Inventario No', 'Inventario', 'Inventario N']),
      fechaInstalacion: getValue([
        'FECHA DE INSTALACION',
        'Fecha de instalacion',
        'Fecha instalacion',
      ]),
      referencia: getValue(['REFERENCIA', 'Referencia']),
      cantidad: getValue(['CANTIDAD', 'Cantidad']),
      fechaVencimiento,
      estado,
      anosMesesDias,
    };
  }
}
