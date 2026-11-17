import { Component, computed, input, output, signal } from '@angular/core';
import { TagSummary, TagType } from '../../models/catalog';
import { isDerivedType, SYSTEM_TYPE_ORDER, typeColor, typeLabel } from '../../utils/filter-tokens';
import { AssignedTag, isTagLocked, sameAssigned } from '../../utils/tag-assignment';

interface TagOption {
  kind: 'existing' | 'create';
  name: string;
}

interface TagGroup {
  type: string;
  label: string;
  color: string;
  locked: boolean;
  tags: AssignedTag[];
}

const MAX_TAGS = 100;
const MAX_LENGTH = 100;

@Component({
  selector: 'app-typed-tag-editor',
  templateUrl: './typed-tag-editor.html',
  styleUrl: './typed-tag-editor.scss',
})
export class TypedTagEditor {
  readonly tags = input<AssignedTag[]>([]);
  readonly types = input<TagType[]>([]);
  readonly catalog = input<TagSummary[]>([]);
  readonly suggestions = input<string[]>([]);

  readonly tagsChange = output<AssignedTag[]>();

  readonly draft = signal('');
  readonly editingType = signal('');
  readonly open = signal(false);
  readonly active = signal(0);
  readonly notice = signal('');

  readonly groups = computed(() => this.buildGroups());
  readonly options = computed(() => this.buildOptions());

  locked(tag: AssignedTag): boolean {
    return isTagLocked(tag);
  }

  addPlaceholder(group: TagGroup): string {
    if (group.type === 'free') {
      return 'Añadir etiqueta';
    }
    return `Añadir ${group.label.toLocaleLowerCase()}`;
  }

  onDraft(type: string, event: Event): void {
    if (this.groupLocked(type)) {
      return;
    }
    this.editingType.set(type);
    this.draft.set((event.target as HTMLInputElement).value);
    this.active.set(0);
    this.notice.set('');
    this.open.set(true);
  }

  onFocus(type: string): void {
    if (this.groupLocked(type)) {
      return;
    }
    this.editingType.set(type);
    this.open.set(true);
  }

  closeSoon(): void {
    window.setTimeout(() => this.open.set(false), 150);
  }

  onKey(type: string, event: KeyboardEvent): void {
    if (this.groupLocked(type)) {
      event.preventDefault();
      return;
    }
    const options = this.editingType() === type ? this.options() : [];
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
      this.add(type, option?.name ?? this.draft());
    }
  }

  add(type: string, name: string): void {
    if (this.groupLocked(type)) {
      return;
    }
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
    const stored = this.pool(type).find((suggestion) => suggestion.toLocaleLowerCase() === clean.toLocaleLowerCase()) ?? clean;
    const next: AssignedTag = { name: stored, type, readOnly: false };
    if (this.tags().some((tag) => sameAssigned(tag, next))) {
      this.draft.set('');
      this.open.set(false);
      return;
    }
    this.tagsChange.emit([...this.tags(), next]);
    this.draft.set('');
    this.active.set(0);
    this.notice.set('');
    this.open.set(false);
  }

  remove(tag: AssignedTag): void {
    if (isTagLocked(tag)) {
      return;
    }
    this.tagsChange.emit(this.tags().filter((item) => !sameAssigned(item, tag)));
  }

  private groupLocked(type: string): boolean {
    return isDerivedType(type) || type === 'artist';
  }

  private buildGroups(): TagGroup[] {
    const tags = this.tags();
    const types = this.types();
    const keys = new Set<string>(['language', 'free']);
    for (const tag of tags) {
      keys.add(tag.type || 'free');
    }
    for (const type of types) {
      if (!this.groupLocked(type.key)) {
        keys.add(type.key);
      }
    }
    return [...keys]
      .sort((left, right) => this.rank(left) - this.rank(right) || left.localeCompare(right))
      .map((type) => {
        const groupTags = tags.filter((tag) => (tag.type || 'free') === type);
        const locked = this.groupLocked(type);
        if (locked && groupTags.length === 0) {
          return null;
        }
        return {
          type,
          label: typeLabel(type, types),
          color: typeColor(type, types),
          locked,
          tags: groupTags,
        };
      })
      .filter((group): group is TagGroup => group != null);
  }

  private buildOptions(): TagOption[] {
    const type = this.editingType();
    if (!type || this.groupLocked(type)) {
      return [];
    }
    const typed = this.draft().trim().replace(/\s+/g, ' ');
    const query = typed.toLocaleLowerCase();
    const selected = this.tags().filter((tag) => tag.type === type);
    const pool = this.pool(type).filter((name) => !selected.some((tag) => tag.name.toLocaleLowerCase() === name.toLocaleLowerCase()));
    const matches = (query ? pool.filter((name) => name.toLocaleLowerCase().includes(query)) : pool).slice(0, 8);
    const exact = pool.some((name) => name.toLocaleLowerCase() === query);
    const already = selected.some((tag) => tag.name.toLocaleLowerCase() === query);
    const options: TagOption[] = matches.map((name) => ({ kind: 'existing', name }));
    if (typed && !exact && !already && typed.length <= MAX_LENGTH && type !== 'artist') {
      options.push({ kind: 'create', name: typed });
    }
    return options.slice(0, 8);
  }

  private pool(type: string): string[] {
    const names = this.catalog()
      .filter((tag) => tag.type === type && !tag.readOnly)
      .map((tag) => tag.name);
    if (type === 'free') {
      names.push(...this.suggestions());
    }
    const seen = new Set<string>();
    const result: string[] = [];
    for (const name of names) {
      const clean = name.trim().replace(/\s+/g, ' ');
      const key = clean.toLocaleLowerCase();
      if (!clean || seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push(clean);
    }
    return result;
  }

  private rank(type: string): number {
    const order = [...SYSTEM_TYPE_ORDER];
    const index = order.indexOf(type as (typeof SYSTEM_TYPE_ORDER)[number]);
    return index === -1 ? order.length + 1 : index;
  }
}
