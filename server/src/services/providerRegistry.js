/**
 * Provider registry. Single source of truth for "which adapters exist and
 * are turned on right now". The rest of the system never imports a provider
 * directly — it asks the registry.
 *
 * Adding a new provider is one import + one entry below.
 */
import { TheOddsApiProvider }     from '../providers/theOddsApi.js';
import { ApiFootballProvider }    from '../providers/apiFootball.js';
import { SportMonksProvider }     from '../providers/sportMonks.js';
import { SharpApiProvider }       from '../providers/sharpApi.js';
import { SportsGameOddsProvider } from '../providers/sportsGameOdds.js';

const env = process.env;

const _providers = [
  new TheOddsApiProvider(env.ODDS_API_KEY || ''),
  new ApiFootballProvider(env.APIFOOTBALL_KEY || env.APIFOOTBALL_TOKEN || ''),
  new SportMonksProvider(env.SPORTMONKS_TOKEN || env.SPORTMONKS_KEY || ''),
  new SharpApiProvider(env.SHARPAPI_KEY || ''),
  new SportsGameOddsProvider(env.SPORTSGAMEODDS_KEY || ''),
];

export function listProviders() { return _providers; }
export function enabledProviders() { return _providers.filter((p) => p.enabled); }
export function getProvider(id) { return _providers.find((p) => p.id === id) || null; }
export function providersHealth() { return _providers.map((p) => p.health()); }
