import { Component, input, output } from '@angular/core';
import { UploadDraft } from '../../models/upload-draft';

@Component({
  selector: 'app-upload-dialog',
  templateUrl: './upload-dialog.html',
  styleUrl: './upload-dialog.scss',
})
export class UploadDialog {
  readonly drafts = input.required<UploadDraft[]>();
  readonly busy = input(false);

  readonly confirmed = output<UploadDraft[]>();
  readonly cancelled = output<void>();

  onNameInput(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.drafts()[index].name = value;
  }

  canConfirm(): boolean {
    if (this.busy()) {
      return false;
    }

    return this.drafts().every((draft) => draft.name.trim().length > 0);
  }

  confirm(): void {
    if (!this.canConfirm()) {
      return;
    }

    const prepared = this.drafts().map((draft) => ({
      ...draft,
      name: draft.name.trim(),
    }));
    this.confirmed.emit(prepared);
  }

  cancel(): void {
    if (this.busy()) {
      return;
    }
    this.cancelled.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancel();
    }
  }
}
