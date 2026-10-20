const STEPS = [
  {
    title: 'Add your images',
    body: 'Drag them in or browse for them. Each file is identified from its contents rather than its extension, measured, and checked for anything that would be lost — transparency, animation, unusual formats.',
  },
  {
    title: 'Choose how hard to press',
    body: 'Start with Balanced, or open the advanced panel for quality, dimensions, output format and a target file size. Every control explains what it does to the picture.',
  },
  {
    title: 'Compress and compare',
    body: 'Work happens on background threads, a few images at a time. When each one finishes you get its real size, its real dimensions, and a before-and-after viewer.',
  },
  {
    title: 'Download what you keep',
    body: 'Save images one at a time, or take the whole batch as a ZIP. If a file came out larger than the original, that is reported plainly so you can keep the original instead.',
  },
];

export function HowItWorks() {
  return (
    <section className="py-16" aria-labelledby="how-heading">
      <h2 id="how-heading" className="text-2xl text-ink sm:text-3xl">
        How it works
      </h2>

      <ol className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="card relative p-5">
            <span
              className="tabular flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-semibold text-on-brand"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <h3 className="mt-3.5 text-[15px] font-semibold text-ink">{step.title}</h3>
            <p className="mt-1.5 text-sm text-muted">{step.body}</p>
          </li>
        ))}
      </ol>

      <div className="card mt-6 p-5">
        <h3 className="text-[15px] font-semibold text-ink">What happens to your files</h3>
        <p className="mt-2 text-sm text-muted">
          Pixelpress is a static site with no backend and no API for images. When you add a file,
          the browser hands this page a reference to it; the compression workers read the bytes,
          encode them in memory, and hand back a result. Nothing is sent over the network, so there
          is no upload limit beyond your own memory, and closing the tab discards everything.
          Previews are object URLs, released as soon as a file is removed or the list is cleared.
        </p>
      </div>
    </section>
  );
}
