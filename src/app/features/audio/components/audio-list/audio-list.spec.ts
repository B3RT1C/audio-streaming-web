import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AudioList } from './audio-list';

describe('AudioList', () => {
  let component: AudioList;
  let fixture: ComponentFixture<AudioList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AudioList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AudioList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
