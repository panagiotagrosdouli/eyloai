import { useState } from 'react';

export default function ResearchQuestion() {
  const [question, setQuestion] = useState('');

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask a research question..."
        className="w-full rounded-xl bg-transparent p-4 text-white outline-none"
      />
      <button className="mt-4 rounded-xl bg-blue-500 px-5 py-3 font-semibold text-white">
        Explore
      </button>
    </div>
  );
}
