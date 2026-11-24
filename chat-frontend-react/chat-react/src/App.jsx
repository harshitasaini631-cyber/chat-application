import { useEffect, useRef, useState } from 'react';
import useChat from './useChat';

const THEMES = ['blush', 'ember', 'sand', 'dusk'];
const EMOJI = ['😀', '😂', '😍', '😎', '🤔', '👍', '🙏', '🎉', '🔥', '❤️', '😢', '😮', '👋', '✅', '💡', '🚀'];
const read = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const fmt = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
// Avatars stay in the warm range (pinks to oranges)
const colorFor = (name) => { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${(340 + (h % 75)) % 360} 60% 52%)`; };
const STATUS = { online: 'Connected', offline: 'Disconnected. Retrying...', connecting: 'Connecting...' };

function Settings({ user, serverUrl, onSave, onClose }) {
  const [name, setName] = useState(user);
  const [url, setUrl] = useState(serverUrl);
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        <label>Your name <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} /></label>
        <label>Server address <input value={url} onChange={(e) => setUrl(e.target.value)} /></label>
        <div className="row">
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" onClick={() => onSave(name.trim() || user, url.trim() || serverUrl)}>Save changes</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => read('user', 'Guest' + Math.floor(100 + Math.random() * 900)));
  const [serverUrl, setServerUrl] = useState(() => read('server', 'http://localhost:8080'));
  const [theme, setTheme] = useState(() => { const t = read('theme', 'blush'); return THEMES.includes(t) ? t : 'blush'; });
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [newRoom, setNewRoom] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const chat = useChat(serverUrl, user);
  const list = chat.messages[chat.current] || [];
  const endRef = useRef(null);

  useEffect(() => { document.documentElement.dataset.theme = theme; write('theme', theme); }, [theme]);
  useEffect(() => { endRef.current?.scrollIntoView(); }, [list.length, chat.current]);

  const submit = () => { if (!text.trim()) return; chat.send(text.trim()); setText(''); setEmojiOpen(false); };
  const addRoom = () => { chat.addRoom(newRoom); setNewRoom(''); };
  const exportRoom = () => {
    const lines = list.map((m) => `[${new Date(m.time).toLocaleString()}] ${m.type === 'system' ? '(system)' : m.user + ':'} ${m.text}`);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' }));
    a.download = `${chat.current}-murmur.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const saveSettings = (name, url) => {
    setUser(name); write('user', name);
    if (url !== serverUrl) { setServerUrl(url); write('server', url); }
    setShowSettings(false);
  };

  return (
    <div className="app">
      <aside className="side">
        <div className="glass panel">
          <div className="brand"><span className={'dot ' + chat.status} /><h1>murmur</h1></div>
          <small className="state">{STATUS[chat.status]}</small>
          <nav className="rooms">
            {chat.rooms.map((r) => (
              <button key={r} className={'room' + (r === chat.current ? ' active' : '')} onClick={() => chat.open(r)}>
                <span># {r}</span>
                {chat.unread[r] > 0 && <span className="badge">{chat.unread[r]}</span>}
              </button>
            ))}
          </nav>
          <div className="newroom">
            <input value={newRoom} placeholder="New room" maxLength={20} onChange={(e) => setNewRoom(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addRoom()} />
            <button className="ghost" onClick={addRoom}>Add</button>
          </div>
        </div>

        <div className="card">
          <div className="who"><span>Signed in as</span><strong>{user}</strong></div>
          <div className="swatches">
            {THEMES.map((t) => <button key={t} className="sw" data-t={t} aria-label={t + ' theme'} aria-pressed={t === theme} onClick={() => setTheme(t)} />)}
          </div>
          <button className="ghost" onClick={() => setShowSettings(true)}>Settings</button>
        </div>
      </aside>

      <section className="glass chat">
        <div className="bar">
          <div><h2># {chat.current}</h2><small>{chat.online} online</small></div>
          <div className="acts">
            <button className="ghost" onClick={exportRoom}>Export</button>
            <button className="ghost" onClick={() => confirm(`Clear #${chat.current} on this device?`) && chat.clearRoom()}>Clear</button>
          </div>
        </div>
        <main>
          {list.length === 0 && <div className="empty">It's quiet in #{chat.current}. Murmur something.</div>}
          {list.map((m, i) => m.type === 'system' ? (
            <div key={i} className="system">{m.text}</div>
          ) : (
            <div key={i} className={'msg' + (m.type === 'me' ? ' me' : '')}>
              <div className="avatar" style={{ background: colorFor(m.user) }}>{m.user.slice(0, 1).toUpperCase()}</div>
              <div>
                <div className="meta">{m.type === 'me' ? 'You' : m.user}, {fmt(m.time)}</div>
                <div className="bubble">{m.text}</div>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </main>
        <footer className="composer">
          {emojiOpen && <div className="emoji">{EMOJI.map((e) => <button key={e} onClick={() => setText((t) => t + e)}>{e}</button>)}</div>}
          <button className="icon" aria-label="Emoji" onClick={() => setEmojiOpen((o) => !o)}>😊</button>
          <input value={text} placeholder={`Message #${chat.current}`} maxLength={500}
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          <button className="send" aria-label="Send" onClick={submit}>↑</button>
        </footer>
      </section>

      {showSettings && <Settings user={user} serverUrl={serverUrl} onSave={saveSettings} onClose={() => setShowSettings(false)} />}
    </div>
  );
}