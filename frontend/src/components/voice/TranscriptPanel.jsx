export default function TranscriptPanel({ messages }) {
  return (
    <div className="transcript-list" role="log" aria-live="polite">
      {messages.length === 0 ? (
        <div className="transcript-empty">
          No conversation messages yet. Start the microphone or type a message
          below to preview the transcript.
        </div>
      ) : (
        messages.map((msg) => (
          <div
            key={msg.id}
            className={`transcript-item ${
              msg.sender === 'ai'
                ? 'transcript-item-ai'
                : 'transcript-item-customer'
            }`}
          >
            <div className="transcript-meta">
              <span className="transcript-sender">
                {msg.sender === 'ai' ? 'Voxora AI' : 'Customer'}
              </span>
              <span className="transcript-time">{msg.time}</span>
            </div>
            <p className="transcript-text">{msg.text}</p>
          </div>
        ))
      )}
    </div>
  );
}
