import { NavLink } from 'react-router';
import { tabClass } from './buttonStyles';

export interface Section {
  id: string;
  to: string;
  label: string;
  /** Match only this exact path (false keeps the tab active on its sub-pages). */
  end?: boolean;
}

/** A row of pill tabs that scrolls sideways on narrow screens. */
export function SectionNav({ label, sections }: { label: string; sections: readonly Section[] }) {
  return (
    <nav
      aria-label={label}
      className="relative -mx-4 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-4 py-0.5 lg:mx-0 lg:px-0.5"
    >
      {sections.map((section) => (
        <NavLink
          key={section.id}
          to={section.to}
          end={section.end ?? true}
          className={({ isActive }) => tabClass(isActive)}
        >
          {section.label}
        </NavLink>
      ))}
    </nav>
  );
}
