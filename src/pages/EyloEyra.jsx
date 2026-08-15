import SeeEylo from '@/components/eylo/SeeEylo';
import SeeEyra from '@/components/eylo/SeeEyra';
import ResearchQuestion from '@/components/eylo/ResearchQuestion';

export default function EyloEyra() {
  return (
    <main className="min-h-screen bg-[#050810] px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">EYLO + EYRA</p>
        <h1 className="mt-4 text-6xl font-semibold">From questions to research pathways.</h1>
        <p className="mt-5 max-w-2xl text-slate-400">
          EYLO discovers evidence. EYRA helps understand where research can go next.
        </p>
        <div className="mt-10">
          <ResearchQuestion />
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <SeeEylo />
          <SeeEyra />
        </div>
      </div>
    </main>
  );
}
