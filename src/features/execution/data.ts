export const people = {
  mina: 'مینا',
  researcher: 'آرمان',
  applicant: 'نگار',
  manager: 'مدیر اجرا',
  visa: 'سارا',
  writing: 'لیلا',
  writer: 'هانیه',
  professor: 'استاد',
} as const;

export const caseFile = {
  name: 'نگار احمدی',
  country: 'ایتالیا',
  admissionOwner: 'mina',
  searchOwner: 'researcher',
  writingDocuments: [
    { title: 'انگیزه‌نامه', writer: 'writer' },
    { title: 'رزومه', writer: null },
  ],
} as const;

export type StaffView = 'mina' | 'researcher' | 'manager';
export type Person = keyof typeof people;
export type Criteria = { field: string; degree: string; due: string };
export type ProgramDetails = { university: string; program: string; deadline: string };
export type Program = ProgramDetails & { id: string };
export type Phase = 'searching' | 'review' | 'sent' | 'approved' | 'added';
export type Request = {
  id: string;
  criteria: Criteria;
  phase: Phase;
  options: Program[];
  sharedId?: string;
};

export type ExecutionState = { draft: Criteria; requests: Request[]; applications: Program[] };

const tehranDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function seedExecution(): ExecutionState {
  const today = new Date();
  const deadline = new Date(today.getTime() + 18 * 86400000);
  const day = (date: Date) => {
    const parts = tehranDay.formatToParts(date);
    const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? '';
    // Store a civil date independent of browser time zone and Persian calendar formatting.
    return [part('year'), part('month').padStart(2, '0'), part('day').padStart(2, '0')].join('-');
  };
  return {
    draft: { field: 'مهندسی کامپیوتر', degree: 'کارشناسی ارشد', due: day(today) },
    requests: [],
    applications: [
      {
        id: 'existing-application',
        university: 'دانشگاه پادوا',
        program: 'مهندسی کامپیوتر و هوش مصنوعی',
        deadline: day(deadline),
      },
    ],
  };
}

export const nextActor: Record<Phase, Person | null> = {
  searching: caseFile.searchOwner,
  review: caseFile.admissionOwner,
  sent: 'applicant',
  approved: caseFile.admissionOwner,
  added: null,
};

export const openRequest = (state: ExecutionState) =>
  state.requests.find((request) => request.phase !== 'added');

export const sharedProgram = (request: Request) =>
  request.options.find((option) => option.id === request.sharedId);

const programKey = ({ university, program }: ProgramDetails) =>
  [university, program]
    .map((part) =>
      part
        .normalize('NFKC')
        .replace(/ي/g, 'ی')
        .replace(/ك/g, 'ک')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase(),
    )
    .join('\u0000');

export const hasProgram = (list: ProgramDetails[], option: ProgramDetails) => {
  const key = programKey(option);
  return list.some((item) => programKey(item) === key);
};

type Command =
  | { type: 'create'; id: string; criteria: Criteria }
  | { type: 'option'; id: string; option: Program }
  | { type: 'deliver'; id: string }
  | { type: 'share'; id: string; optionId: string }
  | { type: 'confirm'; id: string }
  | { type: 'apply'; id: string };

export function updateExecution(state: ExecutionState, command: Command): ExecutionState {
  if (command.type === 'create') {
    if (openRequest(state) || state.requests.some((request) => request.id === command.id))
      return state;
    const { field, degree, due } = command.criteria;
    if (!field.trim() || !degree.trim() || !due) return state;
    const request: Request = {
      id: command.id,
      criteria: { field: field.trim(), degree: degree.trim(), due },
      phase: 'searching',
      options: [],
    };
    return { ...state, requests: [request, ...state.requests] };
  }

  const request = state.requests.find((item) => item.id === command.id);
  if (!request) return state;
  const replace = (
    change: Partial<Request>,
    applications = state.applications,
  ): ExecutionState => ({
    ...state,
    applications,
    requests: state.requests.map((item) => (item === request ? { ...item, ...change } : item)),
  });

  switch (command.type) {
    case 'option': {
      const { university, program, deadline } = command.option;
      if (request.phase !== 'searching' || !university.trim() || !program.trim() || !deadline)
        return state;
      const option = { ...command.option, university: university.trim(), program: program.trim() };
      if (hasProgram(request.options, option)) return state;
      return replace({ options: [...request.options, option] });
    }
    case 'deliver':
      return request.phase === 'searching' && request.options.length > 0
        ? replace({ phase: 'review' })
        : state;
    case 'share':
      return request.phase === 'review' &&
        request.options.some((option) => option.id === command.optionId)
        ? replace({ phase: 'sent', sharedId: command.optionId })
        : state;
    case 'confirm':
      return request.phase === 'sent' ? replace({ phase: 'approved' }) : state;
    case 'apply': {
      const option = sharedProgram(request);
      if (request.phase !== 'approved' || !option) return state;
      const exists = hasProgram(state.applications, option);
      return replace(
        { phase: 'added' },
        exists ? state.applications : [...state.applications, option],
      );
    }
  }
}

const storageKey = 'scorize.execution-preview.v1';

export function loadExecution(): ExecutionState {
  try {
    const saved = sessionStorage.getItem(storageKey);
    if (saved) return JSON.parse(saved) as ExecutionState;
  } catch {
    // A blocked storage context can still preview the entire workflow in memory.
  }
  return seedExecution();
}

export function saveExecution(state: ExecutionState) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Keep the current session usable if the browser does not allow persistence.
  }
}

export const caseServices = [
  {
    kind: 'admission',
    owner: caseFile.admissionOwner,
    actor: caseFile.admissionOwner,
    icon: 'graduation',
  },
  { kind: 'visa', owner: 'visa', actor: 'applicant', icon: 'document' },
  { kind: 'correspondence', owner: 'mina', actor: 'professor', icon: 'mail' },
  { kind: 'search', owner: caseFile.searchOwner, actor: null, icon: 'search' },
  { kind: 'writing', owner: 'writing', actor: 'applicant', icon: 'pen' },
] as const;
