import { Component, input, OnInit, output, signal } from '@angular/core';
import { TagEditor } from '../tag-editor/tag-editor';

@Component({
  selector: 'app-tags-dialog',
  imports: [TagEditor],
  templateUrl: './tags-dialog.html',
  styleUrl: './tags-dialog.scss',
})
export class TagsDialog implements OnInit {
  readonly title = input.required<string>();
  readonly subtitle = input('Sustituye el conjunto. Vacío las quita.');
  readonly tags = input<string[]>([]);
  readonly suggestions = input<string[]>([]);
  readonly busy = input(false);

  readonly saved = output<string[]>();
  readonly cancelled = output<void>();

  readonly current = signal<string[]>([]);

  ngOnInit(): void {
    this.current.set([...this.tags()]);
  }

  cancel(): void {
    if (this.busy()) {
      return;
    }
    this.cancelled.emit();
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancel();
    }
  }
}
