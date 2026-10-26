import { useNavigation } from 'react-router';

/**
 * A thin bar at the top of the screen while a click waits for the next page's code or data, so
 * the click always visibly answers. Invisible for the first 150 ms (fast navigations show
 * nothing). Screen readers hear the new page's own loading state instead.
 */
export function NavigationProgress() {
  const navigation = useNavigation();
  if (navigation.state === 'idle') return null;
  return (
    <div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-50 h-0.5 animate-appear overflow-hidden bg-track"
    >
      <div className="h-full w-2/5 animate-progress bg-primary ltr:[animation-direction:reverse]" />
    </div>
  );
}
