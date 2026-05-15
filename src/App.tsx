import { useEffect, useState } from 'react';
import type { ProgressEvent } from './types';

export function App() {
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ProgressEvent>({ stage: 'idle', percent: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.api.getProfile().then((p) => setUsername(p.username || ''));
    const unsub = window.api.onProgress((e) => setProgress(e));
    return unsub;
  }, []);

  async function play() {
    const name = username.trim();
    if (!name || !/^[A-Za-z0-9_]{3,16}$/.test(name)) {
      setError('Ник: 3-16 символов, латиница/цифры/_');
      return;
    }
    setError(null);
    setBusy(true);
    await window.api.saveProfile({ username: name });
    const res = await window.api.play(name);
    if (!res.ok) setError(res.error || 'Ошибка');
    setBusy(false);
  }

  return (
    <div className="app">
      <div className="bg" />
      <div className="card">
        <h1>GoW Launcher</h1>
        <p className="subtitle">God of War · Minecraft</p>

        <label className="field">
          <span>Ник</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={busy}
            placeholder="Kratos"
            maxLength={16}
          />
        </label>

        <button className="play" onClick={play} disabled={busy}>
          {busy ? 'Запускаю...' : 'Играть'}
        </button>

        {error && <div className="error">{error}</div>}

        {busy && (
          <div className="progress">
            <div className="bar">
              <div className="fill" style={{ width: `${progress.percent}%` }} />
            </div>
            <div className="detail">{progress.detail || progress.stage}</div>
          </div>
        )}
      </div>
    </div>
  );
}
