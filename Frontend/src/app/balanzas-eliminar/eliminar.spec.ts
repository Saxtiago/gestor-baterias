import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BalanzasEliminar } from './eliminar';

describe('BalanzasEliminar', () => {
  let component: BalanzasEliminar;
  let fixture: ComponentFixture<BalanzasEliminar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BalanzasEliminar],
    }).compileComponents();

    fixture = TestBed.createComponent(BalanzasEliminar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
