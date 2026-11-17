// P-01 Landing
import { Link } from "react-router";

import { PageContainer } from "../components/PageContainer";
import { useMe } from "../features/auth/useMe";

/**
 * トップページ（manifests/common.md P-01）。中央にあいさつ・見出し・導線を置いた、シンプルでやわらかい見た目。
 * 背景のぼかした丸は装飾だけ（淡い緑と、差し色の黄色を薄く）。下にサンプルのツリー図を置く。
 */
export default function LandingPage() {
  const { user, isLoading } = useMe();

  return (
    <div className="relative isolate overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 left-1/2 size-[28rem] -translate-x-[70%] rounded-full bg-[#b6dcbf]/45 blur-3xl" />
        <div className="bg-sun/20 absolute top-40 left-1/2 size-[22rem] translate-x-[10%] rounded-full blur-3xl" />
      </div>

      <PageContainer className="flex flex-col items-center pt-14 text-center md:pt-24">
        <p className="text-sm font-semibold text-slate-500 md:text-base">
          Hello, welcome to Highdea Tree
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-balance md:text-6xl">
          Grow every idea into a tree.
        </h1>
        <p className="mt-5 max-w-xl text-base text-pretty text-slate-600 md:text-lg">
          Start with one central idea and branch it out with notes, links, videos and images, all on
          one canvas. Keep trees private, or share them for others to explore.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          {isLoading ? null : user ? (
            <Link
              to="/me"
              className="bg-ink text-surface rounded-full px-6 py-3 text-sm font-bold transition-transform hover:-translate-y-0.5"
              data-testid="go-to-my-trees"
            >
              Go to My Trees
            </Link>
          ) : (
            <Link
              to="/signup"
              className="bg-ink text-surface rounded-full px-6 py-3 text-sm font-bold transition-transform hover:-translate-y-0.5"
              data-testid="landing-signup"
            >
              Sign up free
            </Link>
          )}
          <Link
            to="/explore"
            className="group flex items-center gap-2.5 text-sm font-extrabold tracking-wide uppercase"
          >
            <span aria-hidden="true" className="bg-ink size-2.5 rounded-full" />
            <span className="border-ink/80 group-hover:border-ink border-b-2 pb-0.5">
              Explore ideas
            </span>
          </Link>
        </div>

        <div className="bg-surface/70 mt-14 w-full max-w-2xl rounded-3xl border border-slate-200 p-3 shadow-lg backdrop-blur md:mt-20 md:p-5">
          <SampleTree />
        </div>
      </PageContainer>
    </div>
  );
}

/** サンプルのツリー図（装飾用）。キャンバスと同じ見た目（点線の S 字、白いカード、濃い緑の中心）。キャンバスと同じくテーマでは色を変えない */
function SampleTree() {
  const center = { x: 200, y: 140 };
  const branches = [
    { x: 70, y: 60, label: "Problem", shape: 16 },
    { x: 330, y: 60, label: "Market", shape: 8 },
    { x: 70, y: 220, label: "Pricing", shape: 8 },
    { x: 330, y: 220, label: "Next steps", shape: 16 },
  ];
  return (
    <svg viewBox="0 0 400 280" role="img" aria-label="Example idea tree" className="w-full">
      <defs>
        <pattern id="landing-dots" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="8" cy="8" r="1" fill="#1c3a2a" fillOpacity="0.12" />
        </pattern>
      </defs>
      <rect width="400" height="280" rx="18" fill="#f6f9f5" />
      <rect width="400" height="280" rx="18" fill="url(#landing-dots)" />
      {branches.map((b) => {
        const dir = b.x < center.x ? -1 : 1;
        const sx = center.x + dir * 70;
        const ex = b.x - dir * 45;
        const mx = (sx + ex) / 2;
        return (
          <path
            key={b.label}
            d={`M ${String(sx)} ${String(center.y)} C ${String(mx)} ${String(center.y)}, ${String(mx)} ${String(b.y)}, ${String(ex)} ${String(b.y)}`}
            fill="none"
            stroke="#1c3a2a"
            strokeOpacity={0.3}
            strokeWidth={2}
            strokeDasharray="6 5"
            strokeLinecap="round"
          />
        );
      })}
      <rect x={130} y={115} width={140} height={50} rx={25} fill="#1c3a2a" />
      <text
        x={200}
        y={146}
        textAnchor="middle"
        fill="#ffffff"
        fontSize={15}
        fontWeight={800}
        fontFamily="inherit"
      >
        Startup ideas
      </text>
      {branches.map((b) => (
        <g key={`${b.label}-node`}>
          <rect
            x={b.x - 45}
            y={b.y - 16}
            width={90}
            height={32}
            rx={b.shape}
            fill="#ffffff"
            stroke="#1c3a2a"
            strokeOpacity={0.12}
          />
          <text
            x={b.x}
            y={b.y + 5}
            textAnchor="middle"
            fontSize={12}
            fontWeight={700}
            fill="#1c3a2a"
            fontFamily="inherit"
          >
            {b.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
