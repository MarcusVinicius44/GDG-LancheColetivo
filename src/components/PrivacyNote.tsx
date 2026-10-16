export function PrivacyNote({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-muted ${className}`}>
      🔒 Seu <strong className="font-medium">primeiro nome</strong> aparece para todos na lista “quem leva o quê”. Seu
      e-mail fica visível só para a organização e é usado apenas para este evento.
    </p>
  )
}
