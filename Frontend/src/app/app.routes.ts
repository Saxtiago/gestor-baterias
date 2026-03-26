import { Routes } from '@angular/router';
import { Agregar } from './agregar/agregar';
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
	{ path: '**', redirectTo: '' },
];
