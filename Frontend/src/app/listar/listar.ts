import { NgFor, NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-listar',
  imports: [FormsModule, NgFor, NgIf, RouterLink],
  templateUrl: './listar.html',
  styleUrl: './listar.css',
})
export class Listar {
  protected searchText = '';
  protected estadoFilter = '';
  protected negocioFilter = '';

  protected readonly estados = ['Vigente', 'Por vencer', 'Vencido'];

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
      fechaVencimiento: '2023-08-15',
      estado: 'Vencido',
      anosMesesDias: '2 AÑOS 7 MESES 10 DIAS',
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
      fechaVencimiento: '2015-12-12',
      estado: 'Vencido',
      anosMesesDias: '10 AÑOS 3 MESES 13 DIAS',
    },
  ];

  get registrosFiltrados() {
    return this.registros.filter((registro) => {
      const texto = this.searchText.trim().toLowerCase();
      const negocio = this.negocioFilter.trim().toLowerCase();

      const textoCoincide =
        !texto ||
        Object.values(registro).some((value) =>
          String(value).toLowerCase().includes(texto),
        );

      const negocioCoincide =
        !negocio || registro.negocio.toLowerCase().includes(negocio);

      const estadoCoincide =
        !this.estadoFilter || registro.estado === this.estadoFilter;

      return textoCoincide && negocioCoincide && estadoCoincide;
    });
  }

  onClearFilters(): void {
    this.searchText = '';
    this.estadoFilter = '';
    this.negocioFilter = '';
  }
}
