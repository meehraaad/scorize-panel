import { Icon } from '@/components/ui/Icon';

/**
 * Questions that open to show their answer (native <details>: keyboard and screen readers work
 * without script). `openId` starts one open.
 */
export function FaqList({
  items,
  openId,
}: {
  items: readonly { id: number | string; question: string; answer: string }[];
  openId?: number | string | undefined;
}) {
  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
      {items.map((item) => (
        <li key={item.id}>
          <details open={item.id === openId} className="group rounded-[14px] open:bg-canvas">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2.5 rounded-[14px] px-3.5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              {item.question}
              <Icon
                name="chevronDown"
                size={16}
                className="flex-none text-text-2 transition-transform group-open:rotate-180"
              />
            </summary>
            <p className="m-0 px-3.5 pb-3.5 text-sm leading-7 whitespace-pre-line text-text-2">
              {item.answer}
            </p>
          </details>
        </li>
      ))}
    </ul>
  );
}
