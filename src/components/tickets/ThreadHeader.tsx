import { Avatar } from '@/components/ui/Avatar';

/** Top of a conversation card: the people who answer (stacked avatars), its title and a line under it. */
export function ThreadHeader({
  id,
  title,
  subtitle,
  people,
}: {
  /** Id of the title (the card is a region named by it). */
  id: string;
  title: string;
  subtitle?: string | undefined;
  people: readonly string[];
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 shadow-[inset_0_-1px_0_var(--hair)] lg:px-7 lg:py-[18px]">
      {people.length > 0 && (
        <span className="flex flex-none">
          {people.slice(0, 3).map((name, index) => (
            <Avatar key={name} name={name} tone={index === 0 ? 'hero' : 'tint'} stacked />
          ))}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h2 id={id} className="m-0 text-base font-bold">
          {title}
        </h2>
        {subtitle && (
          // One line on phones (the chat needs the room); the full text is in `title`.
          <span title={subtitle} className="text-[13px] leading-6 text-text-2 max-lg:truncate">
            {subtitle}
          </span>
        )}
      </span>
    </div>
  );
}
