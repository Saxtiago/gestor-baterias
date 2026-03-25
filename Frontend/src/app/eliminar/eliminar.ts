import { NgFor, NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-eliminar',
  imports: [FormsModule, NgFor, NgIf, RouterLink],
  templateUrl: './eliminar.html',
  styleUrl: './eliminar.css',
})
export class Eliminar {
  protected searchText = '';
  protected selectedIndex: number | null = null;

  protected readonly registros = [
    {
      cod: '990',
      negocio: 'BODEGA SISTEMAS',
      upsMarca: 'POWERWARE',
      modelo: 'PW9120 3000',
      serial: 'RW512A0334',
      inventarioNo: '1223025',
      fechaInstalacion: '2020-08-15',
      estado: 'Vencido',
    },
    {
      cod: '990',
      negocio: 'BODEGA SISTEMAS',
      upsMarca: 'POWERWARE',
      modelo: 'PW9120 3000',
      serial: '000-239',
      inventarioNo: 'N.T',
      fechaInstalacion: '2012-12-12',
      estado: 'Vencido',
    },
  ];

  get resultados() {
    const texto = this.searchText.trim().toLowerCase();
    if (!texto) {
      return this.registros;
    }

    return this.registros.filter((registro) =>
      Object.values(registro).some((value) =>
        String(value).toLowerCase().includes(texto),
      ),
    );
  }

  get registroSeleccionado() {
    if (this.selectedIndex === null) {
      return null;
    }

    return this.resultados[this.selectedIndex] ?? null;
  }

  onSelect(index: number): void {
    this.selectedIndex = index;
  }

  onDelete(): void {
    if (!this.registroSeleccionado) {
      return;
    }

    console.log('Registro eliminado (temporal).', this.registroSeleccionado);
    this.selectedIndex = null;
  }

  onReset(): void {
    this.selectedIndex = null;
  }
}
