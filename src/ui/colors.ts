/**
 * The colours of the fill tool, in rainbow order after black (brown sits next to black, as a
 * dark tone): strong ones (no primary colours) and pale ones, each pale one under its strong one.
 */
export const STRONG: readonly (readonly [string, string])[] = [
  ['Schwarz', '#22262B'],
  ['Kakao', '#7A5238'],
  ['Mohnrot', '#D23A3A'],
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
  ['Hellgrau', '#D2D7DA'],
  ['Sand', '#E5CEAE'],
  ['Lachs', '#F8B093'],
  ['Aprikose', '#FACB95'],
  ['Vanille', '#F6E292'],
  ['Lind', '#C2E5A9'],
  ['Mint', '#B4E7D7'],
  ['Eisblau', '#B5DAEC'],
  ['Flieder', '#CCB7E8'],
  ['Rosa', '#F4B3CA'],
];
