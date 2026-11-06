/**
 * The colours of the fill tool, in rainbow order after black (brown sits next to black, as a
 * dark tone): strong ones (no primary colours) and pale ones, each pale one under its strong one.
 */
export const STRONG: readonly (readonly [string, string])[] = [
  ['Schwarz', '#22262B'],
  ['Kakao', '#7A5238'],
  ['Rost', '#B8543A'],
  ['Kürbis', '#DE7A34'],
  ['Senf', '#D4A12A'],
  ['Tannengrün', '#3E7A55'],
  ['Petrol', '#327A86'],
  ['Nachtblau', '#2F4B7C'],
  ['Pflaume', '#6E3F78'],
  ['Beere', '#C9548C'],
];

/** The pale colours, each under its strong one (same column in the palette). */
export const PALE: readonly (readonly [string, string])[] = [
  ['Hellgrau', '#E3E6E8'],
  ['Sand', '#EBDCC7'],
  ['Lachs', '#F7C6B2'],
  ['Aprikose', '#F9D9B5'],
  ['Vanille', '#F6E8B1'],
  ['Lind', '#D3EAC2'],
  ['Mint', '#CDEDE3'],
  ['Eisblau', '#CFE6F1'],
  ['Flieder', '#DDD0EE'],
  ['Rosa', '#F6CFDD'],
];
