'use client'

const CLUSTERS = [
  { id: 'group-a', x: 20, y: 22, r: 10, color: '#ffb8c6' },
  { id: 'group-b', x: 51, y: 18, r: 8, color: '#dbe7ff' },
  { id: 'group-c', x: 78, y: 32, r: 9, color: '#bff4bf' },
  { id: 'group-d', x: 31, y: 60, r: 11, color: '#ffe0b5' },
  { id: 'group-e', x: 58, y: 56, r: 13, color: '#e8d9ff' },
  { id: 'group-f', x: 80, y: 68, r: 8, color: '#ffd4dd' },
] as const

const LINKS = [
  ['group-a', 'group-b'],
  ['group-b', 'group-c'],
  ['group-a', 'group-d'],
  ['group-b', 'group-e'],
  ['group-c', 'group-e'],
  ['group-d', 'group-e'],
  ['group-e', 'group-f'],
] as const

const clusterLookup = Object.fromEntries(CLUSTERS.map((cluster) => [cluster.id, cluster]))

export function HomeScene() {
  return (
    <div className="flex h-full w-full items-center justify-center px-4 py-12 sm:px-8" aria-hidden="true">
      <div className="relative aspect-[1.2/1] w-full max-w-4xl">
        <svg viewBox="0 0 100 84" className="h-full w-full overflow-visible" fill="none">
          <defs>
            <radialGradient id="split-scene-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.92)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
            <filter id="split-scene-blur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>

          <ellipse cx="50" cy="42" rx="46" ry="30" fill="rgba(216, 230, 255, 0.44)" />
          <ellipse cx="66" cy="52" rx="20" ry="15" fill="rgba(255, 182, 193, 0.28)" />
          <ellipse cx="34" cy="52" rx="20" ry="16" fill="rgba(152, 251, 152, 0.18)" />

          {LINKS.map(([from, to]) => (
            <line
              key={`${from}-${to}`}
              x1={clusterLookup[from].x}
              y1={clusterLookup[from].y}
              x2={clusterLookup[to].x}
              y2={clusterLookup[to].y}
              stroke="rgba(255,255,255,0.52)"
              strokeWidth="0.7"
            />
          ))}

          {CLUSTERS.map((cluster) => (
            <g key={cluster.id}>
              <circle cx={cluster.x} cy={cluster.y} r={cluster.r * 2.25} fill="url(#split-scene-glow)" opacity="0.42" />
              <circle cx={cluster.x} cy={cluster.y} r={cluster.r * 1.6} fill={cluster.color} opacity="0.24" filter="url(#split-scene-blur)" />
              <circle cx={cluster.x} cy={cluster.y} r={cluster.r} fill={cluster.color} />
              <circle cx={cluster.x} cy={cluster.y} r={cluster.r * 0.38} fill="#fffdf8" opacity="0.88" />
            </g>
          ))}

          <g opacity="0.82">
            <path
              d="M16 45c8-6 14-7 19-3 6 5 10 5 18-2 7-6 12-8 18-5 6 3 9 3 14-1 5-4 10-4 15-1"
              stroke="rgba(255,255,255,0.72)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <path
              d="M24 40l4 3 5-6"
              stroke="#4a4458"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M62 43l4 3 5-6"
              stroke="#4a4458"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      </div>
    </div>
  )
}
