interface Props {
  text: string;
  showCursor?: boolean;
  className?: string;
}

export function TypewriterText({ text, showCursor = false, className = '' }: Props) {
  return (
    <span className={className}>
      {text}
      {showCursor && (
        <span
          className="ml-0.5 inline-block w-[2px] animate-pulse bg-emerald-600/80 align-middle"
          style={{ height: '1em' }}
          aria-hidden
        />
      )}
    </span>
  );
}
