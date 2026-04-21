import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BalanzasListar } from './listar';

describe('BalanzasListar', () => {
  let component: BalanzasListar;
  let fixture: ComponentFixture<BalanzasListar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BalanzasListar],
    }).compileComponents();

    fixture = TestBed.createComponent(BalanzasListar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
