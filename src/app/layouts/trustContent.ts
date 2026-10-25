/**
 * What the login page's trust wall shows. Real figures and admissions only: everything here is
 * shown to the public as fact. Admission letters need the applicant's consent (see
 * docs/backend-changes.md, C1–C3). Until the team provides them, the page shows the applicant
 * journey instead.
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

export const TRUST: { letters: AdmissionLetter[]; stats: TrustStats | null } = {
  letters: [],
  stats: null,
};
