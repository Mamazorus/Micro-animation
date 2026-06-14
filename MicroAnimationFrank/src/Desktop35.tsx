import { useState } from 'react'
import { SPECIALITES, SpecIconTile, type Spec } from './Specialties'
import './Desktop35.css'

/* ─── Bouton spécialité ─────────────────────────────────────────────────── */
function SpecBtn({ id, label, active, onClick }: { id: Spec; label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`sp-btn${active ? ' sp-btn--active' : ''}`} onClick={onClick} aria-pressed={active}>
      {/* Fond card */}
      <div className="sp-btn-bg" />
      {/* Mini icône animée */}
      <SpecIconTile id={id} active={active} />
      {/* Label */}
      <span className="sp-btn-label">{label}</span>
      {/* Ombre inset du bouton */}
      <div className="sp-btn-inset" />
    </button>
  )
}

/* ─── Écran Desktop 35 ──────────────────────────────────────────────────── */
export default function Desktop35() {
  const [selected, setSelected] = useState<Spec | null>(null)

  const toggle = (id: Spec) => setSelected(s => s === id ? null : id)

  return (
    <div className="d35-root">
      {/* Fond radial gradient */}
      <div className="d35-bg" />

      {/* Lien "Passer" */}
      <button className="d35-passer">Passer</button>

      {/* Corps central */}
      <div className="d35-body">
        {/* Colonne gauche : titre */}
        <div className="d35-headline">
          <h1 className="d35-title">Quelle est ta&nbsp;spécialité&nbsp;?</h1>
          <p className="d35-subtitle">Choisis ton domaine principal.</p>
        </div>

        {/* Grille des spécialités */}
        <div className="d35-grid">
          {SPECIALITES.map(({ id, label }) => (
            <SpecBtn
              key={id}
              id={id}
              label={label}
              active={selected === id}
              onClick={() => toggle(id)}
            />
          ))}
        </div>
      </div>

      {/* Footer : Retour / Suivant */}
      <div className="d35-footer">
        <button className="d35-btn-secondary">Retour</button>
        <button className={`d35-btn-primary${selected ? ' d35-btn-primary--ready' : ''}`}>Suivant</button>
      </div>

      {/* Vignettage intérieur */}
      <div className="d35-vignette" />
    </div>
  )
}
