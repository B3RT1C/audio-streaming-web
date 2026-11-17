import { TestBed } from '@angular/core/testing';
import { Track } from '../models/track';
import { PlayerService } from './player.service';

describe('PlayerService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  const tracks: Track[] = [
    {
      id: 1,
      name: 'uno.mp3',
      path: '',
      extension: 'mp3',
      title: 'Uno',
      secondaryTitle: null,
      artist: 'A',
      album: 'B',
      durationSeconds: 30,
      trackNumber: 1,
      tags: [],
    },
    {
      id: 2,
      name: 'dos.mp3',
      path: '',
      extension: 'mp3',
      title: 'Dos',
      secondaryTitle: 'Two',
      artist: 'A',
      album: 'B',
      durationSeconds: 40,
      trackNumber: 2,
      tags: ['Live'],
    },
  ];

  function fakeAudio() {
    return {
      src: '',
      currentTime: 0,
      duration: 30,
      paused: true,
      playbackRate: 1,
      play: vi.fn(() => Promise.resolve()),
      pause: vi.fn(),
      load: vi.fn(),
      removeAttribute: vi.fn(),
      getAttribute: vi.fn(() => null),
      addEventListener: vi.fn(),
    };
  }

  it('loads the chosen track and moves to the next one', () => {
    const service = TestBed.inject(PlayerService);
    const audio = fakeAudio();
    service.bind(audio as unknown as HTMLAudioElement);

    service.playTracks(tracks, 1);
    expect(audio.src).toContain('/audios/1');
    expect(audio.play).toHaveBeenCalled();

    service.next();
    expect(service.current()?.id).toBe(2);
    expect(audio.src).toContain('/audios/2');
  });

  it('toggles shuffle and repeat and seeks', () => {
    const service = TestBed.inject(PlayerService);
    const audio = fakeAudio();
    service.bind(audio as unknown as HTMLAudioElement);
    service.playTracks(tracks, 1);

    service.toggleShuffle();
    expect(service.shuffle()).toBe(true);
    service.cycleRepeat();
    expect(service.repeat()).toBe('all');
    service.seek(12);
    expect(audio.currentTime).toBe(12);
    expect(service.currentTime()).toBe(12);
  });

  it('plays the queue in shuffle mode without repeating until it ends', () => {
    const service = TestBed.inject(PlayerService);
    const audio = fakeAudio();
    service.bind(audio as unknown as HTMLAudioElement);
    const queue = [1, 2, 3, 4].map((id) => ({ ...tracks[0], id, name: `${id}.mp3` }));

    service.playShuffled(queue, 11);
    expect(service.shuffle()).toBe(true);
    expect(service.shuffleLabel()).toContain('Aleatorio');

    const seen = new Set<number>();
    for (let step = 0; step < queue.length; step += 1) {
      const id = service.current()?.id ?? 0;
      expect(seen.has(id)).toBe(false);
      seen.add(id);
      if (step < queue.length - 1) {
        service.next();
      }
    }
    expect(seen.size).toBe(queue.length);
    service.next();
    expect(audio.pause).toHaveBeenCalled();

    service.cycleRepeat();
    expect(service.repeat()).toBe('all');
    expect(service.shuffle()).toBe(true);
    service.cycleRepeat();
    expect(service.repeat()).toBe('one');
    expect(service.shuffle()).toBe(true);
  });

  it('drops a removed track from the queue', () => {
    const service = TestBed.inject(PlayerService);
    service.playTracks(tracks, 1);
    service.removeTrack(1);
    expect(service.queue().map((track) => track.id)).toEqual([2]);
    expect(service.current()?.id).toBe(2);
  });
});
