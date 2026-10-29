import { useEffect, useState } from 'react';
import { Download, X, Share2 } from 'lucide-react';

const KEY = 'pulsechat.install.dismissed';
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export default function InstallAppPrompt() {
  const [prompt, setPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(() => standalone() || localStorage.getItem(KEY) === '1');
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  useEffect(() => {
    const capture = (event) => { event.preventDefault(); setPrompt(event); };
    const installed = () => { setDismissed(true); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', installed);
    return () => { window.removeEventListener('beforeinstallprompt', capture); window.removeEventListener('appinstalled', installed); };
  }, []);
  if (dismissed || (!prompt && !ios)) return null;
  return (
    <div className="install-nudge" role="region" aria-label="Install PulseChat">
      <div className="install-nudge-icon"><Download size={19}/></div>
      <div className="flex-1 min-w-0">
        <strong className="text-sm">PulseChat as an app</strong>
        <p className="text-[11px] opacity-70">{prompt ? 'Install for full-screen, app-like access.' : 'Tap Share, then Add to Home Screen to use PulseChat like an app.'}</p>
      </div>
      {prompt ? <button type="button" className="btn-primary" onClick={async () => {
        await prompt.prompt();
        const decision = await prompt.userChoice;
        if (decision.outcome === 'accepted') setDismissed(true);
        setPrompt(null);
      }}>Install</button> : <Share2 size={19} aria-hidden="true" />}
      <button type="button" className="icon-btn" aria-label="Dismiss install tip" onClick={() => {
        localStorage.setItem(KEY, '1'); setDismissed(true);
      }}><X size={16}/></button>
    </div>
  );
}
