import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-24 text-center">
      <div className="mb-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full">
          Powered by GenLayer
        </span>
      </div>

      <h1 className="text-5xl font-bold tracking-tight mb-6">
        Create Intelligent Contracts
        <br />
        <span className="text-primary">from plain text</span>
      </h1>

      <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
        Describe what you want your contract to do. Clause Forge generates,
        validates, and deploys production-ready GenLayer Intelligent Contracts,
        no coding required.
      </p>

      <div className="flex gap-4 justify-center mb-20">
        <Link
          to="/editor"
          className="px-8 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition"
        >
          Start Building
        </Link>
        <Link
          to="/marketplace"
          className="px-8 py-3 border border-border rounded-lg font-semibold hover:bg-accent transition"
        >
          Browse Marketplace
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
        {[
          {
            step: '01',
            title: 'Describe',
            desc: 'Write what you want your contract to do in plain English.',
          },
          {
            step: '02',
            title: 'Generate',
            desc: 'AI generates a production-ready Python GenLayer contract.',
          },
          {
            step: '03',
            title: 'Deploy',
            desc: 'Validate and deploy to Studionet or Bradbury testnet.',
          },
        ].map((item) => (
          <div key={item.step} className="border border-border rounded-lg p-6">
            <div className="text-3xl font-bold text-primary/30 mb-3">
              {item.step}
            </div>
            <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
            <p className="text-muted-foreground text-sm">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
