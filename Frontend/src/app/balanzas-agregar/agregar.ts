
import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { environment } from '../../environments/environment';

type RegistroApi = Record<string, string | number>;

@Component({
  selector: 'app-balanzas-agregar',
  imports: [HttpClientModule, NgIf, ReactiveFormsModule, RouterLink],
  templateUrl: './agregar.html',
  styleUrl: './agregar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BalanzasAgregar {
  private readonly apiUrl = `${environment.apiBaseUrl?.replace(/\/$/, '') ?? ''}/api/balanzas`;
  private readonly defaultLifeMonths = 24;
  private existingSerials = new Set<string>();

  protected readonly form = new FormGroup({
    cod: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    negocio: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    marca: new FormControl('', { nonNullable: true }),
    modelo: new FormControl('', { nonNullable: true }),
    ubicacion: new FormControl('', { nonNullable: true }),
    activo: new FormControl('', { nonNullable: true }),
    serial: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    fechaCertificacion: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nii: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    actas: new FormControl('', { nonNullable: true }),
    observaciones: new FormControl('', { nonNullable: true }),
  });

  protected savedMessage = '';
  protected errorMessage = '';
  protected isSaving = false;

  constructor(
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.loadExistingSerials();
  }

  get duplicateSerialWarning(): string {
    const serial = this.form.controls.serial.value.trim().toLowerCase();
    if (!serial) {
      return '';
    }
    return this.existingSerials.has(serial)
      ? 'Este serial ya existe en el inventario. Verifica antes de guardar.'
      : '';
  }

  get fechaVencimiento(): string {
    const dueDate = this.getDueDate();
    return dueDate ? this.formatDateInput(dueDate) : '';
  }

  get diasVencidos(): number | null {
    const dueDate = this.getDueDate();
    if (!dueDate) {
      return null;
    }
    const today = this.getToday();
    return Math.floor((dueDate.getTime() - today.getTime()) / 86400000);
  }

  get estado(): string {
    const days = this.diasVencidos;
    if (days === null) {
      return '';
    }
    if (days < 0) {
      return 'Vencido';
    }
    if (days <= 30) {
      return 'Por vencer';
    }
    return 'Vigente';
  }

  onSubmit(): void {
    this.savedMessage = '';
    this.errorMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.duplicateSerialWarning) {
      this.errorMessage = this.duplicateSerialWarning;
      this.cdr.markForCheck();
      return;
    }

    this.isSaving = true;
    this.cdr.markForCheck();

    const payload = this.buildPayload();
    const serialSaved = this.form.controls.serial.value.trim().toLowerCase();

    this.http.post(this.apiUrl, payload).pipe(
      finalize(() => {
        this.isSaving = false;
        this.cdr.markForCheck();
      }),
    ).subscribe({
      next: () => {
        this.savedMessage = 'Registro de balanza guardado.';
        if (serialSaved) {
          this.existingSerials.add(serialSaved);
        }
        this.onReset();
      },
      error: (err) => {
        const backendMessage = err?.error?.error || err?.error?.message || err?.message || 'No se pudo guardar el registro.';
        this.errorMessage = `No se pudo guardar el registro. ${backendMessage}`;
      },
    });
  }

  onReset(): void {
    this.form.reset({
      cod: '',
      negocio: '',
      marca: '',
      modelo: '',
      ubicacion: '',
      activo: '',
      serial: '',
      fechaCertificacion: '',
      nii: '',
      actas: '',
      observaciones: '',
    });
    this.savedMessage = '';
    this.errorMessage = '';
  }

  private loadExistingSerials(): void {
    this.http.get<RegistroApi[]>(`${this.apiUrl}?all=1`).subscribe({
      next: (rows) => {
        const next = new Set<string>();
        rows.forEach((row) => {
          const serial = String(row['Serial'] ?? row['serial'] ?? '').trim().toLowerCase();
          if (serial) {
            next.add(serial);
          }
        });
        this.existingSerials = next;
        this.cdr.markForCheck();
      },
      error: () => {
        this.existingSerials = new Set<string>();
      },
    });
  }

  private buildPayload(): Record<string, string | number> {
    const raw = this.form.getRawValue();
    return {
      COD: raw.cod,
      Negocio: raw.negocio,
      Marca: raw.marca,
      Modelo: raw.modelo,
      'Ubicación': raw.ubicacion,
      Activo: raw.activo,
      Serial: raw.serial,
      'FECHA CERTIFICACION - COMPRA': raw.fechaCertificacion,
      NII: raw.nii,
      'FECHA DE VENCIMIENTO': this.fechaVencimiento,
      ESTADO: this.estado,
      'DIAS VENCIDOS': this.diasVencidos ?? '',
      ACTAS: raw.actas,
      OBSERVACIONES: raw.observaciones,
    };
  }

  private getDueDate(): Date | null {
    const rawDate = this.form.controls.fechaCertificacion.value;
    if (!rawDate) {
      return null;
    }
    const baseDate = new Date(`${rawDate}T00:00:00`);
    return this.addMonths(baseDate, this.defaultLifeMonths);
  }

  private getToday(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    const day = result.getDate();
    result.setMonth(result.getMonth() + months);
    if (result.getDate() < day) {
      result.setDate(0);
    }
    return result;
  }

  private formatDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
