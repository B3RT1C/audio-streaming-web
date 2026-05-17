import { Component, inject, ElementRef, ViewChild, AfterViewInit, signal, WritableSignal } from '@angular/core';
import { AudioDataModel, AudioService } from '../../services/audio-service';
import { AudioList } from "../../components/audio-list/audio-list";

@Component({
  selector: 'app-audio-player',
  imports: [AudioList],
  templateUrl: './audio-player.html',
  styleUrl: './audio-player.scss',
})
export class AudioPlayer implements AfterViewInit {
  private audioService = inject(AudioService);

  @ViewChild('audioPlayer') audioPlayer!: ElementRef<HTMLAudioElement>;

  audioUrl: string = ''
  selectedFiles: FileList | undefined
  loadedMusicDatas = signal<AudioDataModel[]>([])
  playingId = signal<number>(-1)

  ngAfterViewInit(): void {
    //this.loadAudio();
  }

  public loadAudio(toPlayId: number): void {
    this.audioService.getAudioFile(toPlayId).subscribe((arrayBuffer) => {
        const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        this.audioUrl = url
        this.audioPlayer.nativeElement.src = url;
        this.audioPlayer.nativeElement.load();
        this.playingId.set(toPlayId);
    });
  }

  public nextAudio(): void {
    if (this.playingId() === this.loadedMusicDatas().length) {
      this.loadAudio(1);
      return;
    }

    this.loadAudio(this.playingId()+1)
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
        console.log(this.loadedMusicDatas())
      },
      error: (err) => {
        console.error('Error: ', err)
      }
  })
  }
}