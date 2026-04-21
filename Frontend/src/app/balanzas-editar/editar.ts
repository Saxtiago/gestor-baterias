import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, combineLatest, finalize, forkJoin, map, Observable, of, shareReplay, startWith, Subject, switchMap, asyncScheduler, observeOn, tap } from 'rxjs';
import { environment } from '../../environments/environment';

type RegistroApi = Record<string, string | number>;

interface RegistroEditableBalanza {
  rowId: string;
  cod: string;
  negocio: string;
  marca: string;
  modelo: string;
  ubicacion: string;
  activo: string;
  serial: string;
  fechaCertificacion: string;
  nii: string;
  actas: string;
  observaciones: string;
}

interface ChangeItem {
  label: string;
  before: string;
  after: string;
}

interface GrupoNegocio {
  negocio: string;
  registros: RegistroEditableBalanza[];
  total: number;
  vencidas: number;
}

@Component({
  selector: 'app-balanzas-editar',
  imports: [AsyncPipe, FormsModule, NgFor, NgIf, RouterLink, HttpClientModule],
  templateUrl: './editar.html',
  styleUrl: './editar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BalanzasEditar implements OnInit {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/balanzas`;
  private readonly defaultLifeMonths = 24;
  private readonly filtrosSubject = new BehaviorSubject({ searchText: '' });
  private readonly refreshSubject = new Subject<void>();
  private registrosCache: RegistroEditableBalanza[] = [];

  protected searchText = '';
  protected selectedNegocio = '';
  protected selectedRegistros: RegistroEditableBalanza[] = [];
  protected originalRegistros: RegistroEditableBalanza[] = [];
  protected isLoading = false;
  protected isSaving = false;
  protected errorMessage = '';
  protected savedMessage = '';

  protected registros$!: Observable<RegistroEditableBalanza[] | null>;
  protected resultados$!: Observable<GrupoNegocio[] | null>;

  constructor(
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.registros$ = this.refreshSubject.pipe(
      startWith(undefined),
      switchMap(() =>
        this.http.get<RegistroApi[]>(this.apiUrl).pipe(
          map((data) => data.map((registro) => this.mapRegistro(registro))),
          tap((registros) => {
            this.registrosCache = registros;
          }),
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
        registros ? this.groupRegistros(registros, filtros.searchText) : null,
      ),
      observeOn(asyncScheduler),
    );
  }

  ngOnInit(): void {
    setTimeout(() => this.fetchRegistros(), 0);
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.hasUnsavedChanges) {
      return;
    }

    event.preventDefault();
    event.returnValue = '';
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

  onSelectGroup(grupo: GrupoNegocio): void {
    const registros = this.registrosCache.filter(
      (registro) => this.normalizeText(registro.negocio) === this.normalizeText(grupo.negocio),
    );

    this.savedMessage = '';
    this.errorMessage = '';
    this.selectedNegocio = grupo.negocio;
    this.selectedRegistros = registros.map((registro) => ({ ...registro }));
    this.originalRegistros = registros.map((registro) => ({ ...registro }));
    this.cdr.markForCheck();
  }

  onSave(): void {
    if (!this.selectedRegistros.length) {
      return;
    }

    if (!this.hasUnsavedChanges) {
      this.savedMessage = 'No hay cambios por guardar.';
      this.errorMessage = '';
      this.cdr.markForCheck();
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    this.savedMessage = '';
    this.cdr.markForCheck();

    const requests = this.selectedRegistros.map((registro) =>
      this.http.put(`${this.apiUrl}/${registro.rowId}`, this.buildPayload(registro)),
    );

    forkJoin(requests).pipe(
      finalize(() => {
        this.isSaving = false;
        this.cdr.markForCheck();
      }),
    ).subscribe({
      next: () => {
        this.savedMessage = `Se actualizaron ${this.selectedRegistros.length} registros del negocio ${this.selectedNegocio}.`;
        this.originalRegistros = this.selectedRegistros.map((registro) => ({ ...registro }));
        this.fetchRegistros();
      },
      error: () => {
        this.errorMessage = 'No se pudo guardar el registro.';
      },
    });
  }

  onReset(): void {
    if (this.hasUnsavedChanges) {
      const shouldDiscard = window.confirm('Hay cambios sin guardar. ¿Deseas descartarlos?');
      if (!shouldDiscard) {
        return;
      }
    }

    this.selectedNegocio = '';
    this.selectedRegistros = [];
    this.originalRegistros = [];
    this.savedMessage = '';
    this.errorMessage = '';
    this.cdr.markForCheck();
  }

  get hasUnsavedChanges(): boolean {
    if (!this.selectedRegistros.length || !this.originalRegistros.length) {
      return false;
    }

    return this.changeSummary.length > 0;
  }

  get changeSummary(): ChangeItem[] {
    const fields: Array<{ key: keyof RegistroEditableBalanza; label: string }> = [
      { key: 'cod', label: 'COD' },
      { key: 'negocio', label: 'Negocio' },
      { key: 'marca', label: 'Marca' },
      { key: 'modelo', label: 'Modelo' },
      { key: 'ubicacion', label: 'Ubicacion' },
      { key: 'activo', label: 'Activo' },
      { key: 'serial', label: 'Serial' },
      { key: 'fechaCertificacion', label: 'Fecha certificacion' },
      { key: 'nii', label: 'NII' },
      { key: 'actas', label: 'Actas' },
      { key: 'observaciones', label: 'Observaciones' },
    ];

    return this.selectedRegistros.flatMap((registro, index) => {
      const originalRegistro = this.originalRegistros[index];
      if (!originalRegistro) {
        return [];
      }

      return fields
        .filter((field) => {
          const before = String(originalRegistro[field.key] ?? '').trim();
          const after = String(registro[field.key] ?? '').trim();
          return before !== after;
        })
        .map((field) => ({
          label: `${field.label} - Registro ${index + 1}`,
          before: String(originalRegistro[field.key] ?? ''),
          after: String(registro[field.key] ?? ''),
        }));
    });
  }

  protected getRegistroFechaVencimiento(registro: RegistroEditableBalanza): string {
    return this.computeFechaVencimiento(registro.fechaCertificacion);
  }

  protected getRegistroEstado(registro: RegistroEditableBalanza): string {
    return this.computeEstado(this.getRegistroFechaVencimiento(registro));
  }

  private groupRegistros(registros: RegistroEditableBalanza[], searchText: string): GrupoNegocio[] {
    const texto = searchText.trim().toLowerCase();
    const grupos = new Map<string, RegistroEditableBalanza[]>();
    const negocioKeys = new Set<string>();

    for (const registro of registros) {
      const negocioKey = this.normalizeText(registro.negocio);
      const current = grupos.get(negocioKey) ?? [];
      current.push(registro);
      grupos.set(negocioKey, current);

      if (!texto || this.normalizeText(registro.negocio).includes(texto)) {
        negocioKeys.add(negocioKey);
      }
    }

    return Array.from(negocioKeys).map((negocioKey) => {
      const registrosDelNegocio = grupos.get(negocioKey) ?? [];
      return {
        negocio: registrosDelNegocio[0]?.negocio ?? '',
        registros: registrosDelNegocio.map((registro) => ({ ...registro })),
        total: registrosDelNegocio.length,
        vencidas: registrosDelNegocio.filter((registro) => this.getRegistroEstado(registro) === 'Vencido').length,
      };
    }).sort((a, b) => a.negocio.localeCompare(b.negocio, 'es', { sensitivity: 'base' }));
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private mapRegistro(registro: RegistroApi): RegistroEditableBalanza {
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

    const toInputDate = (value: string) => {
      if (!value) {
        return '';
      }
      const isoMatch = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
      }
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return value;
      }
      const year = parsed.getUTCFullYear();
      const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
      const day = String(parsed.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return {
      rowId: this.getRowId(registro),
      cod: getValue(['COD', 'Cod']),
      negocio: getValue(['Negocio']),
      marca: getValue(['Marca']),
      modelo: getValue(['Modelo']),
      ubicacion: getValue(['Ubicación', 'Ubicacion']),
      activo: getValue(['Activo']),
      serial: getValue(['Serial']),
      fechaCertificacion: toInputDate(getValue(['FECHA CERTIFICACION - COMPRA', 'Fecha certificacion compra'])),
      nii: getValue(['NII']),
      actas: getValue(['ACTAS', 'Actas']),
      observaciones: getValue(['OBSERVACIONES', 'Observaciones']),
    };
  }

  private getRowId(registro: RegistroApi): string {
    const value = registro['rowId'] ?? registro['id'] ?? registro['RowKey'];
    return value === undefined || value === null ? '' : String(value);
  }

  private buildPayload(registro: RegistroEditableBalanza): Record<string, string | number> {
    const fechaVencimiento = this.computeFechaVencimiento(registro.fechaCertificacion);
    const diasVencidos = this.computeDiasVencidos(fechaVencimiento);

    return {
      COD: registro.cod,
      Negocio: registro.negocio,
      Marca: registro.marca,
      Modelo: registro.modelo,
      'Ubicación': registro.ubicacion,
      Activo: registro.activo,
      Serial: registro.serial,
      'FECHA CERTIFICACION - COMPRA': registro.fechaCertificacion,
      NII: registro.nii,
      'FECHA DE VENCIMIENTO': fechaVencimiento,
      ESTADO: this.computeEstado(fechaVencimiento),
      'DIAS VENCIDOS': diasVencidos,
      ACTAS: registro.actas,
      OBSERVACIONES: registro.observaciones,
    };
  }

  private computeFechaVencimiento(fechaCertificacion: string): string {
    const start = this.parseDate(fechaCertificacion);
    if (!start) {
      return '';
    }
    const dueDate = this.addMonths(start, this.defaultLifeMonths);
    return this.formatDateInput(dueDate);
  }

  private computeDiasVencidos(fechaVencimiento: string): number | string {
    const dueDate = this.parseDate(fechaVencimiento);
    if (!dueDate) {
      return '';
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.floor((dueDate.getTime() - today.getTime()) / 86400000);
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

  private parseDate(value: string): Date | null {
    if (!value) {
      return null;
    }
    const clean = value.trim();
    const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    }
    const parsed = new Date(clean);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private addMonths(date: Date, months: number): Date {
    const updated = new Date(date.getTime());
    updated.setMonth(updated.getMonth() + months);
    return updated;
  }

  private formatDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
