/**
 * Standard brass band instrument names
 * Organized by section for reference
 */

export const BRASS_BAND_INSTRUMENTS = [
  // Cornets
  'Soprano Cornet',
  'Soprano Cornet in Eb',
  'Soprano Cornet in E♭',
  'Solo Cornet',
  'Solo Cornet 1',
  'Solo Cornet I',
  'Solo Cornet 2',
  'Solo Cornet II',
  'Solo Cornet 3',
  'Solo Cornet III',
  'Solo Cornet 4',
  'Solo Cornet IV',
  'Repiano Cornet',
  'Repiano',
  '2nd Cornet',
  'Second Cornet',
  '3rd Cornet',
  'Third Cornet',
  'Flugel',
  'Flugelhorn',
  'Flugel Horn',

  // Horns
  'Solo Horn',
  'Solo Tenor Horn',
  'Tenor Horn',
  '1st Horn',
  'First Horn',
  '2nd Horn',
  'Second Horn',
  '3rd Horn',
  'Third Horn',
  '1st Tenor Horn',
  '2nd Tenor Horn',

  // Baritones
  'Baritone',
  '1st Baritone',
  'First Baritone',
  '2nd Baritone',
  'Second Baritone',

  // Trombones
  '1st Trombone',
  'First Trombone',
  '2nd Trombone',
  'Second Trombone',
  'Bass Trombone',

  // Euphoniums
  'Euphonium',
  'Solo Euphonium',
  '1st Euphonium',
  'First Euphonium',
  '2nd Euphonium',
  'Second Euphonium',

  // Basses
  'Eb Bass',
  'E♭ Bass',
  'Eb Tuba',
  'E♭ Tuba',
  'BBb Bass',
  'BB♭ Bass',
  'BBb Tuba',
  'BB♭ Tuba',
  'Tuba',
  '1st Eb Bass',
  '2nd Eb Bass',
  '1st BBb Bass',
  '2nd BBb Bass',

  // Percussion
  'Percussion',
  'Percussion 1',
  'Percussion 2',
  'Percussion I',
  'Percussion II',
  'Timpani',
  'Drums',
  'Bass Drum',
  'Snare Drum',
  'Cymbals',
  'Glockenspiel',
  'Xylophone',
  'Vibraphone',

  // Other
  'Piano',
  'Conductor',
  'Score',
  'Full Score'
];

/**
 * Get a normalized version of an instrument name for comparison
 */
export function normalizeInstrumentName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    // Normalize unicode musical symbols
    .replace(/♭/g, 'b')
    .replace(/♯/g, '#');
}
