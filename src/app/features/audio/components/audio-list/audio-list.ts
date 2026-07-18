import { Component, input, output } from '@angular/core';
import { AudioDataModel } from '../../services/audio-service';

@Component({
  selector: 'app-audio-list',
  imports: [],
  templateUrl: './audio-list.html',
  styleUrl: './audio-list.scss',
})
export class AudioList {
  loadedMusicDatas = input<AudioDataModel[]>([]);
  selectedId = input<number>(-1);
  loading = input(false);
  errorMessage = input('');
  selected = output<AudioDataModel>();
  delete = output<AudioDataModel>();

  public requestDelete(track: AudioDataModel, event: Event): void {
    event.stopPropagation();

    const confirmed = confirm(`¿Eliminar "${track.name}"?`);
    if (confirmed) {
      this.delete.emit(track);
    }
  }
}
