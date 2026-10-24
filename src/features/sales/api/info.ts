import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { joinNames, localName } from '@/lib/i18n/names';
import {
  COUNTRIES_API,
  EXAMS_API,
  STAFF_API,
  STUDY_FIELDS_API,
  allPages,
  type DjangoCountry,
  type DjangoEducation,
  type DjangoExam,
  type DjangoExamScore,
  type DjangoPersonal,
  type DjangoStudyField,
  type DjangoUserDetail,
  type Page,
} from '@/lib/staff/api';
import { customerKey } from './customer';

export interface Option {
  value: string;
  label: string;
}

export interface EducationEntry {
  /** Missing for a new row. */
  id?: number;
  degree: string;
  /** The study field's name (StudyField, found by name on save). */
  field: string;
  university: string;
  gpa: string;
}

export interface ExamEntry {
  id?: number;
  /** Exam id. */
  exam: string;
  score: string;
  /** ISO date, or empty. */
  date: string;
}

export interface CustomerInfo {
  personal: {
    first_name: string;
    last_name: string;
    father_name: string;
    /** ISO date, or empty. */
    birth_date: string;
    gender: string;
    marital: string;
    military: string;
    city: string;
    work_years: string;
  };
  goal: {
    wanted_degree: string;
    budget: string;
    /** Country names, comma separated (Country, found by name on save). */
    countries: string;
    language: string;
  };
  education: EducationEntry[];
  exams: ExamEntry[];
  /** Exams from Django; the other selects use the fixed model choices (CHOICES). */
  exams_list: Option[];
  /** The office tablet form for this customer (the old site's tablet wizard). */
  tablet_url: string;
}

/**
 * Django's existing nested endpoints (users/<id>/personal-information | education-degrees |
 * exam-scores, the forms of crm user_detail) until `customers/<id>/info/` ships (S26, S27).
 */
const userApi = (id: number) => `${STAFF_API}/users/${String(id)}`;

const text = (value: string | number | null | undefined) =>
  value === null || value === undefined ? '' : String(value);
const countryName = (country: DjangoCountry) => localName(country.country, country.persian_name);
const fieldName = (field: DjangoStudyField) => localName(field.name, field.name_persian);

interface InfoRecords {
  user: DjangoUserDetail;
  personal: DjangoPersonal | null;
  education: DjangoEducation[];
  exams: DjangoExamScore[];
}

async function records(id: number, signal?: AbortSignal): Promise<InfoRecords> {
  const [user, personal, education, exams] = await Promise.all([
    api<DjangoUserDetail>(`${userApi(id)}/`, { signal }),
    api<DjangoPersonal[]>(`${userApi(id)}/personal-information/`, { signal }),
    api<DjangoEducation[]>(`${userApi(id)}/education-degrees/`, { signal }),
    api<DjangoExamScore[]>(`${userApi(id)}/exam-scores/`, { signal }),
  ]);
  return { user, personal: personal[0] ?? null, education, exams };
}

function infoOf({ user, personal, education, exams }: InfoRecords, list: DjangoExam[]) {
  return {
    personal: {
      first_name: personal?.first_name ?? user.first_name,
      last_name: personal?.last_name ?? user.last_name,
      father_name: text(personal?.father_name),
      birth_date: text(personal?.birth_date),
      gender: text(personal?.gender),
      marital: text(personal?.marital_status),
      military: text(personal?.military_service_status),
      city: text(personal?.city_of_residence),
      work_years: text(personal?.years_of_work_experience),
    },
    goal: {
      wanted_degree: text(personal?.desired_degree),
      budget: text(personal?.budget),
      countries: joinNames((personal?.desired_countries ?? []).map(countryName)),
      language: text(personal?.current_lang_level),
    },
    education: education.map((row) => ({
      id: row.id,
      degree: String(row.degree),
      field: row.study_field ? fieldName(row.study_field) : '',
      university: row.name_of_university_or_school,
      gpa: String(row.gpa),
    })),
    exams: exams.map((row) => ({
      id: row.id,
      exam: String(row.exam.id),
      score: String(row.score),
      date: text(row.date_of_receipt),
    })),
    exams_list: list.map((exam) => ({ value: String(exam.id), label: exam.name })),
    tablet_url: `/profile/tablet-wizard/${String(user.id)}/`,
  } satisfies CustomerInfo;
}

async function fetchInfo(id: number, signal?: AbortSignal): Promise<CustomerInfo> {
  const [data, list] = await Promise.all([
    records(id, signal),
    allPages<DjangoExam>(`${EXAMS_API}/`, signal),
  ]);
  return infoOf(data, list);
}

export const infoQuery = (id: number) =>
  queryOptions({
    queryKey: [...customerKey(id), 'info'],
    queryFn: ({ signal }) => fetchInfo(id, signal),
  });

/** A country or study field typed on the page that Django doesn't know. */
export class UnknownNameError extends Error {
  constructor(readonly value: string) {
    super(`Not found: ${value}`);
    this.name = 'UnknownNameError';
  }
}

type Named = Partial<DjangoCountry & DjangoStudyField> & { id: number };

/** Finds a Country or StudyField by name with Django's search (exact name first). */
async function findId(path: string, value: string): Promise<number> {
  const page = await api<Page<Named>>(`${path}/?search=${encodeURIComponent(value)}`);
  const wanted = value.toLowerCase();
  const exact = page.results.find((item) =>
    [item.country, item.persian_name, item.name, item.name_persian].some(
      (name) => name?.toLowerCase() === wanted,
    ),
  );
  const found = exact ?? page.results[0];
  if (!found) throw new UnknownNameError(value);
  return found.id;
}

const optionalNumber = (value: string) => (value.trim() ? Number(value) : null);
const optionalText = (value: string) => value.trim() || null;

async function countryIds(names: string, current: DjangoCountry[]) {
  const wanted = names
    .split(/[،,]/)
    .map((name) => name.trim())
    .filter(Boolean);
  return Promise.all(
    wanted.map(
      async (name) =>
        current.find((country) => countryName(country) === name)?.id ?? findId(COUNTRIES_API, name),
    ),
  );
}

export type InfoSection = Partial<Pick<CustomerInfo, 'personal' | 'goal' | 'education' | 'exams'>>;

/** Writes one section with the nested endpoints: one request per record, lists matched by id. */
async function saveSection(id: number, section: InfoSection) {
  const data = await records(id);
  const base = userApi(id);
  const savePersonal = (fields: Partial<Record<keyof DjangoPersonal, unknown>>) =>
    data.personal
      ? api(`${base}/personal-information/${String(data.personal.id)}/`, {
          method: 'PATCH',
          body: fields,
        })
      : api(`${base}/personal-information/`, {
          method: 'POST',
          // A new record needs the names; take the account's until the seller types them.
          body: { first_name: data.user.first_name, last_name: data.user.last_name, ...fields },
        });

  if (section.personal) {
    const form = section.personal;
    await savePersonal({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      father_name: optionalText(form.father_name),
      birth_date: optionalText(form.birth_date),
      gender: optionalNumber(form.gender),
      marital_status: optionalNumber(form.marital),
      military_service_status: optionalNumber(form.military),
      city_of_residence: optionalText(form.city),
      years_of_work_experience: Number(form.work_years) || 0,
    });
  }

  if (section.goal) {
    const form = section.goal;
    await savePersonal({
      desired_degree: optionalNumber(form.wanted_degree),
      budget: optionalNumber(form.budget),
      desired_countries: await countryIds(form.countries, data.personal?.desired_countries ?? []),
      current_lang_level: optionalText(form.language),
    });
  }

  if (section.education) {
    const rows = section.education;
    const kept = new Set(rows.map((row) => row.id));
    await Promise.all(
      data.education
        .filter((row) => !kept.has(row.id))
        .map((row) => api(`${base}/education-degrees/${String(row.id)}/`, { method: 'DELETE' })),
    );
    for (const row of rows) {
      const stored = data.education.find((item) => item.id === row.id);
      const field = row.field.trim();
      const studyField = !field
        ? null
        : stored?.study_field && fieldName(stored.study_field) === field
          ? stored.study_field.id
          : await findId(STUDY_FIELDS_API, field);
      const body = {
        degree: optionalNumber(row.degree),
        study_field: studyField,
        name_of_university_or_school: row.university.trim(),
        gpa: optionalNumber(row.gpa),
      };
      await (row.id
        ? api(`${base}/education-degrees/${String(row.id)}/`, { method: 'PATCH', body })
        : api(`${base}/education-degrees/`, { method: 'POST', body }));
    }
  }

  if (section.exams) {
    const rows = section.exams;
    const kept = new Set(rows.map((row) => row.id));
    await Promise.all(
      data.exams
        .filter((row) => !kept.has(row.id))
        .map((row) => api(`${base}/exam-scores/${String(row.id)}/`, { method: 'DELETE' })),
    );
    for (const row of rows) {
      const body = {
        exam: optionalNumber(row.exam),
        score: optionalNumber(row.score),
        date_of_receipt: optionalText(row.date),
      };
      await (row.id
        ? api(`${base}/exam-scores/${String(row.id)}/`, { method: 'PATCH', body })
        : api(`${base}/exam-scores/`, { method: 'POST', body }));
    }
  }
}

/** Saves one section and answers the stored info. */
export function useSaveInfo(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (section: InfoSection) => {
      await saveSection(id, section);
      return fetchInfo(id);
    },
    onSuccess: (data) => {
      client.setQueryData(infoQuery(id).queryKey, data);
      return client.invalidateQueries({ queryKey: customerKey(id), exact: true });
    },
    // Records are written one by one: after a failure some may be saved already.
    onError: () => client.invalidateQueries({ queryKey: infoQuery(id).queryKey }),
  });
}
