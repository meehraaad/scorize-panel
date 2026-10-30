import { Fragment, type ReactNode } from 'react';

/**
 * An answer as the model wrote it: paragraphs, "- " / "1. " lists and **bold**. A small reader of
 * the Markdown models use, building React elements only (the text is never parsed as HTML).
 * Headings ("## …") read as bold lines; anything else is shown as written.
 */
export function AnswerText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const state: { list: { ordered: boolean; items: string[] } | null; paragraph: string[] } = {
    list: null,
    paragraph: [],
  };

  const flushParagraph = () => {
    const { paragraph } = state;
    if (paragraph.length > 0)
      blocks.push(
        <p key={blocks.length} className="m-0">
          {paragraph.map((line, index) => (
            <Fragment key={index}>
              {index > 0 && <br />}
              {inline(line)}
            </Fragment>
          ))}
        </p>,
      );
    state.paragraph = [];
  };
  const flushList = () => {
    const { list } = state;
    if (list) {
      const Tag = list.ordered ? 'ol' : 'ul';
      blocks.push(
        <Tag
          key={blocks.length}
          className={`m-0 flex flex-col gap-1 ps-5 ${list.ordered ? 'list-decimal' : 'list-disc'}`}
        >
          {list.items.map((item, index) => (
            <li key={index}>{inline(item)}</li>
          ))}
        </Tag>,
      );
    }
    state.list = null;
  };

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const numbered = /^[\d۰-۹]+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (state.list?.ordered !== ordered) flushList();
      state.list ??= { ordered, items: [] };
      state.list.items.push((bullet ?? numbered)?.[1] ?? '');
    } else if (!line || /^-{3,}$/.test(line)) {
      flushParagraph();
      flushList();
    } else {
      flushList();
      const heading = /^#{1,6}\s+(.*)$/.exec(line);
      state.paragraph.push(heading ? `**${(heading[1] ?? '').replaceAll('**', '')}**` : line);
    }
  }
  flushParagraph();
  flushList();

  return <div className="flex flex-col gap-2.5">{blocks}</div>;
}

/** **bold** and `code` inside a line; stray markers are dropped. */
function inline(line: string): ReactNode[] {
  return line.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={index}>{part.slice(2, -2)}</strong>
    ) : (
      part
        .replaceAll('**', '')
        .replaceAll('`', '')
        .replace(/^\*(.+)\*$/, '$1')
    ),
  );
}
