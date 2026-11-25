const BAR_HEIGHTS = [28, 52, 76, 44, 88, 64, 92, 48, 72, 36, 60, 32];

export default function AudioWaveform({ active }) {
  return (
    <div
      className={`waveform ${active ? 'waveform-active' : ''}`}
      aria-label={active ? 'Audio waveform active' : 'Audio waveform idle'}
    >
      {BAR_HEIGHTS.map((height, index) => (
        <span
          key={index}
          className="waveform-bar"
          style={{
            height: `${height}%`,
            animationDelay: `${index * 0.08}s`,
          }}
        />
      ))}
    </div>
  );
}
