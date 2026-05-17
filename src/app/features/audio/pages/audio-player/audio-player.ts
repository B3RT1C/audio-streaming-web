import { Component, inject, ElementRef, ViewChild, AfterViewInit, signal } from '@angular/core';
import { AudioDataModel, AudioService } from '../../services/audio-service';

@Component({
  selector: 'app-audio-player',
  imports: [],
  templateUrl: './audio-player.html',
  styleUrl: './audio-player.scss',
})
export class AudioPlayer implements AfterViewInit {
  private audioService = inject(AudioService);

  @ViewChild('audioPlayer') audioPlayer!: ElementRef<HTMLAudioElement>;

  audioUrl: String = ''
  selectedFiles: FileList | undefined
  loadedMusicDatas = signal<AudioDataModel[]>([])

  ngAfterViewInit(): void {
    this.loadAudio();
  }

  private loadAudio(): void {
    this.audioService.getAudioFile(4).subscribe((arrayBuffer) => {
        const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        this.audioUrl = url
        this.audioPlayer.nativeElement.src = url;
        this.audioPlayer.nativeElement.load();
    });
  }

  public selectFile(event: Event) {
    const input = event.target as HTMLInputElement
    this.selectedFiles = input.files? input.files : this.selectedFiles

    if (this.selectedFiles) {
      for (const file of this.selectedFiles) {
        console.log("File selected:" + file.name)
      }
    }
  }

  public uploadAudio() {
    if (this.selectedFiles) {
      for (const file of this.selectedFiles) {
        this.audioService.postAudioFile(file).subscribe((response) => {
          console.log(response)
        })
      }
    } else {
      console.log("No file selected")
    }
  }

  public getAllAudioDatas() {
    this.audioService.getAllAudioDatas().subscribe({
      next: (response) => {
        console.log(response)
        this.loadedMusicDatas.set(response)
        console.log(this.loadedMusicDatas)
      },
      error: (err) => {
        console.error('Error: ', err)
      }
  })
  }
}