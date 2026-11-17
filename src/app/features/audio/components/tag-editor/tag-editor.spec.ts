import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TagEditor } from './tag-editor';

describe('TagEditor', () => {
  let fixture: ComponentFixture<TagEditor>;
  let component: TagEditor;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TagEditor],
    }).compileComponents();
    fixture = TestBed.createComponent(TagEditor);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('suggestions', ['Live', 'Rock', 'José']);
    fixture.componentRef.setInput('tags', ['Rock']);
    fixture.detectChanges();
  });

  it('suggests unused tags and keeps the stored spelling', () => {
    const added: string[][] = [];
    component.tagsChange.subscribe((tags) => added.push(tags));
    component.draft.set('liv');
    expect(component.options().some((option) => option.kind === 'existing' && option.name === 'Live')).toBe(true);
    component.add('LIVE');
    expect(added).toEqual([['Rock', 'Live']]);
  });

  it('offers to create a tag that is not in the catalog', () => {
    component.draft.set('Directo');
    expect(component.options().some((option) => option.kind === 'create' && option.name === 'Directo')).toBe(true);
    const added: string[][] = [];
    component.tagsChange.subscribe((tags) => added.push(tags));
    component.add('Directo');
    expect(added[0]).toEqual(['Rock', 'Directo']);
  });

  it('does not add a case-insensitive duplicate', () => {
    const added: string[][] = [];
    component.tagsChange.subscribe((tags) => added.push(tags));
    component.add('rock');
    expect(added).toEqual([]);
  });
});
