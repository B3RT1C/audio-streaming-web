import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RuntimeConfigService } from '../../../core/runtime-config.service';
import {
  normalizeStatsRanks,
  normalizeStatsSummary,
  normalizeStatsTimeline,
  StatsBucket,
  StatsKind,
  StatsRank,
  StatsSummary,
} from '../models/stats';
import { API_PATHS } from '../models/track';
import { StatsGranularity, StatsRange } from '../utils/stats-range';

@Injectable({
  providedIn: 'root',
})
export class StatsService {
  private http = inject(HttpClient);
  private config = inject(RuntimeConfigService);

  summary(range: StatsRange): Observable<StatsSummary> {
    return this.http.get<unknown>(this.url('/summary'), { params: rangeParams(range) }).pipe(
      map((body) => {
        const summary = normalizeStatsSummary(body);
        if (!summary) {
          throw new Error('Respuesta de resumen no válida');
        }
        return summary;
      }),
    );
  }

  top(kind: StatsKind, range: StatsRange, limit: number, tagType?: string): Observable<StatsRank[]> {
    return this.http
      .get<unknown>(this.url('/top'), { params: rangeParams(range, { kind, limit, tagType }) })
      .pipe(
        map((body) => {
          const ranks = normalizeStatsRanks(body);
          if (!ranks) {
            throw new Error('Respuesta de ranking no válida');
          }
          return tagType ? ranks.map((rank) => ({ ...rank, tagType })) : ranks;
        }),
      );
  }

  timeline(granularity: StatsGranularity, range: StatsRange): Observable<StatsBucket[]> {
    return this.http.get<unknown>(this.url('/timeline'), { params: rangeParams(range, { granularity }) }).pipe(
      map((body) => {
        const buckets = normalizeStatsTimeline(body);
        if (!buckets) {
          throw new Error('Respuesta de la línea temporal no válida');
        }
        return buckets;
      }),
    );
  }

  private url(suffix: string): string {
    return this.config.url(`${API_PATHS.stats}${suffix}`);
  }
}

function rangeParams(
  range: StatsRange,
  extra: { kind?: string; limit?: number; tagType?: string; granularity?: string } = {},
): HttpParams {
  let params = new HttpParams();
  if (range.from) {
    params = params.set('from', range.from);
  }
  if (range.to) {
    params = params.set('to', range.to);
  }
  if (extra.kind) {
    params = params.set('kind', extra.kind);
  }
  if (extra.limit != null) {
    params = params.set('limit', String(extra.limit));
  }
  if (extra.tagType) {
    params = params.set('tagType', extra.tagType);
  }
  if (extra.granularity) {
    params = params.set('granularity', extra.granularity);
  }
  return params;
}
