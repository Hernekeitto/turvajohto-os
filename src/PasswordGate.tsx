import { useState, type FormEvent, type ReactNode } from 'react';

const ACCESS_CODE = 'Kaulin';
const STORAGE_KEY = 'turvajohto-os-unlocked';

export default function PasswordGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(STORAGE_KEY) === '1'
  );
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  if (unlocked) return <>{children}</>;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (value === ACCESS_CODE) {
      sessionStorage.setItem(STORAGE_KEY, '1');
      setUnlocked(true);
    } else {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-sm p-6"
      >
        <h1 className="text-lg font-semibold text-slate-800 mb-1">Turvajohto OS</h1>
        <p className="text-sm text-slate-500 mb-4">Sivu on kehitysvaiheessa. Syötä salasana jatkaaksesi.</p>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
          placeholder="Salasana"
          className={`w-full border rounded-lg px-3 py-2 text-sm mb-2 outline-none focus:ring-2 focus:ring-slate-300 ${
            error ? 'border-red-400' : 'border-slate-300'
          }`}
        />
        {error && (
          <p className="text-sm text-red-500 mb-2">Väärä salasana, yritä uudelleen.</p>
        )}
        <button
          type="submit"
          className="w-full bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg py-2 mt-2 transition-colors"
        >
          Kirjaudu
        </button>
      </form>
    </div>
  );
}
