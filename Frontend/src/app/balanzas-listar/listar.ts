import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, Observable, Subject, asyncScheduler, catchError, combineLatest, finalize, map, observeOn, of, shareReplay, startWith, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';

type RegistroApi = Record<string, string | number>;

interface RegistroListadoBalanza {
  cod: string;
  negocio: string;
  marca: string;
  modelo: string;
  ubicacion: string;
  activo: string;
  serial: string;
  fechaCertificacion: string;
  nii: string;
  fechaVencimiento: string;
  estado: string;
  diasVencidos: string;
  actas: string;
  observaciones: string;
}

interface FiltrosListado {
  searchText: string;
  negocioFilter: string;
  marcaFilter: string;
  fechaDesde: string;
  fechaHasta: string;
  selectedEstados: string[];
}

@Component({
  selector: 'app-balanzas-listar',
  imports: [AsyncPipe, FormsModule, NgFor, NgIf, RouterLink, HttpClientModule],
  templateUrl: './listar.html',
  styleUrl: './listar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BalanzasListar implements OnInit {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/balanzas?all=1`;
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

  protected readonly estados = ['Vigente', 'Por vencer', 'Vencido'];
  protected registros$!: Observable<RegistroListadoBalanza[] | null>;
  protected registrosFiltrados$!: Observable<RegistroListadoBalanza[] | null>;
  protected marcasDisponibles$!: Observable<string[]>;

  constructor(
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.registros$ = this.refreshSubject.pipe(
      startWith(undefined),
      switchMap(() =>
        this.http.get<RegistroApi[]>(this.apiUrl).pipe(
          map((data) => data.map((registro) => this.mapRegistro(registro))),
          catchError(() => {
            this.errorMessage = 'No se pudo cargar la informacion del Excel de balanzas.';
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

    this.marcasDisponibles$ = this.registros$.pipe(
      map((registros) => {
        if (!registros) {
          return [];
        }

        return Array.from(
          new Set(registros.map((item) => item.marca).filter((item) => item.trim().length > 0)),
        ).sort((a, b) => a.localeCompare(b));
      }),
      observeOn(asyncScheduler),
      shareReplay(1),
    );
  }

  ngOnInit(): void {
    setTimeout(() => this.fetchRegistros(), 0);
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

  isEstadoActivo(estado: string): boolean {
    return this.selectedEstados.includes(estado);
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
    registros: RegistroListadoBalanza[],
    filtros: FiltrosListado,
  ): RegistroListadoBalanza[] {
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
        filtros.selectedEstados.length === 0 || filtros.selectedEstados.includes(registro.estado);

      const marcaCoincide =
        !marca || registro.marca.toLowerCase().includes(marca);

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

    const fallback = new Date(raw);
    fallback.setHours(0, 0, 0, 0);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  private mapRegistro(registro: RegistroApi): RegistroListadoBalanza {
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

    const fechaVencimiento = getValue(['FECHA DE VENCIMIENTO', 'Fecha de vencimiento']);
    const estadoApi = getValue(['ESTADO', 'Estado']);
    const estado = estadoApi || this.computeEstado(fechaVencimiento);

    return {
      cod: getValue(['COD', 'Cod']),
      negocio: getValue(['Negocio']),
      marca: getValue(['Marca']),
      modelo: getValue(['Modelo']),
      ubicacion: getValue(['Ubicación', 'Ubicacion']),
      activo: getValue(['Activo']),
      serial: getValue(['Serial']),
      fechaCertificacion: getValue(['FECHA CERTIFICACION - COMPRA', 'Fecha certificacion compra']),
      nii: getValue(['NII']),
      fechaVencimiento,
      estado,
      diasVencidos: getValue(['DIAS VENCIDOS', 'Dias vencidos']),
      actas: getValue(['ACTAS', 'Actas']),
      observaciones: getValue(['OBSERVACIONES', 'Observaciones']),
    };
  }

  private computeEstado(fechaVencimiento: string): string {
    const dueDate = this.parseDate(fechaVencimiento);
    if (!dueDate) {
      return '';
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) {
      return 'Vencido';
    }
    if (diffDays <= 30) {
      return 'Por vencer';
    }
    return 'Vigente';
  }
}
