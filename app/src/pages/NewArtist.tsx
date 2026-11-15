import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { slugify } from '../lib/format';
import { useAuth } from '../auth';
import { ErrorNote } from '../components/ui';

export default function NewArtist() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [currency, setCurrency] = useState('EUR');
  const [unit, setUnit] = useState('cm');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('artists').insert({
      name: name.trim(),
      slug,
      currency,
      dimension_unit: unit,
      created_by: session!.user.id,
    });
    setBusy(false);
    if (error) {
      return setError(error.code === '23505' ? new Error('That web address is taken. Try another.') : error);
    }
    await qc.invalidateQueries({ queryKey: ['my-artists'] });
    navigate(`/a/${slug}/pieces`);
  }

  return (
    <div className="grid min-h-screen place-items-center bg-stone-100 px-4">
      <form onSubmit={submit} className="card w-full max-w-md space-y-4 p-7">
        <h1 className="font-serif text-2xl">Add an artist</h1>
        <p className="text-sm text-stone-500">
          Each artist has their own inventory, collections and public profile. You can invite others to help manage it.
        </p>
        <div>
          <label className="label" htmlFor="an">Artist name</label>
          <input
            id="an"
            required
            className="input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
          />
        </div>
        <div>
          <label className="label" htmlFor="as">Public profile address</label>
          <div className="flex items-center gap-1 text-sm text-stone-500">
            <span>/p/</span>
            <input
              id="as"
              required
              pattern="[a-z0-9][a-z0-9-]{1,58}[a-z0-9]"
              title="Lowercase letters, numbers and dashes"
              className="input"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="ac">Currency</label>
            <select id="ac" className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY', 'MXN'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="au">Dimensions in</label>
            <select id="au" className="input" value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="cm">Centimetres</option>
              <option value="in">Inches</option>
            </select>
          </div>
        </div>
        <ErrorNote error={error} />
        <div className="flex justify-between">
          <Link to="/" className="btn-ghost">Cancel</Link>
          <button className="btn-primary" disabled={busy || !name || slug.length < 3}>Create</button>
        </div>
      </form>
    </div>
  );
}
