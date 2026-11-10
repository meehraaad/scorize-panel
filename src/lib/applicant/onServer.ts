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
  | 'customerTags'
  | 'mailServers'
  | 'livePhoneCalls'
  | 'mobileExtensions'
  | 'leadSearch'
  | 'customerSearch'
  | 'offerAgreement'
  | 'officeHours'
  | 'phoneTeams';

export const ON_SERVER: Readonly<Record<ServerFeature, boolean>> = {
  /**
   * `GET/PUT /sales/v1/calls/hours/`: the office line's hours on the sales manager's page, applied
   * to the PBX by the office worker (lang `claude/office-hours`).
   */
  officeHours: false,
  /** `GET/POST/PUT /sales/v1/calls/teams/`: the office line's teams (lang `claude/phone-teams`). */
  phoneTeams: false,
  /**
   * S62 `GET /applicant/v1/offer/`: the contract offer waiting for the customer's agreement, on
   * the contract tab without a contract (lang `claude/project-thread-kr4w45`).
   */
  offerAgreement: true,
  /**
   * S56 `GET /sales/v1/leads/search/?q=`: the customer picker's light search (lang
   * `claude/project-thread-45w72o`). Off: the picker searches with the leads list as before.
   */
  leadSearch: true,
  /**
   * S63 `GET /sales/v1/customers/search/?q=` and `POST customers/<id>/take/`: the leads page's
   * search in every customer, like the old CRM's (lang `claude/pensive-dirac-ekeuff`).
   */
  customerSearch: true,
  /** Seller PBX snapshots from the signed office bridge at /sales/v1/calls/. */
  livePhoneCalls: true,
  /** The seller's PortSIP login at /sales/v1/calls/mobile/; on once the office worker runs. */
  mobileExtensions: true,
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
   * S49 `sales/v1/tags/`, `customers/<id>/tags/`, `manager/tags/`: customer tags in the sales
   * panel (scorize-revolution `claude/project-thread-om4prp`, needs `makemigrations user_profile`
   * + `migrate`, deployed together with this panel). Off: pages don't preload the tag list or
   * offer the manager's tags page; the chips and filter still follow each answer's `supports.tags`.
   */
  customerTags: true,
  /**
   * MS1–MS8 `api/mail/v1/` and `cases/<id>/bot/settings/`: the managers' mail page (our mail
   * servers, applicant mailboxes, the email bot's rules) and each case's bot settings
   * (scorize-revolution #40, needs migrations, the `mail_admin_key` secret and `mail-admin` on each
   * mail server). Off: no mail page, and the case's bot bar has no settings. Deploy the panel with
   * it only after the backend.
   */
  mailServers: true,
};
