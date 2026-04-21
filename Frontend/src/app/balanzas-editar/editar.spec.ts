import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BalanzasEditar } from './editar';

describe('BalanzasEditar', () => {
  let component: BalanzasEditar;
  let fixture: ComponentFixture<BalanzasEditar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BalanzasEditar],
    }).compileComponents();

    fixture = TestBed.createComponent(BalanzasEditar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
