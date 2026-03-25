import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-inicio',
  imports: [RouterLink],
  template: `
    <section class="view-header">
      <h1>Sistema de Gestión</h1>
      <p>Selecciona el módulo con el que deseas trabajar.</p>
    </section>

    <section class="menu-grid">
      <a class="menu-card" routerLink="/modulos/baterias">
        <h2>Gestión de baterías</h2>
        <p>Registrar, consultar, editar y eliminar baterías.</p>
      </a>
    </section>
  `,
  styles: `
    .view-header {
      max-width: 900px;
      margin: 0 auto 2rem;
      text-align: center;
    }

    .view-header h1 {
      margin: 0;
      font-size: 2rem;
      color: #1f2937;
    }

    .view-header p {
      margin-top: 0.75rem;
      color: #4b5563;
    }

    .menu-grid {
      max-width: 900px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
    }

    .menu-card {
      display: block;
      text-decoration: none;
      background: #ffffff;
      border: 1px solid #dbe3ee;
      border-radius: 12px;
      padding: 1.25rem;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .menu-card h2 {
      margin: 0;
      font-size: 1.2rem;
      color: #1d4ed8;
    }

    .menu-card p {
      margin: 0.6rem 0 0;
      color: #374151;
      line-height: 1.4;
    }

    .menu-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
    }
  `,
})
export class InicioComponent {}
