type Kind = 'green' | 'red' | 'yellow' | 'blue' | 'gray';

const styles: Record<Kind, string> = {
  green:  'bg-[#0F3F2A] text-[#3DDC97] border border-[#1F6E48]',
  red:    'bg-[#3D1414] text-[#F26E5E] border border-[#7A2828]',
  yellow: 'bg-[#3F2F0A] text-[#F2C552] border border-[#7A5C18]',
  blue:   'bg-[#0E2A4A] text-[#5AB0FF] border border-[#1F4F86]',
  gray:   'bg-[#222428] text-[#9AA0A8] border border-[#3A3D43]',
};

interface Props {
  kind?: Kind;
  dot?: boolean;
  children: React.ReactNode;
  size?: 'sm' | 'md';
}

export default function Badge({ kind = 'gray', dot, children, size = 'md' }: Props) {
  const dotColor: Record<Kind, string> = {
    green: '#22C28E', red: '#DC4F3F', yellow: '#E0AA2F', blue: '#3B8FE0', gray: '#6A6F77',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ${styles[kind]} ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-[13px]'}`}>
      {dot && (
        <span
          className="rounded-full animate-pulse-dot"
          style={{ width: 7, height: 7, background: dotColor[kind], flexShrink: 0 }}
        />
      )}
      {children}
    </span>
  );
}
