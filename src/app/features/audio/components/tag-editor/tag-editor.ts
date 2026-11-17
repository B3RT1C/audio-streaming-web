import { Component, computed, effect, ElementRef, inject, input, output, signal } from '@angular/core';
import { sameTag } from '../../models/tags';

interface TagOption {
  kind: 'existing' | 'create';
  name: string;
}

const MAX_TAGS = 100;
const MAX_LENGTH = 100;

@Component({
  selector: 'app-tag-editor',
  templateUrl: './tag-editor.html',
  styleUrl: './tag-editor.scss',
})
export class TagEditor {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly tags = input<string[]>([]);
  readonly suggestions = input<string[]>([]);

  readonly tagsChange = output<string[]>();

  readonly draft = signal('');
  readonly open = signal(false);
  readonly active = signal(0);
  readonly notice = signal('');

  readonly options = computed<TagOption[]>(() => {
    const typed = this.draft().trim().replace(/\s+/g, ' ');
    const query = typed.toLocaleLowerCase();
    const selected = this.tags();
    const pool = this.suggestions().filter((name) => !selected.some((tag) => sameTag(tag, name)));
    const matches = (query ? pool.filter((name) => name.toLocaleLowerCase().includes(query)) : pool).slice(0, 8);
    const exact = pool.some((name) => name.toLocaleLowerCase() === query);
    const already = selected.some((tag) => sameTag(tag, typed));
    const options: TagOption[] = matches.map((name) => ({ kind: 'existing', name }));
    if (typed && !exact && !already && typed.length <= MAX_LENGTH) {
      options.push({ kind: 'create', name: typed });
    }
    return options.slice(0, 8);
  });

  private closeTimer = 0;

  constructor() {
    effect(() => {
      if (!this.open() || this.options().length === 0) {
        return;
      }
      setTimeout(() => {
        this.host.nativeElement.querySelector('.suggest')?.scrollIntoView({ block: 'nearest' });
      });
    });
  }

  onDraft(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
    this.active.set(0);
    this.notice.set('');
    this.open.set(true);
  }

  onKey(event: KeyboardEvent): void {
    const options = this.options();
    if (event.key === 'ArrowDown' && options.length) {
      event.preventDefault();
      this.open.set(true);
      this.active.update((index) => (index + 1) % options.length);
      return;
    }
    if (event.key === 'ArrowUp' && options.length) {
      event.preventDefault();
      this.open.set(true);
      this.active.update((index) => (index - 1 + options.length) % options.length);
      return;
    }
    if (event.key === 'Escape') {
      this.open.set(false);
      return;
    }
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      const option = options[this.active()] ?? options[0];
      if (option) {
        this.add(option.name);
      } else {
        this.add(this.draft());
      }
    }
  }

  add(name: string): void {
    window.clearTimeout(this.closeTimer);
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!clean) {
      return;
    }
    if (clean.length > MAX_LENGTH) {
      this.notice.set('Una etiqueta puede tener como mucho 100 caracteres.');
      return;
    }
    if (this.tags().length >= MAX_TAGS) {
      this.notice.set('Como mucho 100 etiquetas.');
      return;
    }
    const stored = this.suggestions().find((suggestion) => sameTag(suggestion, clean)) ?? clean;
    if (this.tags().some((tag) => sameTag(tag, stored))) {
      this.draft.set('');
      this.open.set(false);
      return;
    }
    this.tagsChange.emit([...this.tags(), stored]);
    this.draft.set('');
    this.active.set(0);
    this.notice.set('');
    this.open.set(false);
  }

  remove(name: string): void {
    this.tagsChange.emit(this.tags().filter((tag) => !sameTag(tag, name)));
  }

  closeSoon(): void {
    window.clearTimeout(this.closeTimer);
    this.closeTimer = window.setTimeout(() => this.open.set(false), 150);
  }
}
