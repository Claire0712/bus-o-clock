import { validatePoint } from './packages/data/src/validation.js';

// Send only the selected public stop. Google Maps obtains or asks for the origin.
export function walkingDirectionsUrl(point) {
  validatePoint(point);
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('destination', `${point.latitude},${point.longitude}`);
  url.searchParams.set('travelmode', 'walking');
  url.searchParams.set('dir_action', 'navigate');
  return url.href;
}
