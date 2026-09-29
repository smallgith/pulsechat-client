import { useMemo, useState } from 'react';
import { Search, Clock } from 'lucide-react';

const DATA = {
  Smileys: [
    ['😀','grinning happy'],['😃','smile'],['😄','grin'],['😁','beaming'],
    ['😆','laughing'],['😅','sweat smile'],['🤣','rofl'],['😂','joy tears'],
    ['🙂','slight smile'],['🙃','upside down'],['😉','wink'],['😊','blush'],
    ['😇','angel'],['🥰','love hearts'],['😍','heart eyes'],['🤩','star struck'],
    ['😘','kiss'],['😗','kissing'],['😚','kiss closed'],['😙','kiss smile'],
    ['😋','yum'],['😛','tongue'],['😜','wink tongue'],['🤪','crazy'],
    ['😝','squint tongue'],['🤑','money'],['🤗','hug'],['🤭','hand over'],
    ['🤫','shush'],['🤔','thinking'],['🤐','zipper'],['🤨','raised brow'],
    ['😐','neutral'],['😑','blank'],['😶','no mouth'],['😏','smirk'],
    ['😒','unamused'],['🙄','roll eyes'],['😬','grimace'],['🤥','lying'],
    ['😌','relieved'],['😔','pensive'],['😪','sleepy'],['🤤','drool'],
    ['😴','sleeping'],['😷','mask'],['🤒','sick'],['🤕','bandage'],
    ['🤢','nauseated'],['🤮','vomit'],['🤧','sneeze'],['🥵','hot'],
    ['🥶','cold'],['🥴','woozy'],['😵','dizzy'],['🤯','mind blown'],
    ['🤠','cowboy'],['🥳','party'],['😎','cool'],['🤓','nerd'],
    ['😕','confused'],['😟','worried'],['🙁','frown'],['☹️','frowning'],
    ['😮','open mouth'],['😯','hushed'],['😲','astonished'],['😳','flushed'],
    ['🥺','pleading'],['😦','frown open'],['😧','anguished'],['😨','fearful'],
    ['😰','anxious'],['😥','sad relief'],['😢','cry'],['😭','sob'],
    ['😱','scream'],['😖','confounded'],['😣','persevere'],['😞','disappointed'],
    ['😓','downcast'],['😩','weary'],['😫','tired'],['🥱','yawn'],
    ['😤','triumph'],['😡','rage'],['😠','angry'],['🤬','cursing'],
    ['😈','devil'],['👿','devil angry'],['💀','skull'],['💩','poop'],
    ['🤡','clown'],['👹','ogre'],['👺','goblin'],['👻','ghost'],
    ['👽','alien'],['🤖','robot'],['😺','cat smile'],
  ],
  Hands: [
    ['👍','thumbs up like'],['👎','thumbs down'],['👌','ok'],['✌️','peace'],
    ['🤞','crossed fingers'],['🤟','love you'],['🤘','rock on'],['🤙','call me'],
    ['👈','point left'],['👉','point right'],['👆','point up'],['👇','point down'],
    ['☝️','index up'],['✋','raised hand'],['🤚','back hand'],['🖐️','hand fingers'],
    ['🖖','vulcan'],['👋','wave hello'],['🤝','handshake'],['🙏','pray thanks'],
    ['👏','clap'],['🙌','raise hands'],['👐','open hands'],['🤲','palms up'],
    ['💪','muscle'],['🦾','mech arm'],['🦿','mech leg'],['🦵','leg'],
    ['🦶','foot'],['👂','ear'],['👃','nose'],['🧠','brain'],
    ['👀','eyes'],['👁️','eye'],['👅','tongue'],['👄','lips'],
  ],
  Hearts: [
    ['❤️','red heart love'],['🧡','orange heart'],['💛','yellow heart'],['💚','green heart'],
    ['💙','blue heart'],['💜','purple heart'],['🖤','black heart'],['🤍','white heart'],
    ['💔','broken heart'],['❣️','heart exclamation'],['💕','two hearts'],['💞','revolving'],
    ['💓','beating'],['💗','growing'],['💖','sparkling'],['💘','cupid'],
    ['💝','heart gift'],['💟','heart decoration'],['♥️','heart suit'],['💌','love letter'],
  ],
  Animals: [
    ['🐶','dog'],['🐱','cat'],['🐭','mouse'],['🐹','hamster'],['🐰','rabbit'],
    ['🦊','fox'],['🐻','bear'],['🐼','panda'],['🐨','koala'],['🐯','tiger'],
    ['🦁','lion'],['🐮','cow'],['🐷','pig'],['🐸','frog'],['🐵','monkey'],
    ['🐔','chicken'],['🐧','penguin'],['🐦','bird'],['🐤','chick'],['🦆','duck'],
    ['🦅','eagle'],['🦉','owl'],['🦇','bat'],['🐺','wolf'],['🐗','boar'],
    ['🐴','horse'],['🦄','unicorn'],['🐝','bee'],['🐛','bug'],['🦋','butterfly'],
    ['🐌','snail'],['🐞','ladybug'],['🐜','ant'],['🕷️','spider'],['🐢','turtle'],
    ['🐍','snake'],['🦎','lizard'],['🐙','octopus'],['🦑','squid'],['🦐','shrimp'],
    ['🦀','crab'],['🐡','blowfish'],['🐠','fish'],['🐟','fish'],['🐬','dolphin'],
    ['🐳','whale'],['🦈','shark'],
  ],
  Food: [
    ['🍎','apple'],['🍐','pear'],['🍊','orange'],['🍋','lemon'],['🍌','banana'],
    ['🍉','watermelon'],['🍇','grapes'],['🍓','strawberry'],['🍒','cherry'],['🍑','peach'],
    ['🥭','mango'],['🍍','pineapple'],['🥥','coconut'],['🥝','kiwi'],['🍅','tomato'],
    ['🥑','avocado'],['🥦','broccoli'],['🥕','carrot'],['🌽','corn'],['🥒','cucumber'],
    ['🍔','burger'],['🍟','fries'],['🍕','pizza'],['🌭','hot dog'],['🥪','sandwich'],
    ['🌮','taco'],['🌯','burrito'],['🍝','pasta'],['🍜','ramen'],['🍣','sushi'],
    ['🍱','bento'],['🍤','shrimp'],['🍚','rice'],['🍰','cake'],['🎂','birthday cake'],
    ['🍮','custard'],['🍭','lollipop'],['🍬','candy'],['🍫','chocolate'],['🍿','popcorn'],
    ['🍩','donut'],['🍪','cookie'],['🥛','milk'],['☕','coffee'],['🍵','tea'],
    ['🍺','beer'],['🍷','wine'],['🥃','whisky'],
  ],
  Objects: [
    ['⌚','watch'],['📱','phone'],['💻','laptop'],['⌨️','keyboard'],['🖥️','desktop'],
    ['🖨️','printer'],['🖱️','mouse'],['💾','floppy'],['💿','cd'],['📷','camera'],
    ['📹','video cam'],['🎥','movie cam'],['📺','tv'],['📻','radio'],['⏰','alarm'],
    ['⌛','hourglass'],['📡','satellite'],['🔋','battery'],['🔌','plug'],['💡','bulb'],
    ['🔦','flashlight'],['🕯️','candle'],['💰','money bag'],['💳','card'],['💎','gem'],
    ['🔧','wrench'],['🔨','hammer'],['⚙️','gear'],['🔫','gun'],['💣','bomb'],
    ['🔮','crystal'],['🔭','telescope'],['🔬','microscope'],['💊','pill'],['💉','syringe'],
    ['🧬','dna'],['🔑','key'],['🚪','door'],['🪑','chair'],['🛋️','couch'],
    ['🛏️','bed'],['🎁','gift'],['🎈','balloon'],['🎉','party'],['🎊','confetti'],
    ['✉️','envelope'],['📦','package'],['📜','scroll'],['📊','chart'],['📈','chart up'],
    ['📉','chart down'],['📅','calendar'],['📁','folder'],['📚','books'],['🔗','link'],
    ['📎','paperclip'],['✂️','scissors'],['✏️','pencil'],['🖊️','pen'],['🔒','lock'],
    ['🔓','unlock'],['🔔','bell'],['🔕','no bell'],
  ],
  Travel: [
    ['🚗','car'],['🚕','taxi'],['🚙','suv'],['🚌','bus'],['🏎️','race car'],
    ['🚓','police'],['🚑','ambulance'],['🚒','fire truck'],['🚚','truck'],['🛵','scooter'],
    ['🏍️','motorcycle'],['🚲','bike'],['🚂','train'],['🚄','train'],['✈️','airplane'],
    ['🚀','rocket'],['🚁','helicopter'],['⛵','sailboat'],['🚢','ship'],['⚓','anchor'],
    ['🏝️','island'],['🏖️','beach'],['🏔️','mountain'],['🌋','volcano'],['🏕️','camping'],
    ['🏠','home'],['🏢','office'],['🏥','hospital'],['🏦','bank'],['🏨','hotel'],
    ['🏫','school'],['⛪','church'],['🕌','mosque'],['🗼','tower'],['🗽','statue'],
    ['🎡','ferris'],['🎢','roller coaster'],
  ],
  Symbols: [
    ['✅','check'],['❌','cross'],['⭐','star'],['🌟','glow star'],['✨','sparkles'],
    ['⚡','lightning'],['🔥','fire'],['💥','boom'],['💫','dizzy'],['💦','sweat'],
    ['❗','exclaim'],['❓','question'],['‼️','double'],['⁉️','inter'],['💯','hundred'],
    ['⚠️','warning'],['♻️','recycle'],['🌐','globe'],['💠','diamond'],['🔆','bright'],
    ['🔅','dim'],['⬛','black sq'],['⬜','white sq'],['🟥','red sq'],['🟧','orange sq'],
    ['🟨','yellow sq'],['🟩','green sq'],['🟦','blue sq'],['🟪','purple sq'],['🟫','brown sq'],
    ['🔴','red circle'],['🟠','orange circle'],['🟡','yellow circle'],['🟢','green circle'],
    ['🔵','blue circle'],['🟣','purple circle'],['⚫','black circle'],['⚪','white circle'],
    ['➕','plus'],['➖','minus'],['➗','divide'],['✖️','multiply'],['♾️','infinity'],
    ['💲','dollar'],['💱','currency'],['™️','tm'],['©️','copyright'],['®️','registered'],
  ],
};

const RECENT_KEY = 'pulsechat.recent.emojis';
const loadRecent = () => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
};

export default function EmojiPicker({ onPick, onClose }) {
  const [tab, setTab] = useState('Smileys');
  const [q, setQ] = useState('');
  const [recent, setRecent] = useState(loadRecent);

  const categories = Object.keys(DATA);

  const list = useMemo(() => {
    if (q.trim()) {
      const n = q.trim().toLowerCase();
      const out = [];
      Object.values(DATA).forEach((arr) => {
        arr.forEach(([e, k]) => {
          if (k.includes(n) || e === n) out.push(e);
        });
      });
      return [...new Set(out)];
    }
    if (tab === 'Recent') return recent;
    return DATA[tab].map(([e]) => e);
  }, [q, tab, recent]);

  const pick = (emoji) => {
    const next = [emoji, ...recent.filter((x) => x !== emoji)].slice(0, 24);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    setRecent(next);
    onPick(emoji);
  };

  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-20 md:hidden"
        onClick={onClose}
      />

      <div className="fixed md:absolute bottom-0 md:bottom-full md:mb-2 left-0 right-0 md:left-3 md:right-auto md:w-[400px] z-30 md:z-30 glass-solid md:rounded-2xl rounded-t-3xl shadow-2xl border-t md:border border-white/10 overflow-hidden animate-pop-in max-h-[70vh] md:max-h-none flex flex-col">
        {/* mobile drag handle */}
        <div className="md:hidden flex justify-center py-2">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* search */}
        <div className="p-3 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search emoji…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-ink-900/80 border border-white/10 text-sm outline-none focus:border-brand-500/40"
            />
          </div>
        </div>

        {/* tabs */}
        <div className="flex items-center gap-1 px-2 py-2 border-b border-white/10 overflow-x-auto hide-scrollbar shrink-0">
          <button
            onClick={() => {
              setTab('Recent');
              setQ('');
            }}
            className={`p-1.5 rounded-lg shrink-0 transition ${
              tab === 'Recent' && !q
                ? 'bg-brand-500/25 text-brand-400'
                : 'text-slate-400 hover:bg-white/5'
            }`}
            title="Recent"
          >
            <Clock className="w-4 h-4" />
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => {
                setTab(c);
                setQ('');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                tab === c && !q
                  ? 'bg-brand-500/25 text-brand-400'
                  : 'text-slate-400 hover:bg-white/5'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* grid */}
        <div className="flex-1 overflow-y-auto scroll-thin p-2 md:max-h-80">
          {list.length === 0 ? (
            <p className="text-center text-xs text-slate-500 py-8">
              {tab === 'Recent' ? 'No recent emojis' : 'No emoji found'}
            </p>
          ) : (
            <div className="grid grid-cols-8 sm:grid-cols-9 md:grid-cols-10 gap-0.5">
              {list.map((e) => (
                <button
                  key={e}
                  onClick={() => pick(e)}
                  className="text-2xl p-1.5 rounded-lg hover:bg-white/10 active:bg-white/20 transition touch-manipulation"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}