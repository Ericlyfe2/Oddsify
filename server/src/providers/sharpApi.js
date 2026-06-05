/**
 * Sharp(er)API — real-time odds streaming + arbitrage signals.
 * Activate with SHARPAPI_KEY. Endpoint and response shapes follow their
 * public preview; concrete adapter normalises whatever they return into the
 * unified shape so the rest of the system doesn't care.
 */
import { Provider, fixtureKey } from './base.js';

export class SharpApiProvider extends Provider {
  constructor(apiKey, base = 'https://api.sharpapi.com/v1') {
    super({
      id: 'sharpApi',
      label: 'SharpAPI',
      enabled: !!apiKey,
      sports: ['football', 'basketball'],
    });
    this.apiKey = apiKey;
    this.base = base;
  }

  async fetchOdds(sport = 'football') {
    if (!this.enabled) return [];
    const url = `${this.base}/odds?sport=${sport}`;
    const json = await this.http(url, { headers: { Authorization: `Bearer ${this.apiKey}` } });
    return (json?.events || []).map((ev) => normalise(ev, sport, this.id));
  }
}

function normalise(ev, sport, providerId) {
  const home = ev.homeTeam || ev.home;
  const away = ev.awayTeam || ev.away;
  const kickoff = ev.kickoff || ev.startTime;
  const markets = {};
  for (const m of ev.markets || []) {
    const mk = m.key || m.type;
    markets[mk] = {
      name: m.name || mk,
      selections: (m.outcomes || []).map((o) => ({
        key: o.key || o.code,
        label: o.label || o.name,
        odds: Number(o.price),
      })),
    };
  }
  return {
    key: fixtureKey(sport, home, away, kickoff),
    provider: providerId,
    sourceId: String(ev.id),
    sport,
    league: { id: ev.league?.id, name: ev.league?.name },
    home,
    away,
    kickoff,
    status: ev.status || 'upcoming',
    markets,
    arbitrage: typeof ev.arbitrage === 'number' ? ev.arbitrage : null,
    updatedAt: new Date().toISOString(),
  };
}
