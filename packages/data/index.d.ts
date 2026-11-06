export type LocalisedText = { en: string; tc: string; sc: string };
export type Point = { latitude: number; longitude: number };
export type Location = Point & { accuracyMeters: number; timestamp: number };
export type Stop = Point & { id: string; name: LocalisedText };
export type NearbyStop = Stop & { distanceMeters: number };
export type Selection = {
  stopId: string; route: string; direction: 'O' | 'I'; serviceType: string; stopSequence: number;
};
export type RouteAtStop = Selection & { origin: LocalisedText; destination: LocalisedText };
export type Commute = Selection & { walkMinutes: number; bufferMinutes: number };
export type FavouriteInput = Commute & { label: string };
export type Favourite = FavouriteInput & { id: string };
export type EtaRow = {
  route: string; dir: string; service_type: number | string; seq: number | string;
  eta: string | null; data_timestamp?: string; co?: string; stop?: string; eta_seq?: number;
  dest_en?: string; dest_tc?: string; dest_sc?: string; rmk_en?: string; rmk_tc?: string; rmk_sc?: string;
};
export type EtaEnvelope = { generated_timestamp: string; data: EtaRow[] };
export type Departure = {
  eta: string; leaveAt: string; arrivalInSeconds: number; leaveInSeconds: number; catchable: boolean;
  scheduled: boolean; destination: LocalisedText; remark: LocalisedText; updatedAt: string;
};
export type AdviceStatus = 'wait' | 'leave-now' | 'too-late' | 'no-service' | 'stale';
export type Advice = {
  status: AdviceStatus; recommended: Departure | null; leaveInSeconds: number | null;
  departures: Departure[]; skippedCount: number; staleCount: number; generatedAt: string | null;
  updatedAt: string | null; evaluatedAt: string; remarks: LocalisedText[];
};
export type WatchState = Omit<Advice, 'status'> & {
  status: AdviceStatus | 'loading' | 'error'; refreshing: boolean; error?: { code: string; message: string };
};
export type RequestOptions = { signal?: AbortSignal };
export type KmbClient = {
  getStops(options?: RequestOptions): Promise<Stop[]>;
  getRoutesForStop(stopId: string, options?: RequestOptions): Promise<RouteAtStop[]>;
  getEta(selection: Selection, options?: RequestOptions): Promise<EtaEnvelope>;
  clearCache(): void;
};
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export type FavouriteStore = {
  load(): { status: 'ok' | 'corrupt' | 'unavailable'; favourites: Favourite[] };
  save(value: FavouriteInput): Favourite;
  remove(id: string): void;
};
export type NearbyOptions = RequestOptions & { point?: Point; radiusMeters?: number; limit?: number };
export type BusOClock = {
  client: KmbClient; favourites: FavouriteStore;
  getNearbyStops(options?: NearbyOptions): Promise<{ location: Point | Location; locationSource: 'device' | 'manual'; stops: NearbyStop[] }>;
  getRoutesForStop(stopId: string, options?: RequestOptions): Promise<RouteAtStop[]>;
  getCommute(selection: Commute, options?: RequestOptions & { now?: number }): Promise<Advice>;
  watchCommute(selection: Commute, onUpdate: (state: WatchState) => void): () => void;
};
export class DataError extends Error { code: string; constructor(code: string, message: string, cause?: unknown); }
export const KMB_BASE_URL: string;
export const DEFAULT_MAX_AGE_MS: number;
export const FAVOURITES_KEY: string;
export function calculateDeparture(envelope: EtaEnvelope, selection: Commute, options?: { now?: number; maxAgeMs?: number }): Advice;
export function distanceMeters(a: Point, b: Point): number;
export function nearbyStops(stops: Stop[], point: Point, options?: { radiusMeters?: number; limit?: number }): NearbyStop[];
export function getCurrentLocation(options?: { geolocation?: Geolocation | null; timeoutMs?: number }): Promise<Location>;
export type NativePosition = { coords: { latitude: number; longitude: number; accuracy: number }; timestamp: number };
export type NativePermission = { location: string; coarseLocation?: string };
export type NativeGeolocationPlugin = {
  checkPermissions(): Promise<NativePermission>;
  requestPermissions(options?: { permissions: ('location' | 'coarseLocation')[] }): Promise<NativePermission>;
  getCurrentPosition(options?: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number }): Promise<NativePosition>;
};
export function createCapacitorLocationProvider(plugin: NativeGeolocationPlugin): () => Promise<Location>;
export function createKmbClient(options?: { fetchImpl?: typeof fetch; timeoutMs?: number; catalogueTtlMs?: number; now?: () => number }): KmbClient;
export function createFavouriteStore(options?: { storage?: StorageLike | null }): FavouriteStore;
export function createBusOClock(options?: { client?: KmbClient; locationProvider?: () => Promise<Location>; favouriteStore?: FavouriteStore }): BusOClock;
export function watchCommute(options: { client: KmbClient; selection: Commute; onUpdate: (state: WatchState) => void; now?: () => number }): () => void;
