import { Fragment } from 'react';
// A small safe, non-HTML markup grammar. Never evaluate user-supplied HTML/CSS.
const MARKUP = /(\*\*([^*\n]+)\*\*|_([^_\n]+)_|~([^~\n]+)~|\{(#[0-9a-fA-F]{6})\|([^{}\n]{1,200})\}|https?:\/\/[^\s<>]+)/g;
export default function RichText({ value = '' }) {
  const nodes = [];
  let offset = 0;
  for (const match of value.matchAll(MARKUP)) {
    if (match.index > offset) nodes.push(<Fragment key={`text-${offset}`}>{value.slice(offset, match.index)}</Fragment>);
    const [token, , bold, italic, strike, color, colored] = match;
    const key = `part-${match.index}`;
    if (bold) nodes.push(<strong key={key}>{bold}</strong>);
    else if (italic) nodes.push(<em key={key}>{italic}</em>);
    else if (strike) nodes.push(<s key={key}>{strike}</s>);
    else if (color) nodes.push(<span key={key} style={{ color }}>{colored}</span>);
    else if (/^https?:\/\//.test(token)) nodes.push(<a key={key} href={token} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 break-all">{token}</a>);
    offset = match.index + token.length;
  }
  if (offset < value.length) nodes.push(<Fragment key="end">{value.slice(offset)}</Fragment>);
  return <>{nodes}</>;
}
