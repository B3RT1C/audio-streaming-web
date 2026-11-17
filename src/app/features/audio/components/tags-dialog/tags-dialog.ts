import { Component, input, OnInit, output, signal } from '@angular/core';
import { TagSummary, TagType } from '../../models/catalog';
import { assignmentPayload, AssignedTag, namesToAssigned, TagWrite } from '../../utils/tag-assignment';
import { TypedTagEditor } from '../typed-tag-editor/typed-tag-editor';

@Component({
  selector: 'app-tags-dialog',
  imports: [TypedTagEditor],
  templateUrl: './tags-dialog.html',
  styleUrl: './tags-dialog.scss',
})
export class TagsDialog implements OnInit {
  readonly title = input.required<string>();
  readonly subtitle = input('Género, álbum y año se ven y no se cambian. El resto sustituye al conjunto.');
  readonly tags = input<string[]>([]);
  readonly assigned = input<AssignedTag[]>([]);
  readonly suggestions = input<string[]>([]);
  readonly catalog = input<TagSummary[]>([]);
  readonly types = input<TagType[]>([]);
  readonly busy = input(false);

  readonly saved = output<TagWrite[]>();
  readonly cancelled = output<void>();

  readonly current = signal<AssignedTag[]>([]);

  ngOnInit(): void {
    this.current.set(this.assigned().length ? [...this.assigned()] : namesToAssigned(this.tags()));
  }

  save(): void {
    this.saved.emit(assignmentPayload(this.current()));
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
