import { Component, computed, input, output, signal } from '@angular/core';
import { TagSummary, TagType } from '../../models/catalog';
import { foldAccents, SYSTEM_TYPE_ORDER, typeColor } from '../../utils/filter-tokens';

interface TypeBlock {
  type: TagType;
  tags: TagSummary[];
}

interface ShownBlock extends TypeBlock {
  open: boolean;
  matchCount: number;
  visible: TagSummary[];
  hidden: number;
}

/** Groups larger than this start closed so a few thousand tags are not painted at once. */
const COLLAPSE_AFTER = 12;
const PAGE = 24;

@Component({
  selector: 'app-tag-types-view',
  templateUrl: './tag-types-view.html',
  styleUrl: './tag-types-view.scss',
})
export class TagTypesView {
  readonly types = input<TagType[]>([]);
  readonly tags = input<TagSummary[]>([]);
  readonly busy = input(false);
  readonly error = input('');

  readonly openTag = output<TagSummary>();
  readonly createType = output<{ name: string; key: string; color: string }>();
  readonly renameType = output<{ type: TagType; name: string }>();
  readonly deleteType = output<TagType>();

  readonly name = signal('');
  readonly key = signal('');
  readonly color = signal('#f9a8d4');
  readonly renamingId = signal<number | null>(null);
  readonly renameValue = signal('');
  readonly formError = signal('');
  readonly query = signal('');
  readonly menuId = signal<number | null>(null);
  readonly expanded = signal<Readonly<Record<string, boolean>>>({});
  readonly limits = signal<Readonly<Record<string, number>>>({});

  readonly systemBlocks = computed(() => this.blocks(true));
  readonly customBlocks = computed(() => this.blocks(false));
  readonly systemShown = computed(() => this.present(this.systemBlocks()));
  readonly customShown = computed(() => this.present(this.customBlocks()));
  readonly nothingMatches = computed(
    () => this.query().trim().length > 0 && this.systemShown().length === 0 && this.customShown().length === 0,
  );

  tone(type: TagType): string {
    return typeColor(type.key, [type]);
  }

  etiquetaCount(count: number): string {
    return count === 1 ? '1 etiqueta' : `${groupedCount(count)} etiquetas`;
  }

  formatCount(count: number): string {
    return groupedCount(count);
  }

  canFold(count: number): boolean {
    return count > COLLAPSE_AFTER;
  }

  onName(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.name.set(value);
    if (!this.keyEdited) {
      this.key.set(slug(value));
    }
  }

  onKey(event: Event): void {
    this.keyEdited = true;
    this.key.set((event.target as HTMLInputElement).value);
  }

  onColor(event: Event): void {
    this.color.set((event.target as HTMLInputElement).value);
  }

  onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  create(event: Event): void {
    event.preventDefault();
    const name = this.name().trim().replace(/\s+/g, ' ');
    const key = slug(this.key() || name);
    if (!name || !key) {
      this.formError.set('El tipo necesita un nombre.');
      return;
    }
    this.formError.set('');
    this.createType.emit({ name, key, color: this.color() });
    this.name.set('');
    this.key.set('');
    this.keyEdited = false;
  }

  startRename(type: TagType): void {
    this.menuId.set(null);
    if (type.system) {
      return;
    }
    this.renamingId.set(type.id);
    this.renameValue.set(type.name);
  }

  onRename(event: Event): void {
    this.renameValue.set((event.target as HTMLInputElement).value);
  }

  commitRename(type: TagType, event: Event): void {
    event.preventDefault();
    if (type.system) {
      return;
    }
    const name = this.renameValue().trim().replace(/\s+/g, ' ');
    if (!name || name === type.name) {
      this.renamingId.set(null);
      return;
    }
    this.renameType.emit({ type, name });
    this.renamingId.set(null);
  }

  remove(type: TagType): void {
    this.menuId.set(null);
    if (type.system || this.busy()) {
      return;
    }
    if (!confirm(`¿Eliminar el tipo «${type.name}»?`)) {
      return;
    }
    this.deleteType.emit(type);
  }

  toggleMenu(id: number): void {
    this.menuId.update((current) => (current === id ? null : id));
  }

  toggleGroup(type: TagType, total: number): void {
    const open = this.expanded()[type.key] ?? total <= COLLAPSE_AFTER;
    this.expanded.update((current) => ({ ...current, [type.key]: !open }));
  }

  showMore(key: string): void {
    this.limits.update((current) => ({ ...current, [key]: (current[key] ?? PAGE) + PAGE }));
  }

  private keyEdited = false;

  private present(blocks: TypeBlock[]): ShownBlock[] {
    const query = this.query().trim().toLocaleLowerCase();
    const expanded = this.expanded();
    const limits = this.limits();
    const shown: ShownBlock[] = [];
    for (const block of blocks) {
      const matched = query
        ? block.tags.filter((tag) => tag.name.toLocaleLowerCase().includes(query))
        : block.tags;
      if (query && matched.length === 0) {
        continue;
      }
      const open = query ? true : (expanded[block.type.key] ?? block.tags.length <= COLLAPSE_AFTER);
      const limit = limits[block.type.key] ?? PAGE;
      const visible = open ? matched.slice(0, limit) : [];
      shown.push({
        ...block,
        open,
        matchCount: matched.length,
        visible,
        hidden: Math.max(0, matched.length - visible.length),
      });
    }
    return shown;
  }

  private blocks(system: boolean): TypeBlock[] {
    const tags = this.tags();
    return this.types()
      .filter((type) => type.system === system)
      .sort((left, right) => this.rank(left) - this.rank(right) || left.name.localeCompare(right.name))
      .map((type) => ({
        type,
        tags: tags
          .filter((tag) => tag.type === type.key)
          .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })),
      }));
  }

  private rank(type: TagType): number {
    const index = SYSTEM_TYPE_ORDER.indexOf(type.key as (typeof SYSTEM_TYPE_ORDER)[number]);
    return index === -1 ? SYSTEM_TYPE_ORDER.length : index;
  }
}

function groupedCount(count: number): string {
  return String(Math.max(0, Math.trunc(count))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function slug(value: string): string {
  return foldAccents(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}
