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
  | 'estimate'
  | 'reviewDocuments'
  | 'background'
  | 'start'
  | 'bookingCalendar'
  | 'writingOffers'
  | 'activities'
  | 'guestInterests'
  | 'foundersAssistant'
  | 'assistantOrganize'
  | 'mailServers';

export const ON_SERVER: Readonly<Record<ServerFeature, boolean>> = {
  /** H29 `POST call-request/`. */
  callRequest: true,
  /** H30–H35 `turkey/…` with H75 (review per upload): the Turkey page and the documents tab's Turkey start. */
  turkey: false,
  /** H7 `GET professor-emails/`. */
  professorEmails: true,
  /** H37 `POST services/webinars/<id>/register/`. */
  webinarRegistration: true,
  /** H38 `PUT services/gpa/`. */
  gpaSave: true,
  /** H41 `PUT consultations/<id>/info/`. */
  consultationInfo: true,
  /** H42, H43 `services/packages/<id>/` and its review. */
  packages: true,
  /** H52–H54, H56 `estimate/…`: the admission-chance quiz (scorize-revolution `mehrad-take-over`). */
  estimate: true,
  /** H59 `review-documents/`: files sent for a free review (scorize-revolution `claude/project-thread-aylffr`). */
  reviewDocuments: true,
  /** H60 `background/`: the tablet form. */
  background: true,
  /**
   * H63, H64 `start/` and `consultations/book/`: free times, prices and the seller on the new-user
   * home (scorize-revolution `claude/project-thread-ri6qn8`). Off: the home offers what it did before.
   */
  start: true,
  /** H66 `consultations/calendar/`: every bookable type and its times, for the booking page. */
  bookingCalendar: true,
  /**
   * H67 `writing-offers/` and `writing/<kind>/start/`: the new user's documents tab, writing forms
   * before paying (scorize-revolution `claude/project-thread-7rn4r9`). Off: the tab stays a locked
   * preview without a contract.
   */
  writingOffers: true,
  /**
   * AC1–AC7 `activities/`: the to-do box on every page (supervisor asks, surveys, purchase tasks).
   * Supervisor surveys are asked in the box instead of as a gate.
   */
  activities: true,
  /**
   * H70, H71 `research-interests/profile/`: research interests before a case, with how many
   * professors work on them (scorize-revolution `feature/guest-research-interests`). Off: the
   * applications tab without a contract doesn't ask for them.
   */
  guestInterests: true,
  /**
   * AI1–AI5 `api/ai/v1/`: the founders' analysis assistant and its panel (scorize-revolution #34,
   * with migrations and the `celery_ai` worker). Off: nobody gets the founders panel. On since the
   * ArvanCloud AI gateway (ai.scorize.com) serves its models in production.
   */
  foundersAssistant: true,
  /**
   * AI7 `PATCH conversations/<id>/`: rename and pin the assistant's conversations
   * (scorize-revolution `claude/project-thread-9zyigw`, needs `makemigrations ai` + `migrate`
   * for `Conversation.pinned_at`). Off: the history list has no pin or rename buttons.
   */
  assistantOrganize: false,
  /**
   * MS1–MS8 `api/mail/v1/` and `cases/<id>/bot/settings/`: the managers' mail page (our mail
   * servers, applicant mailboxes, the email bot's rules) and each case's bot settings
   * (scorize-revolution #40, needs migrations, the `mail_admin_key` secret and `mail-admin` on each
   * mail server). Off: no mail page, and the case's bot bar has no settings.
   */
  mailServers: false,
};
