import { Component, computed, effect, ElementRef, inject, input, output, signal } from '@angular/core';
import { FilterSuggestion, TagType } from '../../models/catalog';
import {
  FilterToken,
  inspectDraft,
  matchingPrefixes,
  parseFilterToken,
  serializeFilterToken,
  typeColor,
  typeLabel,
  uniqueTokens,
} from '../../utils/filter-tokens';
import { SEARCH_DEBOUNCE_MS } from '../../utils/search-query';

interface SuggestRow {
  kind: 'prefix' | 'value';
  type: string;
  label: string;
  value: string;
  count: number;
  insert: string;
}

interface SuggestGroup {
  type: string;
  label: string;
  color: string;
  rows: { row: SuggestRow; index: number }[];
}

@Component({
  selector: 'app-facet-search',
  templateUrl: './facet-search.html',
  styleUrl: './facet-search.scss',
})
export class FacetSearch {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly query = input('');
  readonly tokens = input<FilterToken[]>([]);
  readonly suggestions = input<FilterSuggestion[]>([]);
  readonly types = input<TagType[]>([]);
  readonly placeholder = input('Buscar o filtrar: género:, año:, #etiqueta');

  readonly queryChange = output<string>();
  readonly committed = output<{ q: string; tokens: FilterToken[] }>();
  readonly suggest = output<{ prefix: string; q: string }>();

  readonly draft = signal('');
  readonly open = signal(false);
  readonly active = signal(0);
  private readonly focused = signal(false);
  private suggestTimer = 0;
  private closeTimer = 0;

  readonly rows = computed(() => this.buildRows());
  readonly groups = computed(() => this.buildGroups(this.rows()));

  constructor() {
    effect(() => {
      const query = this.query();
      if (!this.focused()) {
        this.draft.set(query);
      }
    });
  }

  tokenKey(token: FilterToken): string {
    return serializeFilterToken(token);
  }

  chipKind(token: FilterToken): string {
    return typeLabel(token.type, this.types());
  }

  chipColor(type: string): string {
    return typeColor(type, this.types());
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.draft.set(value);
    this.active.set(0);
    this.open.set(true);
    const parts = inspectDraft(value);
    this.queryChange.emit(parts.kind === 'text' ? value : '');
    this.scheduleSuggest(parts.prefix, parts.q);
  }

  onFocus(): void {
    window.clearTimeout(this.closeTimer);
    this.focused.set(true);
    this.open.set(true);
    const parts = inspectDraft(this.draft());
    this.scheduleSuggest(parts.prefix, parts.q);
  }

  onBlur(): void {
    this.focused.set(false);
    window.clearTimeout(this.closeTimer);
    this.closeTimer = window.setTimeout(() => this.open.set(false), 160);
  }

  onKey(event: KeyboardEvent): void {
    const rows = this.rows();
    if (event.key === 'ArrowDown' && rows.length) {
      event.preventDefault();
      this.open.set(true);
      this.active.update((index) => (index + 1) % rows.length);
      return;
    }
    if (event.key === 'ArrowUp' && rows.length) {
      event.preventDefault();
      this.open.set(true);
      this.active.update((index) => (index - 1 + rows.length) % rows.length);
      return;
    }
    if (event.key === 'Escape') {
      this.open.set(false);
      return;
    }
    if (event.key === 'Backspace' && !this.draft() && this.tokens().length) {
      event.preventDefault();
      this.remove(this.tokens()[this.tokens().length - 1]);
      return;
    }
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    const row = this.open() ? rows[this.active()] : undefined;
    if (row?.kind === 'prefix') {
      this.insertPrefix(row.insert);
      return;
    }
    if (row?.kind === 'value') {
      this.commit({ type: row.type, value: row.value });
      return;
    }
    const token = parseFilterToken(this.draft(), this.types().map((type) => type.key));
    if (token) {
      this.commit(token);
    }
  }

  pick(row: SuggestRow): void {
    window.clearTimeout(this.closeTimer);
    if (row.kind === 'prefix') {
      this.insertPrefix(row.insert);
      return;
    }
    this.commit({ type: row.type, value: row.value });
  }

  remove(token: FilterToken): void {
    const next = this.tokens().filter((item) => serializeFilterToken(item) !== serializeFilterToken(token));
    this.committed.emit({ q: this.query(), tokens: next });
  }

  private insertPrefix(prefix: string): void {
    const next = prefix === '#' ? '#' : `${prefix}:`;
    this.draft.set(next);
    this.active.set(0);
    this.open.set(true);
    this.queryChange.emit('');
    this.scheduleSuggest(prefix === '#' ? '#' : prefix, '');
    queueMicrotask(() => this.host.nativeElement.querySelector('input')?.focus());
  }

  private commit(token: FilterToken): void {
    window.clearTimeout(this.closeTimer);
    const next = uniqueTokens([...this.tokens(), token]);
    this.draft.set('');
    this.open.set(false);
    this.active.set(0);
    this.queryChange.emit('');
    this.committed.emit({ q: '', tokens: next });
  }

  private scheduleSuggest(prefix: string, q: string): void {
    window.clearTimeout(this.suggestTimer);
    this.suggestTimer = window.setTimeout(() => this.suggest.emit({ prefix, q }), SEARCH_DEBOUNCE_MS);
  }

  private buildRows(): SuggestRow[] {
    const keys = this.types();
    const prefixes = matchingPrefixes(this.draft(), keys).map((item) => ({
      kind: 'prefix' as const,
      type: item.type,
      label: item.label,
      value: '',
      count: 0,
      insert: item.prefix,
    }));
    const taken = new Set(this.tokens().map((token) => `${token.type}\u0000${token.value.toLocaleLowerCase()}`));
    const values = this.suggestions()
      .filter((item) => item.value.trim() && !taken.has(`${item.type}\u0000${item.value.toLocaleLowerCase()}`))
      .slice(0, 12)
      .map((item) => ({
        kind: 'value' as const,
        type: item.type,
        label: typeLabel(item.type, keys),
        value: item.value,
        count: item.count,
        insert: '',
      }));
    return [...prefixes, ...values].slice(0, 16);
  }

  private buildGroups(rows: SuggestRow[]): SuggestGroup[] {
    const groups: SuggestGroup[] = [];
    rows.forEach((row, index) => {
      const type = row.kind === 'prefix' ? 'prefix' : row.type;
      let group = groups.find((item) => item.type === type);
      if (!group) {
        group = {
          type,
          label: type === 'prefix' ? 'Prefijos' : typeLabel(type, this.types()),
          color: type === 'prefix' ? '#a1a1aa' : typeColor(type, this.types()),
          rows: [],
        };
        groups.push(group);
      }
      group.rows.push({ row, index });
    });
    return groups;
  }
}
