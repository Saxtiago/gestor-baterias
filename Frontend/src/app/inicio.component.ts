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
      <a class="menu-card" routerLink="/modulos/balanzas">
        <h2>Gestión de balanzas</h2>
        <p>Registrar, consultar, editar y eliminar balanzas.</p>
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
      color: #f8fafc;
    }

    .view-header p {
      margin-top: 0.75rem;
      color: #94a3b8;
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
      background: #0f172a;
      border: 1px solid #2b3a52;
      border-radius: 12px;
      padding: 1.25rem;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .menu-card h2 {
      margin: 0;
      font-size: 1.2rem;
      color: #7dd3fc;
    }

    .menu-card p {
      margin: 0.6rem 0 0;
      color: #cbd5e1;
      line-height: 1.4;
    }

    .menu-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 14px 28px rgba(0, 0, 0, 0.35);
      border-color: #38bdf8;
    }
  `,
})
export class InicioComponent {}
