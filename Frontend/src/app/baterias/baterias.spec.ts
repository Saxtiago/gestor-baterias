import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Baterias } from './baterias';

describe('Baterias', () => {
  let component: Baterias;
  let fixture: ComponentFixture<Baterias>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Baterias],
    }).compileComponents();

    fixture = TestBed.createComponent(Baterias);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
