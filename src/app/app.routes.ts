import { Routes } from '@angular/router';
import { AudioPlayer } from './features/audio/pages/audio-player/audio-player';

export const routes: Routes = [
    {
        path: '',
        title: 'Audio Player',
        component: AudioPlayer
    }
];
