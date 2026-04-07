import { AsyncPipe, isPlatformBrowser, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, combineLatest, map, catchError, finalize, of, switchMap, shareReplay, Observable, Subject, asyncScheduler, observeOn, startWith } from 'rxjs';
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

@Component({
  selector: 'app-listar',
  imports: [AsyncPipe, FormsModule, NgFor, NgIf, RouterLink, HttpClientModule],
  templateUrl: './listar.html',
  styleUrl: './listar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Listar implements OnInit {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/baterias?all=1`;
  private readonly filtrosSubject = new BehaviorSubject({
    searchText: '',
    estadoFilter: '',
    negocioFilter: '',
  });
  private readonly refreshSubject = new Subject<void>();

  constructor(
    private readonly http: HttpClient,
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
    );
  }

  protected searchText = '';
  protected estadoFilter = '';
  protected negocioFilter = '';
  protected isLoading = false;
  protected errorMessage = '';

  protected readonly estados = ['Vigente', 'Por vencer', 'Vencido'];
  protected registros$!: Observable<RegistroListado[] | null>;
  protected registrosFiltrados$!: Observable<RegistroListado[] | null>;

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => this.fetchRegistros(), 0);
    }
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
      estadoFilter: this.estadoFilter,
      negocioFilter: this.negocioFilter,
    });
  }

  onClearFilters(): void {
    this.searchText = '';
    this.estadoFilter = '';
    this.negocioFilter = '';
    this.onFiltersChange();
  }

  private applyFilters(
    registros: RegistroListado[],
    filtros: { searchText: string; estadoFilter: string; negocioFilter: string },
  ): RegistroListado[] {
    const texto = filtros.searchText.trim().toLowerCase();
    const negocio = filtros.negocioFilter.trim().toLowerCase();

    return registros.filter((registro) => {
      const textoCoincide =
        !texto ||
        Object.values(registro).some((value) =>
          String(value).toLowerCase().includes(texto),
        );

      const negocioCoincide =
        !negocio || registro.negocio.toLowerCase().includes(negocio);

      const estadoCoincide =
        !filtros.estadoFilter || registro.estado === filtros.estadoFilter;

      return textoCoincide && negocioCoincide && estadoCoincide;
    });
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
