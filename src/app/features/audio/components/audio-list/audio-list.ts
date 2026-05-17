import { Component, input, output } from '@angular/core';
import { AudioDataModel } from '../../services/audio-service';

@Component({
  selector: 'app-audio-list',
  imports: [],
  templateUrl: './audio-list.html',
  styleUrl: './audio-list.scss',
})
export class AudioList {
  loadedMusicDatas = input<AudioDataModel[]>([])
  selected = output<AudioDataModel>()
  selectedId = input<number>(-1)
}
