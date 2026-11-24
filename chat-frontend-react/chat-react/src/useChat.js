import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const load = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

export default function useChat(serverUrl, user) {
  const [status, setStatus] = useState('connecting');
  const [online, setOnline] = useState(0);
  const [rooms, setRooms] = useState(() => load('rooms', ['general', 'random', 'tech']));
  const [messages, setMessages] = useState(() => load('messages', {}));   // { roomName: [message, ...] }
  const [current, setCurrent] = useState('general');
  const [unread, setUnread] = useState({});
  const socketRef = useRef(null);
  const currentRef = useRef(current);
  const userRef = useRef(user);

  useEffect(() => { currentRef.current = current; userRef.current = user; }, [current, user]);
  useEffect(() => save('rooms', rooms), [rooms]);
  useEffect(() => save('messages', messages), [messages]);

  // Put a message in a room's list. If we are not looking at that room, count it as unread.
  const add = useCallback((room, m) => {
    setMessages((p) => ({ ...p, [room]: [...(p[room] || []), { time: Date.now(), ...m }].slice(-200) }));
    if (room !== currentRef.current) setUnread((u) => ({ ...u, [room]: (u[room] || 0) + 1 }));
  }, []);

  // Talk to the server (same events your backend already uses)
  useEffect(() => {
    setStatus('connecting');
    const s = io(serverUrl, { transports: ['websocket'] });
    socketRef.current = s;
    s.on('connect', () => setStatus('online'));
    s.on('disconnect', () => setStatus('offline'));
    s.on('connect_error', () => setStatus('offline'));
    s.on('active', (n) => setOnline(n));
    s.on('join', (t) => { setOnline((n) => n + 1); add('general', { type: 'system', text: t }); });
    s.on('chat', (t) => add('general', { type: 'system', text: t }));
    s.on('announce', (t) => add('general', { type: 'system', text: 'Announcement: ' + t }));
    // Future-proof: if the backend later relays "msg", other people's messages land in the right room.
    s.on('msg', (m) => {
      if (m && typeof m === 'object' && m.user !== userRef.current)
        add(m.room || 'general', { type: 'other', user: m.user || 'Someone', text: String(m.text), time: m.time });
    });
    return () => s.disconnect();
  }, [serverUrl, add]);

  const open = (room) => { setCurrent(room); setUnread((u) => ({ ...u, [room]: 0 })); };

  const addRoom = (name) => {
    const n = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20);
    if (!n) return;
    if (!rooms.includes(n)) setRooms((r) => [...r, n]);
    open(n);
  };

  const send = (text) => {
    const s = socketRef.current;
    if (!s || !s.connected) return add(current, { type: 'system', text: 'Not connected. Message was not sent.' });
    const payload = { room: current, user, text, time: Date.now() };
    s.emit('msg', payload);                       // server receives it (and logs it)
    add(current, { type: 'me', ...payload });     // server does not echo back, so we show it ourselves
  };

  const clearRoom = () => setMessages((p) => ({ ...p, [current]: [] }));

  return { status, online, rooms, messages, current, unread, open, addRoom, send, clearRoom };
}
