import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, combineLatest, finalize, map, Observable, of, shareReplay, startWith, Subject, switchMap, asyncScheduler, observeOn } from 'rxjs';
import { environment } from '../../environments/environment';

type RegistroApi = Record<string, string | number>;

interface RegistroEliminar {
  rowId: string;
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
  estado: string;
}

@Component({
  selector: 'app-eliminar',
  imports: [AsyncPipe, FormsModule, NgFor, NgIf, RouterLink, HttpClientModule],
  templateUrl: './eliminar.html',
  styleUrl: './eliminar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Eliminar implements OnInit {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/baterias`;
  private readonly exportBaseUrl = `${environment.apiBaseUrl}/api/baterias/export`;
  private readonly filtrosSubject = new BehaviorSubject({ searchText: '' });
  private readonly refreshSubject = new Subject<void>();

  protected searchText = '';
  protected selectedRegistro: RegistroEliminar | null = null;
  protected isLoading = false;
  protected isDeleting = false;
  protected requiresDeleteConfirmation = false;
  protected confirmText = '';
  protected errorMessage = '';
  protected deletedMessage = '';

  protected registros$!: Observable<RegistroEliminar[] | null>;
  protected resultados$!: Observable<RegistroEliminar[] | null>;

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

    this.resultados$ = combineLatest([
      this.registros$,
      this.filtrosSubject.asObservable(),
    ]).pipe(
      map(([registros, filtros]) =>
        registros ? this.applyFilters(registros, filtros.searchText) : null,
      ),
      observeOn(asyncScheduler),
    );
  }

  ngOnInit(): void {
    setTimeout(() => this.fetchRegistros(), 0);
  }

  get exportUrl(): string {
    return `${this.exportBaseUrl}?estado=${encodeURIComponent('all')}`;
  }

  onRefresh(): void {
    this.fetchRegistros();
  }

  onClearSearch(): void {
    this.searchText = '';
    this.onSearchChange();
  }

  fetchRegistros(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();
    this.refreshSubject.next();
  }

  onSearchChange(): void {
    this.filtrosSubject.next({ searchText: this.searchText });
  }

  onSelect(registro: RegistroEliminar): void {
    this.deletedMessage = '';
    this.errorMessage = '';
    this.confirmText = '';
    this.requiresDeleteConfirmation = false;
    this.selectedRegistro = { ...registro };
  }

  onDelete(): void {
    if (!this.selectedRegistro) {
      return;
    }

    if (!this.requiresDeleteConfirmation) {
      this.requiresDeleteConfirmation = true;
      this.errorMessage = '';
      this.cdr.markForCheck();
      return;
    }

    const expected = (this.selectedRegistro.serial || this.selectedRegistro.cod).trim().toLowerCase();
    const typed = this.confirmText.trim().toLowerCase();
    if (!typed || typed !== expected) {
      this.errorMessage = 'Confirmacion invalida. Escribe exactamente el Serial (o COD si no hay Serial).';
      this.cdr.markForCheck();
      return;
    }

    this.isDeleting = true;
    this.errorMessage = '';
    this.deletedMessage = '';
    this.cdr.markForCheck();

    this.http.delete(`${this.apiUrl}/${this.selectedRegistro.rowId}`).pipe(
      finalize(() => {
        this.isDeleting = false;
        this.cdr.markForCheck();
      }),
    ).subscribe({
      next: () => {
        this.deletedMessage = 'Registro eliminado.';
        this.selectedRegistro = null;
        this.confirmText = '';
        this.requiresDeleteConfirmation = false;
        this.fetchRegistros();
      },
      error: () => {
        this.errorMessage = 'No se pudo eliminar el registro.';
      },
    });
  }

  onReset(): void {
    this.selectedRegistro = null;
    this.deletedMessage = '';
    this.errorMessage = '';
    this.confirmText = '';
    this.requiresDeleteConfirmation = false;
  }

  private applyFilters(registros: RegistroEliminar[], searchText: string): RegistroEliminar[] {
    const texto = searchText.trim().toLowerCase();
    if (!texto) {
      return registros;
    }

    return registros.filter((registro) =>
      Object.values(registro).some((value) =>
        String(value).toLowerCase().includes(texto),
      ),
    );
  }

  private mapRegistro(registro: RegistroApi): RegistroEliminar {
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

    return {
      rowId: this.getRowId(registro),
      cod: getValue(['COD', 'Cod']),
      negocio: getValue(['Negocio']),
      upsMarca: getValue(['UPS Marca', 'UPS marca', 'UPS_Marca']),
      modelo: getValue(['Modelo', 'Modelo/Referencia', 'Modelo Referencia']),
      capacidad: getValue(['Capacidad']),
      serial: getValue(['Serial', 'Serial No', 'Numero de serial', 'No Serial']),
      inventarioNo: getValue(['Inventario No', 'Inventario', 'Inventario N']),
      fechaInstalacion: getValue([
        'FECHA DE INSTALACION',
        'Fecha de instalacion',
        'Fecha instalacion',
      ]),
      referencia: getValue(['REFERENCIA', 'Referencia']),
      cantidad: getValue(['CANTIDAD', 'Cantidad']),
      estado: getValue(['ESTADO', 'Estado']),
    };
  }

  private getRowId(registro: RegistroApi): string {
    const value = registro['rowId'] ?? registro['id'] ?? registro['RowKey'];
    return value === undefined || value === null ? '' : String(value);
  }
}
