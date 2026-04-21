import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'modulos/baterias/listar',
    renderMode: RenderMode.Client
  },
  {
    path: 'modulos/balanzas/listar',
    renderMode: RenderMode.Client
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
