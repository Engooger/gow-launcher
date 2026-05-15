import { useEffect, useState } from 'react';
import type { ProgressEvent, Profile } from './types';

export function App() {
  const [profile, setProfile] = useState<Profile>({ username: '', installDir: '', ramGb: 6 });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ProgressEvent>({ stage: 'idle', percent: 0 });
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    window.api.getProfile().then(setProfile);
    const unsub = window.api.onProgress(setProgress);
    return unsub;
  }, []);

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    const next = { ...profile, [key]: value };
    setProfile(next);
    window.api.saveProfile(next);
  }

  async function pickFolder() {
    const dir = await window.api.pickFolder();
    if (dir) update('installDir', dir);
  }

  async function play() {
    const name = profile.username.trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) {
      setError('Ник: 3-16 символов, латиница/цифры/_');
      return;
    }
    setError(null);
    setBusy(true);
    await window.api.saveProfile(profile);
    const res = await window.api.play({ username: name, ramGb: profile.ramGb });
    if (!res.ok) setError(res.error || 'Ошибка');
    setBusy(false);
  }

  return (
    <div className="app">
      <div className="bg" />

      <button
        className="settings-btn"
        onClick={() => setShowSettings(true)}
        disabled={busy}
        title="Настройки"
      >
        ⚙
      </button>

      <div className="card">
        <h1>GoW Launcher</h1>
        <p className="subtitle">God of War · Minecraft</p>

        <label className="field">
          <span>Ник</span>
          <input
            type="text"
            value={profile.username}
            onChange={(e) => update('username', e.target.value)}
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

      {showSettings && (
        <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Настройки</h2>

            <label className="field">
              <span>Папка установки</span>
              <div className="folder-row">
                <input type="text" value={profile.installDir} readOnly />
                <button className="browse" onClick={pickFolder}>Обзор</button>
              </div>
              <div className="hint">Здесь будут лежать Java, Minecraft, моды (~2-3 ГБ)</div>
            </label>

            <label className="field">
              <span>Память: {profile.ramGb} ГБ</span>
              <input
                type="range"
                min={2}
                max={16}
                step={1}
                value={profile.ramGb}
                onChange={(e) => update('ramGb', Number(e.target.value))}
              />
              <div className="hint">Рекомендуется: 6-8 ГБ. Не больше половины RAM компа.</div>
            </label>

            <button className="play" onClick={() => setShowSettings(false)}>
              Готово
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
