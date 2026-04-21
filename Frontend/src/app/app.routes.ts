import { Routes } from '@angular/router';
import { Agregar } from './agregar/agregar';
import { BalanzasAgregar } from './balanzas-agregar/agregar';
import { BalanzasEditar } from './balanzas-editar/editar';
import { BalanzasEliminar } from './balanzas-eliminar/eliminar';
import { BalanzasListar } from './balanzas-listar/listar';
import { BalanzasMenuComponent } from './balanzas-menu.component';
import { BateriasMenuComponent } from './baterias-menu.component';
import { Editar } from './editar/editar';
import { Eliminar } from './eliminar/eliminar';
import { InicioComponent } from './inicio.component';
import { Listar } from './listar/listar';

export const routes: Routes = [
	{ path: '', component: InicioComponent },
	{ path: 'modulos/baterias', component: BateriasMenuComponent },
	{ path: 'modulos/baterias/agregar', component: Agregar },
	{ path: 'modulos/baterias/listar', component: Listar },
	{ path: 'modulos/baterias/editar', component: Editar },
	{ path: 'modulos/baterias/eliminar', component: Eliminar },
	{ path: 'modulos/balanzas', component: BalanzasMenuComponent },
	{ path: 'modulos/balanzas/agregar', component: BalanzasAgregar },
	{ path: 'modulos/balanzas/listar', component: BalanzasListar },
	{ path: 'modulos/balanzas/editar', component: BalanzasEditar },
	{ path: 'modulos/balanzas/eliminar', component: BalanzasEliminar },
	{ path: '**', redirectTo: '' },
];
