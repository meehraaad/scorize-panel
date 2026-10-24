/**
 * Names for an application's state, shared by the applicant's "Applications & results" page and
 * the supervisor's case file. Django stores codes; the API sends these names
 * (docs/backend-changes.md H5, SV8).
 */

/** ApplicationResult.Status, named. */
export type ApplicationResult =
  | 'incomplete_documents'
  | 'rejected'
  | 'pending'
  | 'waiting_for_portal'
  | 'accepted'
  | 'submitted'
  | 'completed'
  | 'waiting_for_recommendation';

export const APPLICATION_RESULTS: readonly ApplicationResult[] = [
  'pending',
  'incomplete_documents',
  'waiting_for_recommendation',
  'waiting_for_portal',
  'completed',
  'submitted',
  'accepted',
  'rejected',
];

/** ApplicationResult.ApplicantApprovalStatus, named. */
export type Approval = 'pending' | 'approved' | 'rejected';

/** ApplicationResult.PaymentStatus, named. */
export type FeePayment = 'pending' | 'paid' | 'waived';

export const FEE_PAYMENTS: readonly FeePayment[] = ['pending', 'paid', 'waived'];
