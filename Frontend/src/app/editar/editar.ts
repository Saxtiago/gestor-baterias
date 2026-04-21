import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, combineLatest, finalize, forkJoin, map, Observable, of, shareReplay, startWith, Subject, switchMap, asyncScheduler, observeOn, tap } from 'rxjs';
import { environment } from '../../environments/environment';

type RegistroApi = Record<string, string | number>;

interface RegistroEditable {
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
  cantidad: number;
}

interface ChangeItem {
  label: string;
  before: string;
  after: string;
}

interface GrupoNegocio {
  negocio: string;
  registros: RegistroEditable[];
  total: number;
  vencidas: number;
}

@Component({
  selector: 'app-editar',
  imports: [AsyncPipe, FormsModule, NgFor, NgIf, RouterLink, HttpClientModule],
  templateUrl: './editar.html',
  styleUrl: './editar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Editar implements OnInit {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/baterias`;
  private readonly exportBaseUrl = `${environment.apiBaseUrl}/api/baterias/export`;
  private readonly defaultLifeMonths = 36;
  private readonly filtrosSubject = new BehaviorSubject({ searchText: '' });
  private readonly refreshSubject = new Subject<void>();
  private registrosCache: RegistroEditable[] = [];

  protected searchText = '';
  protected selectedNegocio = '';
  protected selectedRegistros: RegistroEditable[] = [];
  protected originalRegistros: RegistroEditable[] = [];
  protected isLoading = false;
  protected isSaving = false;
  protected errorMessage = '';
  protected savedMessage = '';

  protected registros$!: Observable<RegistroEditable[] | null>;
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

  onRefresh(): void {
    this.fetchRegistros();
  }

  onClearSearch(): void {
    this.searchText = '';
    this.onSearchChange();
  }

  get exportUrl(): string {
    return `${this.exportBaseUrl}?estado=all`;
  }

  onSearchChange(): void {
    this.filtrosSubject.next({ searchText: this.searchText });
  }

  onSelect(registro: RegistroEditable): void {
    this.selectBusinessGroup(registro.negocio);
  }

  onSelectGroup(grupo: GrupoNegocio): void {
    this.selectBusinessGroup(grupo.negocio);
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
        const cantidad = this.selectedRegistros.length;
        this.savedMessage = cantidad === 1
          ? 'Registro actualizado.'
          : `Se actualizaron ${cantidad} registros del negocio ${this.selectedNegocio}.`;
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

    return this.getChangeSummary().length > 0;
  }

  get changeSummary(): ChangeItem[] {
    return this.getChangeSummary();
  }

  private getChangeSummary(): ChangeItem[] {
    if (!this.selectedRegistros.length || !this.originalRegistros.length) {
      return [];
    }

    const fields: Array<{ key: keyof RegistroEditable; label: string }> = [
      { key: 'cod', label: 'COD' },
      { key: 'negocio', label: 'Negocio' },
      { key: 'upsMarca', label: 'UPS Marca' },
      { key: 'modelo', label: 'Modelo' },
      { key: 'capacidad', label: 'Capacidad' },
      { key: 'serial', label: 'Serial' },
      { key: 'inventarioNo', label: 'Inventario No' },
      { key: 'fechaInstalacion', label: 'Fecha de instalacion' },
      { key: 'referencia', label: 'Referencia' },
      { key: 'cantidad', label: 'Cantidad' },
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

  private groupRegistros(registros: RegistroEditable[], searchText: string): GrupoNegocio[] {
    const texto = searchText.trim().toLowerCase();
    const grupos = new Map<string, RegistroEditable[]>();
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
        vencidas: registrosDelNegocio.filter((registro) => this.isRegistroVencido(registro)).length,
      };
    }).sort((a, b) => a.negocio.localeCompare(b.negocio, 'es', { sensitivity: 'base' }));
  }

  private selectBusinessGroup(negocio: string): void {
    const registros = this.registrosCache.filter(
      (registro) => this.normalizeText(registro.negocio) === this.normalizeText(negocio),
    );

    this.savedMessage = '';
    this.errorMessage = '';
    this.selectedNegocio = negocio;
    this.selectedRegistros = registros.map((registro) => ({ ...registro }));
    this.originalRegistros = registros.map((registro) => ({ ...registro }));
    this.cdr.markForCheck();
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  protected getRegistroFechaVencimiento(registro: RegistroEditable): string {
    return this.computeFechaVencimiento(registro.fechaInstalacion);
  }

  protected getRegistroEstado(registro: RegistroEditable): string {
    return this.computeEstado(this.getRegistroFechaVencimiento(registro));
  }

  protected isRegistroVencido(registro: RegistroEditable): boolean {
    return this.getRegistroEstado(registro) === 'Vencido';
  }

  private mapRegistro(registro: RegistroApi): RegistroEditable {
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
      upsMarca: getValue(['UPS Marca', 'UPS marca', 'UPS_Marca']),
      modelo: getValue(['Modelo', 'Modelo/Referencia', 'Modelo Referencia']),
      capacidad: getValue(['Capacidad']),
      serial: getValue(['Serial', 'Serial No', 'Numero de serial', 'No Serial']),
      inventarioNo: getValue(['Inventario No', 'Inventario', 'Inventario N']),
      fechaInstalacion: toInputDate(getValue([
        'FECHA DE INSTALACION',
        'Fecha de instalacion',
        'Fecha instalacion',
      ])),
      referencia: getValue(['REFERENCIA', 'Referencia']),
      cantidad: Number(getValue(['CANTIDAD', 'Cantidad']) || 0),
    };
  }

  private getRowId(registro: RegistroApi): string {
    const value = registro['rowId'] ?? registro['id'] ?? registro['RowKey'];
    return value === undefined || value === null ? '' : String(value);
  }

  private buildPayload(registro: RegistroEditable): Record<string, string | number> {
    const fechaInstalacion = registro.fechaInstalacion;
    const fechaVencimiento = this.computeFechaVencimiento(fechaInstalacion);
    const diasVencidos = this.computeDiasVencidos(fechaVencimiento);
    const estado = this.computeEstado(fechaVencimiento);
    const anosMesesDias = this.computeTiempoDetalle(fechaVencimiento);

    return {
      COD: registro.cod,
      Negocio: registro.negocio,
      'UPS Marca': registro.upsMarca,
      Modelo: registro.modelo,
      Capacidad: registro.capacidad,
      Serial: registro.serial,
      'Inventario No': registro.inventarioNo,
      'FECHA DE INSTALACION': fechaInstalacion,
      REFERENCIA: registro.referencia,
      CANTIDAD: registro.cantidad,
      'FECHA DE VENCIMIENTO': fechaVencimiento,
      ESTADO: estado,
      'DIAS VENCIDOS': diasVencidos,
      'AÑOS/ MESES/ DIAS': anosMesesDias,
    };
  }

  private computeFechaVencimiento(fechaInstalacion: string): string {
    const start = this.parseDate(fechaInstalacion);
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
    dueDate.setHours(0, 0, 0, 0);
    return Math.floor((dueDate.getTime() - today.getTime()) / 86400000);
  }

  private computeEstado(fechaVencimiento: string): string {
    const dueDate = this.parseDate(fechaVencimiento);
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
  }

  private computeTiempoDetalle(fechaVencimiento: string): string {
    const dueDate = this.parseDate(fechaVencimiento);
    if (!dueDate) {
      return '';
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    const [start, end] = dueDate < today ? [dueDate, today] : [today, dueDate];
    const { years, months, days } = this.diffInYearsMonthsDays(start, end);
    return `${years} AÑOS ${months} MESES ${days} DIAS`;
  }

  private parseDate(value: string): Date | null {
    if (!value) {
      return null;
    }

    const clean = value.trim();
    const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const year = Number(isoMatch[1]);
      const month = Number(isoMatch[2]) - 1;
      const day = Number(isoMatch[3]);
      return new Date(year, month, day);
    }

    const parsed = new Date(clean);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private addMonths(date: Date, months: number): Date {
    const updated = new Date(date.getTime());
    updated.setMonth(updated.getMonth() + months);
    return updated;
  }

  private diffInYearsMonthsDays(start: Date, end: Date): { years: number; months: number; days: number } {
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
  }

  private formatDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
