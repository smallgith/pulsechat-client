export const SHORTCUTS = [
  ['focus', 'Focus message composer', 'Ctrl+M'],
  ['command', 'Quick commands', 'Ctrl+K'],
  ['search', 'Search chat list', 'Ctrl+Alt+S'],
  ['searchChat', 'Search open conversation', 'Ctrl+Alt+F'],
  ['newGroup', 'Create group', 'Ctrl+Shift+N'],
  ['profile', 'Edit your profile', 'Ctrl+Alt+P'],
  ['theme', 'Customize theme', 'Ctrl+Alt+T'],
  ['gallery', 'View shared media', 'Ctrl+Alt+G'],
  ['lock', 'Lock PulseChat', 'Ctrl+Shift+L'],
  ['guide', 'Keyboard guide', 'Ctrl+/'],
];
export const loadShortcuts = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('pulsechat.shortcuts') || '{}');
    return Object.fromEntries(SHORTCUTS.map(([name,, key]) => [name, typeof saved[name] === 'string' ? saved[name] : key]));
  } catch { return Object.fromEntries(SHORTCUTS.map(([name,, key]) => [name,key])); }
};
export function keyCombination(e) {
  const key = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
  if (['Control','Meta','Alt','Shift'].includes(key)) return '';
  return [e.ctrlKey || e.metaKey ? 'Ctrl' : '', e.altKey ? 'Alt' : '', e.shiftKey ? 'Shift' : '', key].filter(Boolean).join('+');
}
export const actionForKey = (event, mapping) => Object.entries(mapping).find(([,key]) => key.toLowerCase() === keyCombination(event).toLowerCase())?.[0] || null;
