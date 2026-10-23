export function readCookie(name: string) {
  const prefix = `${name}=`;
  const match = document.cookie.split('; ').find((part) => part.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : undefined;
}
