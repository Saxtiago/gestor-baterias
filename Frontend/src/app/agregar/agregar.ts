
import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-agregar',
  imports: [HttpClientModule, NgIf, ReactiveFormsModule, RouterLink],
  templateUrl: './agregar.html',
  styleUrl: './agregar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Agregar {
  private readonly apiUrl = 'http://127.0.0.1:5000/api/baterias';
  private readonly defaultLifeMonths = 36;

  protected readonly batteryForm = new FormGroup({
    cod: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    negocio: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    upsMarca: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    modelo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    capacidad: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    serial: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    inventarioNo: new FormControl('', {
      nonNullable: true,
    }),
    fechaInstalacion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    referencia: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    cantidad: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
  });

  protected savedMessage = '';
  protected errorMessage = '';
  protected isSaving = false;

  constructor(
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
  ) {}

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
    const diff = Math.floor((dueDate.getTime() - today.getTime()) / 86400000);
    return diff;
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

  get tiempoDetalle(): string {
    const dueDate = this.getDueDate();
    if (!dueDate) {
      return '';
    }

    const today = this.getToday();
    const [start, end] = dueDate < today ? [dueDate, today] : [today, dueDate];
    const { years, months, days } = this.diffInYearsMonthsDays(start, end);

    return `${years} AÑOS ${months} MESES ${days} DIAS`;
  }

  onSubmit(): void {
    this.savedMessage = '';
    this.errorMessage = '';
    if (this.batteryForm.invalid) {
      this.batteryForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.cdr.markForCheck();
    const payload = this.buildPayload();

    this.http.post(this.apiUrl, payload).pipe(
      finalize(() => {
        this.isSaving = false;
        this.cdr.markForCheck();
      }),
    ).subscribe({
      next: () => {
        this.savedMessage = 'Registro guardado.';
        this.onReset();
      },
      error: () => {
        this.errorMessage = 'No se pudo guardar el registro.';
      },
    });
  }

  onReset(): void {
    this.batteryForm.reset({
      cod: '',
      negocio: '',
      upsMarca: '',
      modelo: '',
      capacidad: '',
      serial: '',
      inventarioNo: '',
      fechaInstalacion: '',
      referencia: '',
      cantidad: 1,
    });
    this.savedMessage = '';
    this.errorMessage = '';
  }

  private buildPayload(): Record<string, string | number> {
    const raw = this.batteryForm.getRawValue();
    const diasVencidos = this.diasVencidos;
    return {
      COD: raw.cod,
      Negocio: raw.negocio,
      'UPS Marca': raw.upsMarca,
      Modelo: raw.modelo,
      Capacidad: raw.capacidad,
      Serial: raw.serial,
      'Inventario No': raw.inventarioNo,
      'FECHA DE INSTALACION': raw.fechaInstalacion,
      REFERENCIA: raw.referencia,
      CANTIDAD: raw.cantidad,
      'FECHA DE VENCIMIENTO': this.fechaVencimiento,
      ESTADO: this.estado,
      'DIAS VENCIDOS': diasVencidos ?? '',
      'AÑOS/ MESES/ DIAS': this.tiempoDetalle,
    };
  }

  private getDueDate(): Date | null {
    const rawDate = this.batteryForm.controls.fechaInstalacion.value;
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

  private diffInYearsMonthsDays(start: Date, end: Date): { years: number; months: number; days: number } {
    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();

    if (days < 0) {
      months -= 1;
      const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
      days += prevMonth.getDate();
    }

    if (months < 0) {
      years -= 1;
      months += 12;
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
