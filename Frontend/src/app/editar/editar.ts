import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, combineLatest, finalize, map, Observable, of, shareReplay, startWith, Subject, switchMap, asyncScheduler, observeOn } from 'rxjs';
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

@Component({
  selector: 'app-editar',
  imports: [AsyncPipe, FormsModule, NgFor, NgIf, RouterLink, HttpClientModule],
  templateUrl: './editar.html',
  styleUrl: './editar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Editar implements OnInit {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/baterias`;
  private readonly defaultLifeMonths = 36;
  private readonly filtrosSubject = new BehaviorSubject({ searchText: '' });
  private readonly refreshSubject = new Subject<void>();

  protected searchText = '';
  protected selectedRegistro: RegistroEditable | null = null;
  protected isLoading = false;
  protected isSaving = false;
  protected errorMessage = '';
  protected savedMessage = '';

  protected registros$!: Observable<RegistroEditable[] | null>;
  protected resultados$!: Observable<RegistroEditable[] | null>;

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

  fetchRegistros(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();
    this.refreshSubject.next();
  }

  onSearchChange(): void {
    this.filtrosSubject.next({ searchText: this.searchText });
  }

  onSelect(registro: RegistroEditable): void {
    this.savedMessage = '';
    this.selectedRegistro = { ...registro };
  }

  onSave(): void {
    if (!this.selectedRegistro) {
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    this.savedMessage = '';
    this.cdr.markForCheck();

    const payload = this.buildPayload(this.selectedRegistro);
    this.http.put(`${this.apiUrl}/${this.selectedRegistro.rowId}`, payload).pipe(
      finalize(() => {
        this.isSaving = false;
        this.cdr.markForCheck();
      }),
    ).subscribe({
      next: () => {
        this.savedMessage = 'Registro actualizado.';
        this.fetchRegistros();
      },
      error: () => {
        this.errorMessage = 'No se pudo guardar el registro.';
      },
    });
  }

  onReset(): void {
    this.selectedRegistro = null;
    this.savedMessage = '';
  }

  private applyFilters(registros: RegistroEditable[], searchText: string): RegistroEditable[] {
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
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return value;
      }
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
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
    const parsed = new Date(value);
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
