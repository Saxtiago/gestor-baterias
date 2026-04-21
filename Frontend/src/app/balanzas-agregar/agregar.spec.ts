import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BalanzasAgregar } from './agregar';

describe('BalanzasAgregar', () => {
  let component: BalanzasAgregar;
  let fixture: ComponentFixture<BalanzasAgregar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BalanzasAgregar],
    }).compileComponents();

    fixture = TestBed.createComponent(BalanzasAgregar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
