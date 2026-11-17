import { Component, computed, input, output, signal } from '@angular/core';
import { TagSummary, TagType } from '../../models/catalog';
import { foldAccents, SYSTEM_TYPE_ORDER, typeColor } from '../../utils/filter-tokens';

interface TypeBlock {
  type: TagType;
  tags: TagSummary[];
}

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

  readonly systemBlocks = computed(() => this.blocks(true));
  readonly customBlocks = computed(() => this.blocks(false));

  tone(type: TagType): string {
    return typeColor(type.key, [type]);
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
    if (type.system || this.busy()) {
      return;
    }
    if (!confirm(`¿Eliminar el tipo «${type.name}»?`)) {
      return;
    }
    this.deleteType.emit(type);
  }

  private keyEdited = false;

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

function slug(value: string): string {
  return foldAccents(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}
