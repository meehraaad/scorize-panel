/**
 * Booked consultations: the list and one session (its details open over the home), and the shared
 * session advice. Shapes: docs/backend-changes.md H39–H41, H62. The code lives in
 * src/lib/applicant/consultations.ts (the home, services and contract pages read it too).
 */
export {
  consultationQuery,
  consultationsQuery,
  sessionSummariesQuery,
  splitSessions,
  useSaveConsultationInfo,
  type Consultation,
  type ConsultationDetail,
  type ConsultationInfo,
  type SessionSummary,
} from '@/lib/applicant/consultations';
