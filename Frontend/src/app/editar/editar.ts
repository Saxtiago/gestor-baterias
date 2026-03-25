import { NgFor, NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-editar',
  imports: [FormsModule, NgFor, NgIf, RouterLink],
  templateUrl: './editar.html',
  styleUrl: './editar.css',
})
export class Editar {
  protected searchText = '';
  protected selectedIndex: number | null = null;

  protected readonly registros = [
    {
      cod: '990',
      negocio: 'BODEGA SISTEMAS',
      upsMarca: 'POWERWARE',
      modelo: 'PW9120 3000',
      capacidad: '3KVA',
      serial: 'RW512A0334',
      inventarioNo: '1223025',
      fechaInstalacion: '2020-08-15',
      referencia: '12V-7AMP',
      cantidad: 8,
      estado: 'Vencido',
    },
    {
      cod: '990',
      negocio: 'BODEGA SISTEMAS',
      upsMarca: 'POWERWARE',
      modelo: 'PW9120 3000',
      capacidad: '3KVA',
      serial: '000-239',
      inventarioNo: 'N.T',
      fechaInstalacion: '2012-12-12',
      referencia: '12V-7AMP',
      cantidad: 8,
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

  onSave(): void {
    if (!this.registroSeleccionado) {
      return;
    }

    console.log('Registro actualizado (temporal).', this.registroSeleccionado);
  }

  onReset(): void {
    this.selectedIndex = null;
  }
}
