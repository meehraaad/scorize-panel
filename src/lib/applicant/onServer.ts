/**
 * Applicant features whose Django endpoints haven't shipped yet (docs/backend-changes.md). The
 * panel doesn't offer them, rather than show a page or button that can only fail; set an entry to
 * true when its endpoint is live.
 */
export type ServerFeature =
  | 'callRequest'
  | 'turkey'
  | 'professorEmails'
  | 'webinarRegistration'
  | 'gpaSave'
  | 'consultationInfo'
  | 'packages'
  | 'recommendationForm'
  | 'professorListForm';

export const ON_SERVER: Readonly<Record<ServerFeature, boolean>> = {
  /** H29 `POST call-request/`. */
  callRequest: false,
  /** H30–H35 `turkey/…`. */
  turkey: false,
  /** H7 `GET professor-emails/`. */
  professorEmails: false,
  /** H37 `POST services/webinars/<id>/register/`. */
  webinarRegistration: false,
  /** H38 `PUT services/gpa/`. */
  gpaSave: false,
  /** H41 `PUT consultations/<id>/info/`. */
  consultationInfo: false,
  /** H42, H43 `services/packages/<id>/` and its review. */
  packages: false,
  /** H50 `writing/recommendation/`. */
  recommendationForm: false,
  /** H50 `writing/pl/`. */
  professorListForm: false,
};
