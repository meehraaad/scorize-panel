/**
 * What the login page's trust wall shows. Real figures and admissions only: everything here is
 * shown to the public as fact. Admission letters need the applicant's consent (see
 * docs/backend-changes.md, C1–C3). Until the team provides them, production shows the
 * applicant journey instead, and the design's sample letters appear only with API mocks on.
 */
export interface AdmissionLetter {
  university: string;
  /** Shorter name for the mobile ticker. */
  short: string;
  program: string;
  /** As it may be shown publicly: first name + initial. */
  applicant: string;
  degree: 'bachelor' | 'master' | 'phd';
  daysAgo: number;
}

export interface TrustStats {
  admissions: number;
  countries: number;
  years: number;
}

const SAMPLE_LETTERS: AdmissionLetter[] = [
  {
    university: 'TU Delft',
    short: 'TU Delft',
    program: 'MSc Computer Science',
    applicant: 'سارا م.',
    degree: 'master',
    daysAgo: 3,
  },
  {
    university: 'University of Toronto',
    short: 'U of Toronto',
    program: 'MASc Mechanical Engineering',
    applicant: 'امیرحسین ر.',
    degree: 'master',
    daysAgo: 8,
  },
  {
    university: 'Politecnico di Milano',
    short: 'PoliMi',
    program: 'MSc Architecture',
    applicant: 'نگار ا.',
    degree: 'master',
    daysAgo: 5,
  },
];

const showSamples = import.meta.env.DEV && import.meta.env.VITE_API_MOCKS === 'true';

export const TRUST: { letters: AdmissionLetter[]; stats: TrustStats | null } = {
  letters: showSamples ? SAMPLE_LETTERS : [],
  stats: null,
};
